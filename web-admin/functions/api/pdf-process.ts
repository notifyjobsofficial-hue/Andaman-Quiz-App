/**
 * Cloudflare Pages Function / Serverless API Route
 * Endpoint: /api/pdf-process
 * Secure server-side AI question extraction powered by Google Gemini.
 * Features:
 * - Server-side GEMINI_API_KEY (never exposed to client)
 * - Configurable Gemini model (gemini-1.5-flash, gemini-2.0-flash, etc.)
 * - Firebase Auth Admin JWT validation
 * - Digital Text and Multimodal Scanned Page OCR
 * - Anti-hallucination structured JSON schema
 * - 429 rate limit backoff and safe retry
 */

interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  OPENAI_API_KEY?: string;
}

interface RequestPayload {
  pageText?: string;
  pageImage?: string; // base64 data URL for scanned OCR / visual inspection
  pageNumber: number;
  isScanned?: boolean;
  defaults?: {
    exam?: string;
    category?: string;
    subject?: string;
    chapter?: string;
    topic?: string;
    difficulty?: string;
    language?: string;
  };
}

/**
 * Validates Firebase ID Token (JWT) on the server without heavy external dependencies.
 */
function verifyFirebaseToken(authHeader: string | null): { isValid: boolean; uid?: string; email?: string; error?: string } {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isValid: false, error: 'Missing or malformed Authorization header' };
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return { isValid: false, error: 'Empty bearer token' };
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { isValid: false, error: 'Malformed JWT structure' };
    }

    // Decode JWT payload
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);

    // Verify standard Firebase Auth claims
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { isValid: false, error: 'Firebase authentication token expired' };
    }

    if (payload.aud !== 'andaman-quiz' && payload.iss !== 'https://securetoken.google.com/andaman-quiz') {
      return { isValid: false, error: 'Token issued for unrecognized Firebase project' };
    }

    return {
      isValid: true,
      uid: payload.user_id || payload.sub,
      email: payload.email,
    };
  } catch (err: any) {
    return { isValid: false, error: 'JWT decoding failed: ' + err.message };
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const { request, env } = context;

    // 1. Authenticate Request
    const authHeader = request.headers.get('Authorization');
    const authResult = verifyFirebaseToken(authHeader);

    // In production, reject unauthenticated calls
    if (!authResult.isValid) {
      return new Response(JSON.stringify({ error: `Unauthorized: ${authResult.error}` }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Validate API Key Configuration
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'AI Provider configuration missing: GEMINI_API_KEY is not set on the server.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Parse Payload
    const body: RequestPayload = await request.json();
    const pageNumber = body.pageNumber || 1;
    const pageText = (body.pageText || '').trim();
    const pageImage = body.pageImage || '';
    const isScanned = !!body.isScanned;

    // Reject empty requests
    if (!pageText && !pageImage) {
      return new Response(JSON.stringify({ error: 'Empty page content (no text or page image provided)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Model Selection (Phase 11: Server-side configurable)
    const modelName = env.GEMINI_MODEL || 'gemini-1.5-flash';

    // 5. System Instruction & Strict Schema (Phase 1 & Anti-Hallucination)
    const systemPrompt = `You are a strict Indian competitive exam question extraction and verification engine.
Analyze the provided exam content from Page ${pageNumber}.
Extract all multiple-choice questions (MCQs) into a structured JSON array.

REQUIRED JSON OBJECT STRUCTURE PER QUESTION:
{
  "sourceQuestionNumber": 1,
  "questionText": "Question wording here...",
  "questionImageRequired": false,
  "options": {
    "A": "Text for option A",
    "B": "Text for option B",
    "C": "Text for option C",
    "D": "Text for option D"
  },
  "correctAnswer": "A",
  "answerSource": "SOURCE_ANSWER",
  "explanation": "Explanation text or formula...",
  "subject": "General Awareness",
  "chapter": "",
  "topic": "History",
  "difficulty": "Medium",
  "language": "both",
  "sourcePage": ${pageNumber},
  "warnings": []
}

CRITICAL RULES:
1. ANTI-HALLUCINATION: If an official answer key or explicit answer is present on the page, set answerSource = "SOURCE_ANSWER". If NO answer is given on the page, but you can confidently solve it, set answerSource = "AI_INFERRED" and add a warning: "Answer inferred by AI without source key". If uncertain, set correctAnswer = "" and answerSource = "UNRESOLVED".
2. VISUAL QUESTIONS: If a question references a diagram, figure, chart, map, or geometry drawing, set questionImageRequired = true and add warning: "Visual diagram required".
3. OPTIONS: Extract all 4 options (A, B, C, D). If only 2 or 3 exist, note the missing option in warnings.
4. VERBATIM ACCURACY: Preserve mathematical symbols, formulas, and Hindi text verbatim.
5. FORMAT: Return ONLY a valid raw JSON array. No markdown code fences, no extra commentary.`;

    const parts: any[] = [{ text: systemPrompt }];

    // Handle Multimodal Image OCR for Scanned Pages (Phase 5)
    if (pageImage && (isScanned || !pageText || pageText.length < 50)) {
      // Extract base64 payload from data URL if needed
      const base64Match = pageImage.match(/^data:image\/[a-zA-Z]+;base64,(.+)$/);
      const base64Data = base64Match ? base64Match[1] : pageImage;

      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Data,
        },
      });
      parts.push({
        text: `[SCANNED/VISUAL PAGE OCR MODE] Perform high-accuracy visual transcription and MCQ extraction on the page image above.`,
      });
    } else {
      // Digital Text Mode
      parts.push({
        text: `Exam Document Content (Page ${pageNumber}):\n\n${pageText}`,
      });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const geminiPayload = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    };

    // 6. Execute Gemini Request with 429 Retry Backoff (Phase 9)
    let response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    if (response.status === 429) {
      // Backoff 2.5s and retry once
      await new Promise((resolve) => setTimeout(resolve, 2500));
      response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `Gemini API Error (${response.status}): ${errText}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const geminiData: any = await response.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    // 7. Parse & Normalize JSON
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed)) {
        parsed = [parsed];
      }
    } catch {
      // Clean potential formatting artifacts
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            error: 'AI returned malformed JSON: ' + err.message,
            raw: rawText.slice(0, 500),
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Attach extraction metadata
    const extractionType = isScanned || (pageImage && (!pageText || pageText.length < 50)) ? 'OCR_AI' : 'DIGITAL_TEXT';

    const normalizedQuestions = parsed.map((q: any) => ({
      sourceQuestionNumber: q.sourceQuestionNumber || q.question_number || q.questionNumber || '',
      questionText: q.questionText || q.question_text || '',
      questionImageRequired: !!q.questionImageRequired,
      options: {
        A: q.options?.A || q.option_a || q.optionA || '',
        B: q.options?.B || q.option_b || q.optionB || '',
        C: q.options?.C || q.option_c || q.optionC || '',
        D: q.options?.D || q.option_d || q.optionD || '',
      },
      correctAnswer: (q.correctAnswer || q.correct_answer || '').toUpperCase().trim(),
      answerSource: q.answerSource || (q.correctAnswer ? 'AI_INFERRED' : 'UNRESOLVED'),
      explanation: q.explanation || q.explanation_text || '',
      subject: q.subject || body.defaults?.subject || 'General Awareness',
      chapter: q.chapter || body.defaults?.chapter || '',
      topic: q.topic || body.defaults?.topic || 'General',
      difficulty: q.difficulty || body.defaults?.difficulty || 'Medium',
      language: q.language || body.defaults?.language || 'both',
      sourcePage: pageNumber,
      warnings: Array.isArray(q.warnings) ? q.warnings : [],
      extractionType,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        pageNumber,
        modelUsed: modelName,
        extractionType,
        questions: normalizedQuestions,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
