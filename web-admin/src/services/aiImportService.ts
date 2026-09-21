/**
 * AI PDF Import & Human Review Service
 * Handles Firestore staging, background batch execution, state persistence,
 * duplicate analysis, deterministic validation, and promotion to public Question Bank.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { safeSetDoc, sanitizeForFirestore, logActivity } from '../firebase/firestore';
import {
  PdfImportJob,
  PdfBatch,
  StagedQuestion,
  JobStatus,
  JobMetrics,
  JobProgress,
  Question,
  ConfidenceLevel,
} from '../types';
import { checkDuplicate } from '../utils/duplicateDetector';
import { matchQuestionAnswer } from '../utils/answerKeyMatcher';

const JOBS_COLLECTION = 'pdf_import_jobs';

// -------------------------------------------------------------
// 1. Job Management
// -------------------------------------------------------------

export async function createImportJob(
  job: Omit<PdfImportJob, 'createdAt' | 'updatedAt'>,
  timeoutMs: number = 15000
): Promise<PdfImportJob> {
  const now = new Date().toISOString();
  const fullJob: PdfImportJob = {
    ...job,
    createdAt: now,
    updatedAt: now,
  };

  const ref = doc(db, JOBS_COLLECTION, fullJob.id);
  const writePromise = (async () => {
    await safeSetDoc(ref, fullJob);
    await logActivity('Create PDF Import Job', `Job ${fullJob.id} created for ${fullJob.fileName}`);
    return fullJob;
  })();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Firestore job creation timed out after ${Math.round(timeoutMs / 1000)}s`)),
      timeoutMs
    )
  );

  return Promise.race([writePromise, timeoutPromise]);
}

export async function getImportJob(jobId: string): Promise<PdfImportJob | null> {
  const ref = doc(db, JOBS_COLLECTION, jobId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as PdfImportJob;
}

export async function listImportJobs(): Promise<PdfImportJob[]> {
  const q = query(collection(db, JOBS_COLLECTION), orderBy('createdAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PdfImportJob));
}

export async function updateJobState(
  jobId: string,
  updates: Partial<PdfImportJob>
): Promise<void> {
  const ref = doc(db, JOBS_COLLECTION, jobId);
  const payload = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await safeSetDoc(ref, payload, { merge: true });
}

export async function deleteImportJob(jobId: string): Promise<void> {
  // Delete all staged questions first in batches
  const stagedRef = collection(db, JOBS_COLLECTION, jobId, 'staged_questions');
  const stagedSnap = await getDocs(stagedRef);

  const batchSize = 400;
  for (let i = 0; i < stagedSnap.docs.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = stagedSnap.docs.slice(i, i + batchSize);
    for (const docSnap of chunk) {
      batch.delete(docSnap.ref);
    }
    await batch.commit();
  }

  // Delete all batches
  const batchesRef = collection(db, JOBS_COLLECTION, jobId, 'batches');
  const batchesSnap = await getDocs(batchesRef);
  if (batchesSnap.docs.length > 0) {
    const batch = writeBatch(db);
    for (const docSnap of batchesSnap.docs) {
      batch.delete(docSnap.ref);
    }
    await batch.commit();
  }

  // Delete main job document
  const jobRef = doc(db, JOBS_COLLECTION, jobId);
  const batch = writeBatch(db);
  batch.delete(jobRef);
  await batch.commit();

  await logActivity('Delete PDF Import Job', `Deleted job ${jobId}`);
}

// -------------------------------------------------------------
// 2. Batch Operations
// -------------------------------------------------------------

export async function saveBatches(jobId: string, batches: PdfBatch[]): Promise<void> {
  const chunkSize = 400;
  for (let i = 0; i < batches.length; i += chunkSize) {
    const chunk = batches.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const b of chunk) {
      const ref = doc(db, JOBS_COLLECTION, jobId, 'batches', b.id);
      batch.set(ref, sanitizeForFirestore({ ...b, updatedAt: new Date().toISOString() }));
    }
    await batch.commit();
  }
}

export async function getBatches(jobId: string): Promise<PdfBatch[]> {
  const q = query(collection(db, JOBS_COLLECTION, jobId, 'batches'), orderBy('batchIndex', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PdfBatch));
}

export async function updateBatch(
  jobId: string,
  batchId: string,
  updates: Partial<PdfBatch>
): Promise<void> {
  const ref = doc(db, JOBS_COLLECTION, jobId, 'batches', batchId);
  await safeSetDoc(ref, { ...updates, updatedAt: new Date().toISOString() }, { merge: true });
}

// -------------------------------------------------------------
// 3. Staged Questions CRUD & Queue Operations
// -------------------------------------------------------------

export async function saveStagedQuestions(
  jobId: string,
  questions: StagedQuestion[]
): Promise<void> {
  if (questions.length === 0) return;

  const chunkSize = 400;
  for (let i = 0; i < questions.length; i += chunkSize) {
    const chunk = questions.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const q of chunk) {
      const ref = doc(db, JOBS_COLLECTION, jobId, 'staged_questions', q.id);
      batch.set(ref, sanitizeForFirestore(q), { merge: true });
    }
    await batch.commit();
  }
}

export async function fetchStagedQuestions(
  jobId: string,
  filterStatus?: string
): Promise<StagedQuestion[]> {
  const colRef = collection(db, JOBS_COLLECTION, jobId, 'staged_questions');
  let q = query(colRef, limit(1000));
  if (filterStatus && filterStatus !== 'ALL') {
    q = query(colRef, where('review_status', '==', filterStatus), limit(1000));
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StagedQuestion));
}

export async function updateStagedQuestion(
  jobId: string,
  question: StagedQuestion
): Promise<void> {
  const ref = doc(db, JOBS_COLLECTION, jobId, 'staged_questions', question.id);
  await safeSetDoc(ref, question, { merge: true });
}

export async function updateStagedQuestionStatus(
  jobId: string,
  questionId: string,
  newStatus: 'approved' | 'rejected' | 'pending' | 'skipped',
  notes?: string
): Promise<void> {
  const ref = doc(db, JOBS_COLLECTION, jobId, 'staged_questions', questionId);
  const updates: Partial<StagedQuestion> = {
    review_status: newStatus,
    reviewed_at: new Date().toISOString(),
    reviewed_by: auth.currentUser?.email || 'admin',
  };
  if (notes) updates.admin_notes = notes;
  await safeSetDoc(ref, updates, { merge: true });
}

export async function bulkApproveStagedQuestions(
  jobId: string,
  questionIds: string[]
): Promise<void> {
  const chunkSize = 400;
  const now = new Date().toISOString();
  const reviewer = auth.currentUser?.email || 'admin';

  for (let i = 0; i < questionIds.length; i += chunkSize) {
    const chunk = questionIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const qId of chunk) {
      const ref = doc(db, JOBS_COLLECTION, jobId, 'staged_questions', qId);
      batch.update(ref, {
        review_status: 'approved',
        reviewed_at: now,
        reviewed_by: reviewer,
      });
    }
    await batch.commit();
  }
}

// -------------------------------------------------------------
// 4. Deterministic Confidence & Validation Engine
// -------------------------------------------------------------

export function calculateDeterministicConfidence(q: Partial<StagedQuestion>): {
  confidence_score: number;
  confidence_level: ConfidenceLevel;
  warnings: string[];
} {
  const warnings: string[] = [];
  let score = 100;

  // 1. Question text / image validation
  const hasText = !!(q.question_text && q.question_text.trim().length > 5);
  const hasImage = !!(q.question_image_url && q.question_image_url.trim().length > 0);

  if (!hasText && !hasImage) {
    warnings.push('Question is missing text and question image');
    score -= 40;
  } else if (!hasText && hasImage) {
    warnings.push('Image-only question (verify diagram clarity)');
    score -= 10;
  } else if (q.question_text && q.question_text.length < 15) {
    warnings.push('Question text is unusually short');
    score -= 10;
  }

  // 2. Options validation (A-D)
  const opts = [
    { label: 'A', text: q.option_a_text, img: q.option_a_image_url },
    { label: 'B', text: q.option_b_text, img: q.option_b_image_url },
    { label: 'C', text: q.option_c_text, img: q.option_c_image_url },
    { label: 'D', text: q.option_d_text, img: q.option_d_image_url },
  ];

  let missingOptsCount = 0;
  const optTexts = new Set<string>();

  for (const opt of opts) {
    const hasOptText = !!(opt.text && opt.text.trim().length > 0);
    const hasOptImg = !!(opt.img && opt.img.trim().length > 0);

    if (!hasOptText && !hasOptImg) {
      missingOptsCount++;
      warnings.push(`Option ${opt.label} is missing`);
      score -= 20;
    } else if (hasOptText) {
      const clean = opt.text!.trim().toLowerCase();
      if (optTexts.has(clean)) {
        warnings.push(`Duplicate option text detected for Option ${opt.label}`);
        score -= 15;
      }
      optTexts.add(clean);
    }
  }

  // 3. Correct Answer validation
  if (!q.correct_answer || !['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
    warnings.push('Missing or invalid correct answer key');
    score -= 30;
  }

  // 4. Answer Source validation
  if (q.answer_source === 'AI_INFERRED') {
    warnings.push('Answer was inferred by AI without an official answer key');
    score -= 15;
  } else if (q.answer_source === 'UNRESOLVED') {
    warnings.push('Answer is unresolved');
    score -= 30;
  }

  // 5. Duplicate warning
  if (q.is_duplicate) {
    warnings.push(`Potential duplicate question detected (${q.duplicate_type || 'MATCH'})`);
    score -= 25;
  }

  const finalScore = Math.max(0, Math.min(100, score));

  // Zero-Cost-First confidence semantics:
  // HIGH: structurally valid question + A-D options + source answer matched
  // REVIEW: ambiguous formatting / unclassified taxonomy / unresolved answer / duplicate
  // ERROR: extraction incomplete (missing question text, fewer than 2 options)
  let level: ConfidenceLevel = 'HIGH';
  if (!hasText || missingOptsCount >= 3) {
    level = 'ERROR';
  } else if (
    missingOptsCount > 0 ||
    !q.correct_answer ||
    q.answer_source === 'UNRESOLVED' ||
    q.answer_source === 'AI_INFERRED' ||
    q.is_duplicate ||
    warnings.some((w) => w.toLowerCase().includes('unclassified') || w.toLowerCase().includes('visual')) ||
    finalScore < 80
  ) {
    level = 'REVIEW';
  } else {
    level = 'HIGH';
  }

  return {
    confidence_score: finalScore,
    confidence_level: level,
    warnings,
  };
}

// -------------------------------------------------------------
// 5. Promotion: Publish Approved Questions to Question Bank
// -------------------------------------------------------------

export async function publishApprovedQuestionsToQuestionBank(
  jobId: string,
  stagedQuestions: StagedQuestion[]
): Promise<{ publishedCount: number; publishedQuestions: Question[]; errors: string[] }> {
  const approved = stagedQuestions.filter((q) => q.review_status === 'approved');
  if (approved.length === 0) {
    return { publishedCount: 0, publishedQuestions: [], errors: ['No approved questions to publish'] };
  }

  const errors: string[] = [];
  const publishedList: Question[] = [];
  const chunkSize = 400;
  let publishedCount = 0;

  for (let i = 0; i < approved.length; i += chunkSize) {
    const chunk = approved.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const staged of chunk) {
      // 1. Convert to Canonical Question schema
      const targetId = staged.published_question_id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const qRef = doc(db, 'questions', targetId);

      const canonicalQuestion: Question = {
        id: targetId,
        question_text: staged.question_text || '',
        option_a_text: staged.option_a_text || '',
        option_b_text: staged.option_b_text || '',
        option_c_text: staged.option_c_text || '',
        option_d_text: staged.option_d_text || '',
        correct_answer: (staged.correct_answer || 'A') as 'A' | 'B' | 'C' | 'D',
        explanation_text: staged.explanation_text || '',
        exam: staged.exam || 'ANCHSL',
        category: staged.category,
        subject: staged.subject || 'General Awareness',
        topic: staged.topic || 'General',
        difficulty: staged.difficulty || 'Medium',
        positive_marks: staged.positive_marks || 2.0,
        negative_marks: staged.negative_marks || 0.5,
        language: staged.language || 'both',
        status: 'published',
        usageType: staged.usageType || staged.usage_type || 'BOTH',
        usage_type: staged.usageType || staged.usage_type || 'BOTH',
        source: 'PDF_IMPORT',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (staged.question_image_url) canonicalQuestion.question_image_url = staged.question_image_url;
      if (staged.option_a_image_url) canonicalQuestion.option_a_image_url = staged.option_a_image_url;
      if (staged.option_b_image_url) canonicalQuestion.option_b_image_url = staged.option_b_image_url;
      if (staged.option_c_image_url) canonicalQuestion.option_c_image_url = staged.option_c_image_url;
      if (staged.option_d_image_url) canonicalQuestion.option_d_image_url = staged.option_d_image_url;
      if (staged.explanation_image_url) canonicalQuestion.explanation_image_url = staged.explanation_image_url;
      if (staged.year) canonicalQuestion.year = staged.year;
      if (staged.source_exam) {
        canonicalQuestion.source_exam = staged.source_exam;
        canonicalQuestion.sourceExam = staged.source_exam;
      }
      if (staged.exam_date) {
        canonicalQuestion.exam_date = staged.exam_date;
        canonicalQuestion.examDate = staged.exam_date;
      }
      if (staged.shift) canonicalQuestion.shift = staged.shift;

      const cleanCanonical = sanitizeForFirestore(canonicalQuestion);
      batch.set(qRef, cleanCanonical, { merge: true });

      // 2. Mark staged question with reference to published question
      const stagedRef = doc(db, JOBS_COLLECTION, jobId, 'staged_questions', staged.id);
      batch.set(stagedRef, {
        published_question_id: targetId,
        updated_at: new Date().toISOString(),
      }, { merge: true });

      publishedList.push(canonicalQuestion);
      publishedCount++;
    }

    try {
      await batch.commit();
    } catch (err: any) {
      errors.push(`Batch write error: ${err.message}`);
    }
  }

  // Update job metrics
  const job = await getImportJob(jobId);
  if (job) {
    await updateJobState(jobId, {
      metrics: {
        ...job.metrics,
        approved: publishedCount,
        pendingReview: Math.max(0, job.metrics.detectedQuestions - publishedCount - job.metrics.rejected),
      },
    });
  }

  await logActivity(
    'Publish Staged Questions',
    `Published ${publishedCount} questions from job ${jobId} to Question Bank`
  );

  return { publishedCount, publishedQuestions: publishedList, errors };
}
