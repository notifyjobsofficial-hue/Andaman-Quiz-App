/**
 * Cloudflare Pages Function / Serverless API Route
 * Endpoint: /api/pdf-process
 * Securely handles server-side AI extraction without exposing Gemini/OpenAI API keys in frontend bundles.
 */

interface Env {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const { request, env } = context;

    // 1. Verify Authorization Header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Read Request Payload
    const body = await request.json() as {
      pageText?: string;
      pageImages?: string[];
      pageNumber: number;
      defaults?: Record<string, any>;
    };

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'AI Provider configuration missing: GEMINI_API_KEY is not set on the server.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Prepare Gemini Prompt for Structured JSON Extraction
    const systemInstruction = `You are a strict Indian competitive exam question extractor.
Extract all multiple-choice questions from the provided exam text.
Output MUST be a valid JSON array of objects with the following keys:
- question_number (number)
- question_text (string)
- option_a (string)
- option_b (string)
- option_c (string)
- option_d (string)
- correct_answer (string: "A", "B", "C", "D", or "" if not found)
- explanation (string)
- subject_suggestion (string)
- topic_suggestion (string)
- difficulty_suggestion ("Easy", "Medium", or "Hard")

STRICT RULES:
1. NEVER hallucinate or guess a correct answer if not stated in the source. If not found, leave correct_answer as "".
2. Preserve mathematical formulas, tables, and Hindi terms verbatim.
3. Return ONLY valid JSON without markdown wrapping.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemInstruction },
            { text: `Document content (Page ${body.pageNumber}):\n\n${body.pageText || ''}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    };

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return new Response(JSON.stringify({ error: `Gemini API error: ${errText}` }), {
        status: geminiRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const geminiData: any = await geminiRes.json();
    const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    let parsedQuestions = [];
    try {
      parsedQuestions = JSON.parse(rawContent);
    } catch {
      parsedQuestions = [];
    }

    return new Response(JSON.stringify({ questions: parsedQuestions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
