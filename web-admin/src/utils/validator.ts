import { Question } from '../types';

export interface RowError {
  rowNumber: number;
  questionSnippet: string;
  field: string;
  message: string;
}

export interface ValidationSummary {
  totalRows: number;
  validQuestions: Question[];
  errors: RowError[];
  duplicates: { rowNumber: number; questionSnippet: string }[];
  detectedExams: string[];
  detectedSubjects: string[];
}

// Generate normalized text hash for duplicate detection
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function validateQuestionRows(
  rows: Record<string, any>[],
  existingQuestions: Question[] = []
): ValidationSummary {
  const validQuestions: Question[] = [];
  const errors: RowError[] = [];
  const duplicates: { rowNumber: number; questionSnippet: string }[] = [];

  const existingHashes = new Set<string>();
  for (const eq of existingQuestions) {
    if (eq.question_text) {
      existingHashes.add(normalizeText(eq.question_text));
    }
  }

  const seenInBatch = new Set<string>();
  const detectedExams = new Set<string>();
  const detectedSubjects = new Set<string>();

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // header is row 1
    const qText = (row['question_text'] || row['question'] || row['Question'] || '').toString().trim();
    const qImg = (row['question_image_url'] || row['question_image'] || '').toString().trim();

    const snippet = qText ? (qText.length > 50 ? qText.slice(0, 50) + '...' : qText) : (qImg ? `[Image Question: ${qImg}]` : `[Row ${rowNumber}]`);

    // 1. Check if both question text and image are empty
    if (!qText && !qImg) {
      errors.push({
        rowNumber,
        questionSnippet: snippet,
        field: 'question_text',
        message: 'Both question text and question image URL are empty.',
      });
      return;
    }

    // 2. Validate options
    const optA = (row['option_a_text'] || row['option_a'] || row['Option A'] || '').toString().trim();
    const optAImg = (row['option_a_image_url'] || row['option_a_image'] || '').toString().trim();

    const optB = (row['option_b_text'] || row['option_b'] || row['Option B'] || '').toString().trim();
    const optBImg = (row['option_b_image_url'] || row['option_b_image'] || '').toString().trim();

    const optC = (row['option_c_text'] || row['option_c'] || row['Option C'] || '').toString().trim();
    const optCImg = (row['option_c_image_url'] || row['option_c_image'] || '').toString().trim();

    const optD = (row['option_d_text'] || row['option_d'] || row['Option D'] || '').toString().trim();
    const optDImg = (row['option_d_image_url'] || row['option_d_image'] || '').toString().trim();

    if (!optA && !optAImg) {
      errors.push({
        rowNumber,
        questionSnippet: snippet,
        field: 'option_a',
        message: 'Option A (text or image) is required.',
      });
      return;
    }
    if (!optB && !optBImg) {
      errors.push({
        rowNumber,
        questionSnippet: snippet,
        field: 'option_b',
        message: 'Option B (text or image) is required.',
      });
      return;
    }

    // 3. Validate correct_answer
    const rawAnswer = (row['correct_answer'] || row['answer'] || row['Correct Answer'] || '').toString().trim().toUpperCase();
    let correctAnswer: 'A' | 'B' | 'C' | 'D' = 'A';

    if (rawAnswer === 'A' || rawAnswer === '1') {
      correctAnswer = 'A';
    } else if (rawAnswer === 'B' || rawAnswer === '2') {
      correctAnswer = 'B';
    } else if (rawAnswer === 'C' || rawAnswer === '3') {
      correctAnswer = 'C';
    } else if (rawAnswer === 'D' || rawAnswer === '4') {
      correctAnswer = 'D';
    } else {
      errors.push({
        rowNumber,
        questionSnippet: snippet,
        field: 'correct_answer',
        message: `Invalid correct answer '${rawAnswer}'. Must be A, B, C, or D.`,
      });
      return;
    }

    // 4. Duplicate Check
    if (qText) {
      const hash = normalizeText(qText);
      if (existingHashes.has(hash) || seenInBatch.has(hash)) {
        duplicates.push({ rowNumber, questionSnippet: snippet });
      } else {
        seenInBatch.add(hash);
      }
    }

    // 5. Categorization
    const exam = (row['exam'] || row['exam_code'] || 'ANCHSL').toString().trim();
    const subject = (row['subject'] || 'General Awareness').toString().trim();
    const topic = (row['topic'] || 'General').toString().trim();
    const difficultyRaw = (row['difficulty'] || 'Medium').toString().trim();
    const difficulty = (['Easy', 'Medium', 'Hard'].includes(difficultyRaw) ? difficultyRaw : 'Medium') as 'Easy' | 'Medium' | 'Hard';

    if (exam) detectedExams.add(exam);
    if (subject) detectedSubjects.add(subject);

    const question: Question = {
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question_text: qText,
      question_image_url: qImg || undefined,
      option_a_text: optA,
      option_a_image_url: optAImg || undefined,
      option_b_text: optB,
      option_b_image_url: optBImg || undefined,
      option_c_text: optC,
      option_c_image_url: optCImg || undefined,
      option_d_text: optD,
      option_d_image_url: optDImg || undefined,
      correct_answer: correctAnswer,
      explanation_text: (row['explanation_text'] || row['explanation'] || '').toString().trim(),
      explanation_image_url: (row['explanation_image_url'] || row['explanation_image'] || '').toString().trim() || undefined,
      exam,
      category: (row['category'] || '').toString().trim(),
      subject,
      topic,
      difficulty,
      positive_marks: parseFloat(row['positive_marks']) || 2.0,
      negative_marks: parseFloat(row['negative_marks']) || 0.5,
      language: (row['language'] || 'both') as 'en' | 'hi' | 'both',
      status: 'published',
    };

    validQuestions.push(question);
  });

  return {
    totalRows: rows.length,
    validQuestions,
    errors,
    duplicates,
    detectedExams: Array.from(detectedExams),
    detectedSubjects: Array.from(detectedSubjects),
  };
}
