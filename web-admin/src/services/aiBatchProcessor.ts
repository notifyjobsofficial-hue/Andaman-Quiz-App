/**
 * AI Batch Processor
 * Orchestrates background batch execution for large PDFs (3,000-5,000 questions).
 * Features:
 * - Small page batches (5-10 pages per batch)
 * - Skip already-completed pages (never reprocess successful pages)
 * - Persist batch checkpoints to Firestore
 * - Deterministic answer key matching and duplicate detection
 * - Pause, resume, retry failed batches, and cancel support
 */

import { PDFDocumentProxy } from 'pdfjs-dist';
import { extractPageText, renderPdfPageToDataUrl } from '../utils/pdfParser';
import { parseAnswerKeyText, matchQuestionAnswer } from '../utils/answerKeyMatcher';
import { checkDuplicate } from '../utils/duplicateDetector';
import {
  PdfImportJob,
  PdfBatch,
  StagedQuestion,
  Question,
} from '../types';
import {
  saveBatches,
  getBatches,
  updateBatch,
  saveStagedQuestions,
  updateJobState,
  calculateDeterministicConfidence,
} from './aiImportService';
import { auth } from '../firebase/config';

export interface BatchProcessingCallbacks {
  onProgress?: (progress: {
    currentBatch: number;
    totalBatches: number;
    processedPages: number;
    totalPages: number;
    detectedQuestions: number;
  }) => void;
  onError?: (batchId: string, error: string) => void;
  onBatchComplete?: (batchId: string, questionsCount: number) => void;
}

export class AiBatchProcessor {
  private isPaused = false;
  private isCancelled = false;

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    this.isPaused = false;
  }

  public cancel() {
    this.isCancelled = true;
  }

  /**
   * Initializes batch records for a job if not already initialized.
   */
  public async initializeBatches(
    jobId: string,
    totalPages: number,
    pagesPerBatch: number = 5
  ): Promise<PdfBatch[]> {
    const existing = await getBatches(jobId);
    if (existing.length > 0) return existing;

    const batches: PdfBatch[] = [];
    let batchIndex = 0;

    for (let start = 1; start <= totalPages; start += pagesPerBatch) {
      const end = Math.min(start + pagesPerBatch - 1, totalPages);
      batches.push({
        id: `batch_${start}_${end}`,
        jobId,
        batchIndex,
        startPage: start,
        endPage: end,
        status: 'pending',
        questionsDetected: 0,
        retries: 0,
      });
      batchIndex++;
    }

    await saveBatches(jobId, batches);
    return batches;
  }

  /**
   * Runs the full batch processing sequence.
   */
  public async processJob(
    job: PdfImportJob,
    pdfDoc: PDFDocumentProxy,
    existingQuestions: Question[] = [],
    callbacks?: BatchProcessingCallbacks
  ): Promise<void> {
    this.isPaused = false;
    this.isCancelled = false;

    await updateJobState(job.id, { status: 'processing' });

    // 1. Get or create batches
    const batches = await this.initializeBatches(job.id, job.totalPages, 5);

    // 2. Pre-scan document for potential Answer Key pages (usually in last 10% of PDF)
    const answerKeyMap = new Map<number, 'A' | 'B' | 'C' | 'D'>();
    const answerKeyStart = Math.max(1, job.totalPages - 20);

    for (let p = answerKeyStart; p <= job.totalPages; p++) {
      try {
        const text = await extractPageText(pdfDoc, p);
        if (/answer\s*key|answers|solution/i.test(text)) {
          const parsed = parseAnswerKeyText(text);
          for (const [qNum, opt] of parsed.answers.entries()) {
            if (!answerKeyMap.has(qNum)) {
              answerKeyMap.set(qNum, opt);
            }
          }
        }
      } catch (err) {
        console.warn(`Error scanning page ${p} for answer keys:`, err);
      }
    }

    let processedPagesCount = 0;
    let totalDetectedQuestions = 0;
    let highConfCount = 0;
    let needsReviewCount = 0;
    let errorCount = 0;
    let dupCount = 0;

    // 3. Process batches sequentially
    for (let i = 0; i < batches.length; i++) {
      if (this.isCancelled) {
        await updateJobState(job.id, { status: 'cancelled' });
        return;
      }

      while (this.isPaused) {
        await updateJobState(job.id, { status: 'paused' });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (this.isCancelled) {
          await updateJobState(job.id, { status: 'cancelled' });
          return;
        }
      }

      const currentBatch = batches[i];

      // Skip already completed batches! (Recovery & Idempotency)
      if (currentBatch.status === 'completed') {
        processedPagesCount += (currentBatch.endPage - currentBatch.startPage + 1);
        totalDetectedQuestions += currentBatch.questionsDetected;
        continue;
      }

      await updateBatch(job.id, currentBatch.id, { status: 'processing' });

      try {
        const stagedQuestionsForBatch: StagedQuestion[] = [];

        // Process pages in current batch
        for (let p = currentBatch.startPage; p <= currentBatch.endPage; p++) {
          const pageText = await extractPageText(pdfDoc, p);
          
          // Deterministic Question Extraction Parser
          // Extracts structured questions directly from standard exam formats
          const extractedOnPage = this.extractQuestionsFromText(
            pageText,
            job,
            currentBatch.id,
            p,
            answerKeyMap,
            existingQuestions
          );

          // If text extraction yielded questions, accumulate them
          for (const sq of extractedOnPage) {
            stagedQuestionsForBatch.push(sq);

            if (sq.confidence_level === 'HIGH') highConfCount++;
            else if (sq.confidence_level === 'MEDIUM') needsReviewCount++;
            else errorCount++;

            if (sq.is_duplicate) dupCount++;
          }
        }

        // Save extracted questions for this batch
        if (stagedQuestionsForBatch.length > 0) {
          await saveStagedQuestions(job.id, stagedQuestionsForBatch);
        }

        // Mark batch complete
        await updateBatch(job.id, currentBatch.id, {
          status: 'completed',
          questionsDetected: stagedQuestionsForBatch.length,
          error: undefined,
        });

        processedPagesCount += (currentBatch.endPage - currentBatch.startPage + 1);
        totalDetectedQuestions += stagedQuestionsForBatch.length;

        callbacks?.onBatchComplete?.(currentBatch.id, stagedQuestionsForBatch.length);

        // Update main job progress in Firestore
        await updateJobState(job.id, {
          progress: {
            currentBatch: i + 1,
            totalBatches: batches.length,
            processedPages: processedPagesCount,
            totalPages: job.totalPages,
          },
          metrics: {
            detectedQuestions: totalDetectedQuestions,
            highConfidence: highConfCount,
            needsReview: needsReviewCount,
            errors: errorCount,
            approved: 0,
            rejected: 0,
            pendingReview: totalDetectedQuestions,
            duplicates: dupCount,
          },
        });

        callbacks?.onProgress?.({
          currentBatch: i + 1,
          totalBatches: batches.length,
          processedPages: processedPagesCount,
          totalPages: job.totalPages,
          detectedQuestions: totalDetectedQuestions,
        });

      } catch (batchErr: any) {
        console.error(`Batch ${currentBatch.id} error:`, batchErr);
        await updateBatch(job.id, currentBatch.id, {
          status: 'failed',
          error: batchErr.message || 'Batch extraction failure',
          retries: (currentBatch.retries || 0) + 1,
        });
        errorCount++;
        callbacks?.onError?.(currentBatch.id, batchErr.message);
      }
    }

    // Complete Job
    await updateJobState(job.id, {
      status: 'completed',
      progress: {
        currentBatch: batches.length,
        totalBatches: batches.length,
        processedPages: job.totalPages,
        totalPages: job.totalPages,
      },
      metrics: {
        detectedQuestions: totalDetectedQuestions,
        highConfidence: highConfCount,
        needsReview: needsReviewCount,
        errors: errorCount,
        approved: 0,
        rejected: 0,
        pendingReview: totalDetectedQuestions,
        duplicates: dupCount,
      },
    });
  }

  /**
   * Deterministic pattern extractor for exam questions.
   * Recognizes standard Indian competitive exam formats (e.g. Q1., 1., (a), (b), (c), (d)).
   */
  private extractQuestionsFromText(
    pageText: string,
    job: PdfImportJob,
    batchId: string,
    pageNumber: number,
    answerKeyMap: Map<number, 'A' | 'B' | 'C' | 'D'>,
    existingQuestions: Question[]
  ): StagedQuestion[] {
    const results: StagedQuestion[] = [];
    if (!pageText || pageText.trim().length < 30) return results;

    // Pattern to identify question starters: e.g. "\n1. ", "\nQ.1 ", "\nQuestion 1:"
    const questionSplitRegex = /(?:^|\n)(?:Q\.?|Que\.?|Question)?\s*(\d{1,4})[\s.:\-–)]+/gi;
    const matches: { index: number; qNum: number; fullMatch: string }[] = [];

    let match: RegExpExecArray | null;
    while ((match = questionSplitRegex.exec(pageText)) !== null) {
      const qNum = parseInt(match[1], 10);
      if (qNum > 0 && qNum <= 10000) {
        matches.push({
          index: match.index,
          qNum,
          fullMatch: match[0],
        });
      }
    }

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const nextIndex = i + 1 < matches.length ? matches[i + 1].index : pageText.length;
      const questionBlock = pageText.slice(current.index, nextIndex).trim();

      // Extract options (A), (B), (C), (D) or (a), (b), (c), (d)
      const optRegex = /(?:\n|^|\s)[\(\[]?([A-Da-d])[\)\]\.:\-]\s*([^\n\(\[]+)/g;
      const optionsMap: Record<string, string> = { A: '', B: '', C: '', D: '' };

      let optMatch: RegExpExecArray | null;
      let firstOptIndex = questionBlock.length;

      while ((optMatch = optRegex.exec(questionBlock)) !== null) {
        const optLetter = optMatch[1].toUpperCase();
        const optVal = optMatch[2].trim();
        if (['A', 'B', 'C', 'D'].includes(optLetter)) {
          optionsMap[optLetter] = optVal;
          if (optMatch.index < firstOptIndex) {
            firstOptIndex = optMatch.index;
          }
        }
      }

      // Question body is text before the first option
      let qText = questionBlock.slice(0, firstOptIndex).trim();
      // Remove leading question numbering
      qText = qText.replace(/^(?:Q\.?|Que\.?|Question)?\s*\d{1,4}[\s.:\-–)]+/, '').trim();

      if (!qText || qText.length < 5) continue;

      // Extract inline answer if available (e.g. "Ans: (B)" or "Answer: C")
      const inlineAnsMatch = questionBlock.match(/(?:Ans|Answer)[\s.:\-–—]*\(?([A-Da-d])\)?/i);
      const inlineAns = inlineAnsMatch ? inlineAnsMatch[1].toUpperCase() : undefined;

      // Match answer with official answer key
      const ansResolution = matchQuestionAnswer(
        current.qNum,
        inlineAns,
        answerKeyMap
      );

      // Extract inline explanation if present
      let explanation = '';
      const expMatch = questionBlock.match(/(?:Exp|Explanation|Solution)[\s.:\-–—]+([\s\S]+)$/i);
      if (expMatch) {
        explanation = expMatch[1].trim();
      }

      // Check duplicates
      const dupCheck = checkDuplicate(qText, existingQuestions);

      // Build staged question object
      const stagedId = `staged_${job.id}_p${pageNumber}_q${current.qNum}_${Math.random().toString(36).substr(2, 6)}`;
      const staged: StagedQuestion = {
        id: stagedId,
        jobId: job.id,
        batchId,
        question_text: qText,
        option_a_text: optionsMap.A,
        option_b_text: optionsMap.B,
        option_c_text: optionsMap.C,
        option_d_text: optionsMap.D,
        correct_answer: ansResolution.finalAnswer,
        explanation_text: explanation,
        exam: job.defaults.exam || 'ANCHSL',
        category: job.defaults.category,
        subject: job.defaults.subject || 'General Awareness',
        chapter: job.defaults.chapter,
        topic: job.defaults.topic || 'General',
        difficulty: job.defaults.difficulty || 'Medium',
        positive_marks: job.defaults.positiveMarks ?? 2.0,
        negative_marks: job.defaults.negativeMarks ?? 0.5,
        language: job.defaults.language || 'both',
        year: job.defaults.year,

        source_pdf: job.fileName,
        source_page: pageNumber,
        source_question_number: current.qNum,

        confidence_score: 100,
        confidence_level: 'HIGH',
        review_status: 'pending',
        answer_source: ansResolution.answerSource,
        validation_warnings: ansResolution.warning ? [ansResolution.warning] : [],
        is_duplicate: dupCheck.isDuplicate,
        duplicate_of_id: dupCheck.duplicateOfId,
        duplicate_type: dupCheck.duplicateType,
      };

      // Run deterministic confidence calculation
      const conf = calculateDeterministicConfidence(staged);
      staged.confidence_score = conf.confidence_score;
      staged.confidence_level = conf.confidence_level;
      if (conf.warnings.length > 0) {
        staged.validation_warnings = Array.from(new Set([...staged.validation_warnings, ...conf.warnings]));
      }

      results.push(staged);
    }

    return results;
  }
}
