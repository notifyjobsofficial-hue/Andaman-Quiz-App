/**
 * Deterministic Answer Key Matcher
 * Parses answer key tables, lists, and sections from text or answer key pages.
 * Supports standard competitive exam patterns (UPSC, SSC, AN Administration, State PSCs).
 */

export interface ParsedAnswerKey {
  rawMatchesCount: number;
  answers: Map<number, 'A' | 'B' | 'C' | 'D'>;
  unresolvedNumbers: number[];
}

export function parseAnswerKeyText(text: string): ParsedAnswerKey {
  const answers = new Map<number, 'A' | 'B' | 'C' | 'D'>();
  const unresolvedNumbers: number[] = [];

  if (!text || text.trim().length === 0) {
    return { rawMatchesCount: 0, answers, unresolvedNumbers };
  }

  // Normalize text: replace tabs and multiple spaces with single space
  const normalized = text.replace(/[\r\n]+/g, ' \n ');

  // Common patterns in Indian exam answer keys:
  // 1. "1. (A)" or "1. A" or "1 - A" or "1: A" or "1) A" or "1.(b)"
  // 2. "Q.1 A" or "Q1. B" or "Q 1 - C"
  // 3. Table format: "1 A 2 B 3 C 4 D"
  // 4. "1. 1" / "1. 2" / "1. 3" / "1. 4" (numeric options 1-4 mapped to A-D)
  
  const patterns: RegExp[] = [
    // Pattern 1: Q.1 / Q1 with punctuation: Q\.?\s*(\d{1,4})[\s.:\-–—)]+\(?([A-Da-d1-4])\)?
    /(?:^|[\s,;|])(?:Q\.?|Que\.?|Question)?\s*(\d{1,4})[\s.:\-–—)]+\(?([A-Da-d1-4])\)?(?=[\s,;|\n]|$)/gi,
    // Pattern 2: Bracketed question numbers: (1) A or (1) (A)
    /(?:^|[\s,;|])\((\d{1,4})\)[\s.:\-–—]*\(?([A-Da-d1-4])\)?(?=[\s,;|\n]|$)/gi,
    // Pattern 3: Grid / Table rows: "1\tA\t2\tB" or "1  A  2  B"
    /(?:^|[\s])(\d{1,4})\s+([A-Da-d1-4])(?=[\s\n]|$)/gi,
  ];

  function mapOptionChar(val: string): 'A' | 'B' | 'C' | 'D' | null {
    const v = val.trim().toUpperCase();
    if (v === 'A' || v === '1') return 'A';
    if (v === 'B' || v === '2') return 'B';
    if (v === 'C' || v === '3') return 'C';
    if (v === 'D' || v === '4') return 'D';
    return null;
  }

  let totalFound = 0;

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalized)) !== null) {
      const qNum = parseInt(match[1], 10);
      const optRaw = match[2];
      const opt = mapOptionChar(optRaw);

      if (qNum > 0 && qNum <= 10000 && opt) {
        if (!answers.has(qNum)) {
          answers.set(qNum, opt);
          totalFound++;
        }
      }
    }
    // If pattern yielded a good set of contiguous answers, we don't need to overmatch noise
    if (answers.size >= 10) {
      break;
    }
  }

  return {
    rawMatchesCount: totalFound,
    answers,
    unresolvedNumbers,
  };
}

/**
 * Reconciles an extracted question against the parsed answer key.
 * Strictly distinguishes SOURCE_ANSWER vs AI_INFERRED vs UNRESOLVED.
 */
export function matchQuestionAnswer(
  sourceQuestionNumber: number | string | undefined,
  aiSuggestedAnswer: string | undefined,
  answerKeyMap: Map<number, 'A' | 'B' | 'C' | 'D'>
): {
  finalAnswer: 'A' | 'B' | 'C' | 'D' | '';
  answerSource: 'SOURCE_ANSWER' | 'AI_INFERRED' | 'UNRESOLVED';
  warning?: string;
} {
  const qNum = typeof sourceQuestionNumber === 'string'
    ? parseInt(sourceQuestionNumber.replace(/\D/g, ''), 10)
    : sourceQuestionNumber;

  const validOptions = new Set(['A', 'B', 'C', 'D']);
  const cleanAi = (aiSuggestedAnswer || '').trim().toUpperCase();
  const validAi = validOptions.has(cleanAi) ? (cleanAi as 'A' | 'B' | 'C' | 'D') : '';

  // 1. Check if source answer key has this question number
  if (qNum && answerKeyMap.has(qNum)) {
    const sourceAns = answerKeyMap.get(qNum)!;

    // Check if AI suggested something conflicting
    if (validAi && validAi !== sourceAns) {
      return {
        finalAnswer: sourceAns,
        answerSource: 'SOURCE_ANSWER',
        warning: `Answer key states (${sourceAns}), but AI suggested (${validAi}). Using source answer key.`,
      };
    }

    return {
      finalAnswer: sourceAns,
      answerSource: 'SOURCE_ANSWER',
    };
  }

  // 2. If no source answer exists, but AI suggested one -> Mark AI_INFERRED (Requires Review)
  if (validAi) {
    return {
      finalAnswer: validAi,
      answerSource: 'AI_INFERRED',
      warning: 'No source answer key found; answer was inferred by AI and requires human verification.',
    };
  }

  // 3. Otherwise completely unresolved
  return {
    finalAnswer: '',
    answerSource: 'UNRESOLVED',
    warning: 'Missing answer key and unresolved by AI. Requires administrator answer selection.',
  };
}
