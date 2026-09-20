/**
 * Multi-Level Duplicate Detection Engine
 * Detects:
 * 1. Exact text matches
 * 2. Normalized text matches (lowercased, punctuation-stripped, whitespace-collapsed)
 * 3. High-similarity probable duplicates (Jaccard word-set similarity >= 0.85)
 */

import { Question, StagedQuestion } from '../types';

export function normalizeQuestionText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates token-based Jaccard similarity between two strings (0.0 to 1.0).
 */
export function calculateJaccardSimilarity(text1: string, text2: string): number {
  const words1 = new Set(normalizeQuestionText(text1).split(' ').filter((w) => w.length > 2));
  const words2 = new Set(normalizeQuestionText(text2).split(' ').filter((w) => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const w of words1) {
    if (words2.has(w)) intersectionCount++;
  }

  const unionCount = new Set([...words1, ...words2]).size;
  return intersectionCount / unionCount;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType?: 'EXACT' | 'NORMALIZED' | 'SIMILAR';
  duplicateOfId?: string;
  matchedQuestionText?: string;
  similarityScore?: number;
}

/**
 * Checks a target question text against an existing repository of questions.
 */
export function checkDuplicate(
  questionText: string,
  existingQuestions: (Question | StagedQuestion)[],
  currentQuestionId?: string
): DuplicateCheckResult {
  if (!questionText || questionText.trim().length === 0) {
    return { isDuplicate: false };
  }

  const targetRaw = questionText.trim();
  const targetNorm = normalizeQuestionText(questionText);

  // 1. Check Exact Match
  for (const q of existingQuestions) {
    if (currentQuestionId && q.id === currentQuestionId) continue;
    if (q.question_text && q.question_text.trim() === targetRaw) {
      return {
        isDuplicate: true,
        duplicateType: 'EXACT',
        duplicateOfId: q.id,
        matchedQuestionText: q.question_text,
        similarityScore: 1.0,
      };
    }
  }

  // 2. Check Normalized Match
  for (const q of existingQuestions) {
    if (currentQuestionId && q.id === currentQuestionId) continue;
    if (q.question_text) {
      const qNorm = normalizeQuestionText(q.question_text);
      if (qNorm === targetNorm && targetNorm.length > 10) {
        return {
          isDuplicate: true,
          duplicateType: 'NORMALIZED',
          duplicateOfId: q.id,
          matchedQuestionText: q.question_text,
          similarityScore: 1.0,
        };
      }
    }
  }

  // 3. Check High-Similarity Match (>= 85% word overlap)
  for (const q of existingQuestions) {
    if (currentQuestionId && q.id === currentQuestionId) continue;
    if (q.question_text) {
      const sim = calculateJaccardSimilarity(targetRaw, q.question_text);
      if (sim >= 0.85) {
        return {
          isDuplicate: true,
          duplicateType: 'SIMILAR',
          duplicateOfId: q.id,
          matchedQuestionText: q.question_text,
          similarityScore: Math.round(sim * 100) / 100,
        };
      }
    }
  }

  return { isDuplicate: false };
}
