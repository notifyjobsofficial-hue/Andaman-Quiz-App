/**
 * AI & Zero-Cost Batch Processor
 * Orchestrates resumable batch execution for large PDFs (3,000-5,000 questions).
 * Features:
 * - Zero-Cost-First Architecture: Free Local Mode by default (PDF.js + Tesseract.js client OCR)
 * - Optional AI Enhancement: Server-side Gemini AI extraction via authenticated /api/pdf-process
 * - Multi-Column layout detection and reading-order reconstruction
 * - Local Tesseract.js client OCR with live progress reporting for scanned pages
 * - Small page batches (3-5 pages per batch) with persistent Firestore checkpoints
 * - Deterministic taxonomy mapping against existing Exams, Subjects, and Topics
 * - Deterministic answer key matching, confidence scoring (HIGH, REVIEW, ERROR), and duplicate detection
 * - Pause, resume from checkpoint, retry failed batches, and cancel support
 */

import { PDFDocumentProxy } from 'pdfjs-dist';
import { extractPageText, renderPdfPageToDataUrl, renderPdfPageToCanvas } from '../utils/pdfParser';
import { parseAnswerKeyText, matchQuestionAnswer } from '../utils/answerKeyMatcher';
import { checkDuplicate } from '../utils/duplicateDetector';
import { recognizePageImage, terminateOcrWorker } from '../utils/localOcr';
import { matchDeterministicTaxonomy } from '../utils/taxonomyMatcher';
import {
  PdfImportJob,
  PdfBatch,
  StagedQuestion,
  Question,
  Subject,
  Topic,
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
    ocrProgress?: number;
  }) => void;
  onError?: (batchId: string, error: string) => void;
  onBatchComplete?: (batchId: string, questionsCount: number) => void;
  onOcrProgress?: (percent: number, page: number) => void;
}

export class AiBatchProcessor {
  private isPaused = false;
  private isCancelled = false;

  public pause() {
    this.isPaused = true;
    terminateOcrWorker().catch(() => {});
  }

  public resume() {
    this.isPaused = false;
  }

  public cancel() {
    this.isCancelled = true;
    terminateOcrWorker().catch(() => {});
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
   * Runs the batch processing sequence (with stop/resume from checkpoint support).
   */
  public async processJob(
    job: PdfImportJob,
    pdfDoc: PDFDocumentProxy,
    existingQuestions: Question[] = [],
    callbacks?: BatchProcessingCallbacks,
    subjects: Subject[] = [],
    topics: Topic[] = []
  ): Promise<void> {
    this.isPaused = false;
    this.isCancelled = false;

    try {
      await updateJobState(job.id, { status: 'processing' });

      // 1. Get or create batches
      const batches = await this.initializeBatches(job.id, job.totalPages, 5);

    // 2. Pre-scan document for potential Answer Key pages (usually in trailing pages or answer sections)
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

    // 3. Process batches sequentially (skips already-completed batches)
    for (let i = 0; i < batches.length; i++) {
      if (this.isCancelled) {
        await updateJobState(job.id, { status: 'cancelled' });
        await terminateOcrWorker();
        return;
      }

      while (this.isPaused) {
        await updateJobState(job.id, { status: 'paused' });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (this.isCancelled) {
          await updateJobState(job.id, { status: 'cancelled' });
          await terminateOcrWorker();
          return;
        }
      }

      const currentBatch = batches[i];

      // Skip already completed batches! (Checkpoint / Resume Guarantee)
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
          const pageQuestions = await this.extractPageQuestions(
            p,
            pdfDoc,
            job,
            currentBatch.id,
            answerKeyMap,
            existingQuestions,
            subjects,
            topics,
            callbacks
          );

          for (const sq of pageQuestions) {
            stagedQuestionsForBatch.push(sq);

            if (sq.confidence_level === 'HIGH') highConfCount++;
            else if (sq.confidence_level === 'REVIEW' || sq.confidence_level === 'MEDIUM') needsReviewCount++;
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
        console.error(`Error in batch ${currentBatch.id}:`, batchErr);
        await updateBatch(job.id, currentBatch.id, {
          status: 'failed',
          error: batchErr.message,
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

    await terminateOcrWorker();
    } catch (fatalErr: any) {
      console.error('Fatal error during processJob:', fatalErr);
      await updateJobState(job.id, { status: 'failed' }).catch(() => {});
      callbacks?.onError?.('job_init', fatalErr.message || 'Fatal error during PDF processing');
    }
  }

  /**
   * Resumes an interrupted job from its first incomplete batch.
   */
  public async resumeFromCheckpoint(
    job: PdfImportJob,
    pdfDoc: PDFDocumentProxy,
    existingQuestions: Question[] = [],
    callbacks?: BatchProcessingCallbacks,
    subjects: Subject[] = [],
    topics: Topic[] = []
  ): Promise<void> {
    return this.processJob(job, pdfDoc, existingQuestions, callbacks, subjects, topics);
  }

  /**
   * Extracts questions from a single page according to the configured extractionMode.
   * Free Local Mode (Default): Uses PDF.js for digital text and Tesseract.js client OCR for scanned pages. ₹0 API usage.
   * AI Assisted Mode (Optional): Uses authenticated /api/pdf-process endpoint with Gemini.
   */
  private async extractPageQuestions(
    pageNumber: number,
    pdfDoc: PDFDocumentProxy,
    job: PdfImportJob,
    batchId: string,
    answerKeyMap: Map<number, 'A' | 'B' | 'C' | 'D'>,
    existingQuestions: Question[],
    subjects: Subject[] = [],
    topics: Topic[] = [],
    callbacks?: BatchProcessingCallbacks
  ): Promise<StagedQuestion[]> {
    const isAiMode = job.config?.extractionMode === 'ai_assisted';

    // 1. Extract digital text with multi-column reading order reconstruction
    const pageText = await extractPageText(pdfDoc, pageNumber);
    const isScanned = !!job.config?.ocrEnabled || pageText.trim().length < 50;

    // -------------------------------------------------------------
    // Path A: Free Local Mode (Default, ₹0 API usage)
    // -------------------------------------------------------------
    if (!isAiMode) {
      if (isScanned) {
        // Scanned page: perform browser-side Tesseract.js OCR
        try {
          const canvas = document.createElement('canvas');
          await renderPdfPageToCanvas(pdfDoc, pageNumber, canvas, 2.0);

          const ocrText = await recognizePageImage(canvas, (progressPercent) => {
            callbacks?.onOcrProgress?.(progressPercent, pageNumber);
            callbacks?.onProgress?.({
              currentBatch: 0,
              totalBatches: 0,
              processedPages: pageNumber,
              totalPages: job.totalPages,
              detectedQuestions: 0,
              ocrProgress: progressPercent,
            });
          });

          if (ocrText && ocrText.trim().length >= 30) {
            return this.extractQuestionsFromText(
              ocrText,
              job,
              batchId,
              pageNumber,
              answerKeyMap,
              existingQuestions,
              subjects,
              topics,
              'OCR_AI'
            );
          }
        } catch (ocrErr) {
          console.warn(`Local OCR processing failed for page ${pageNumber}:`, ocrErr);
        }
      }

      // Digital page: deterministic extraction
      if (pageText.length >= 30) {
        return this.extractQuestionsFromText(
          pageText,
          job,
          batchId,
          pageNumber,
          answerKeyMap,
          existingQuestions,
          subjects,
          topics,
          'DIGITAL_TEXT'
        );
      }

      return [];
    }

    // -------------------------------------------------------------
    // Path B: AI-Assisted Mode (Optional Gemini Enhancement)
    // -------------------------------------------------------------
    let pageImage = '';
    if (isScanned || job.config?.extractImages) {
      try {
        pageImage = await renderPdfPageToDataUrl(pdfDoc, pageNumber, 1.5);
      } catch (imgErr) {
        console.warn(`Could not render page ${pageNumber} to image:`, imgErr);
      }
    }

    let aiSuccess = false;
    let rawAiQuestions: any[] = [];

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        const resp = await fetch('/api/pdf-process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            pageText,
            pageImage,
            pageNumber,
            isScanned,
            defaults: job.defaults,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data.success && Array.isArray(data.questions)) {
            rawAiQuestions = data.questions;
            aiSuccess = true;
          }
        } else {
          console.warn(`/api/pdf-process returned status ${resp.status}:`, await resp.text());
        }
      }
    } catch (apiErr) {
      console.warn(`Server AI endpoint call failed for page ${pageNumber}:`, apiErr);
    }

    if (aiSuccess && rawAiQuestions.length > 0) {
      const results: StagedQuestion[] = [];

      for (const raw of rawAiQuestions) {
        const qNum = raw.sourceQuestionNumber || '';
        const qText = (raw.questionText || '').trim();
        if (!qText) continue;

        // Anti-Hallucination Answer Reconciliation:
        // Official answer key strictly overrides AI suggestions
        const ansResolution = matchQuestionAnswer(
          qNum,
          raw.correctAnswer,
          answerKeyMap
        );

        // Visual diagram requirement detection
        const isVisualRequired = !!raw.questionImageRequired || /figure|diagram|chart|table-image|geometry|map/i.test(qText);
        const warnings = [...(raw.warnings || [])];
        if (isVisualRequired) {
          warnings.push('⚠️ Visual content required: Diagram / Figure detected on source page');
        }
        if (ansResolution.warning) {
          warnings.push(ansResolution.warning);
        }

        // Deterministic taxonomy classification
        const taxonomy = matchDeterministicTaxonomy(
          qText,
          raw.explanation || '',
          subjects,
          topics,
          { subject: raw.subject || job.defaults.subject, topic: raw.topic || job.defaults.topic }
        );
        if (taxonomy.warning) {
          warnings.push(taxonomy.warning);
        }

        const dupCheck = checkDuplicate(qText, existingQuestions);
        const parsedSource = this.extractStructuredSourceFromText(qText);

        const stagedId = `staged_${job.id}_p${pageNumber}_q${qNum}_${Math.random().toString(36).substr(2, 6)}`;
        const staged: StagedQuestion = {
          id: stagedId,
          jobId: job.id,
          batchId,
          question_text: parsedSource.cleanText,
          option_a_text: raw.options?.A || '',
          option_b_text: raw.options?.B || '',
          option_c_text: raw.options?.C || '',
          option_d_text: raw.options?.D || '',
          correct_answer: ansResolution.finalAnswer,
          explanation_text: raw.explanation || '',
          exam: job.defaults.exam || 'ANCHSL',
          category: job.defaults.category,
          subject: taxonomy.subject,
          chapter: raw.chapter || job.defaults.chapter,
          topic: taxonomy.topic,
          difficulty: raw.difficulty || job.defaults.difficulty || 'Medium',
          positive_marks: job.defaults.positiveMarks ?? 2.0,
          negative_marks: job.defaults.negativeMarks ?? 0.5,
          language: raw.language || job.defaults.language || 'both',
          year: job.defaults.year,
          source_exam: parsedSource.sourceExam,
          sourceExam: parsedSource.sourceExam,
          exam_date: parsedSource.examDate,
          examDate: parsedSource.examDate,
          shift: parsedSource.shift,

          source_pdf: job.fileName,
          source_page: pageNumber,
          source_question_number: qNum,

          confidence_score: 100,
          confidence_level: 'HIGH',
          review_status: 'pending',
          answer_source: ansResolution.answerSource,
          validation_warnings: warnings,
          is_duplicate: dupCheck.isDuplicate,
          duplicate_of_id: dupCheck.duplicateOfId,
          duplicate_type: dupCheck.duplicateType,
          admin_notes: isVisualRequired ? 'IMAGE_REVIEW_REQUIRED' : undefined,
        };

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

    // Fallback if AI was requested but failed: extract locally
    if (pageText.length >= 30) {
      const fallbackQuestions = this.extractQuestionsFromText(
        pageText,
        job,
        batchId,
        pageNumber,
        answerKeyMap,
        existingQuestions,
        subjects,
        topics,
        'DIGITAL_TEXT'
      );

      for (const q of fallbackQuestions) {
        q.validation_warnings.push('⚠️ Processed via deterministic parser (AI endpoint was unreachable)');
      }

      return fallbackQuestions;
    }

    return [];
  }

  /**
   * Safely inspects question text for high-confidence trailing source metadata.
   */
  private extractStructuredSourceFromText(text: string): {
    cleanText: string;
    sourceExam?: string;
    examDate?: string;
    shift?: string;
  } {
    const trailingMetaMatch = text.match(
      /(?:[\r\n\s]+|[\(\[])((?:SSC\s+(?:CGL|CHSL|MTS|CPO|GD|JE|Stenographer)|A\s*&\s*N\s+(?:CGL|CHSL|POLICE|MTS)|Police|CGL|CHSL|MTS)[\s\w\&\-\/\.]*?(?:(?:\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b)|(?:\b(?:19|20)\d{2}\b))[\s\w\(\)\-\/\:\.]*?)[\)\]]?\s*$/i
    );

    if (!trailingMetaMatch || trailingMetaMatch.index === undefined) {
      return { cleanText: text };
    }

    const rawMeta = trailingMetaMatch[1];
    const examMatch = rawMeta.match(/(SSC\s+(?:CGL|CHSL|MTS|CPO|GD|JE|Stenographer)|A\s*&\s*N\s+(?:CGL|CHSL|POLICE|MTS)|Police|CGL|CHSL|MTS)/i);
    const dateMatch = rawMeta.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\b(?:19|20)\d{2}\b)/);
    const shiftMatch = rawMeta.match(/((?:Shift|Tier)[\s\-]*[0-9]+)/i);

    const cleaned = text.slice(0, trailingMetaMatch.index).trim();
    return {
      cleanText: cleaned.length >= 5 ? cleaned : text,
      sourceExam: examMatch ? examMatch[1].trim() : undefined,
      examDate: dateMatch ? dateMatch[1].trim() : undefined,
      shift: shiftMatch ? shiftMatch[1].replace(/[\s\-]+/g, ' ').trim() : undefined,
    };
  }

  /**
   * Deterministic pattern extractor for clean digital exam text and local OCR output.
   * Extracts MCQs, options (A-D or 1-4), answer keys, explanations, diagrams, and taxonomies.
   */
  public extractQuestionsFromText(
    pageText: string,
    job: PdfImportJob,
    batchId: string,
    pageNumber: number,
    answerKeyMap: Map<number, 'A' | 'B' | 'C' | 'D'>,
    existingQuestions: Question[],
    subjects: Subject[] = [],
    topics: Topic[] = [],
    extractionType: 'DIGITAL_TEXT' | 'OCR_AI' = 'DIGITAL_TEXT'
  ): StagedQuestion[] {
    const results: StagedQuestion[] = [];
    if (!pageText || pageText.trim().length < 20) return results;

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

      // Extract options: (A), (B), (C), (D) or (1), (2), (3), (4) or A., B., C., D.
      const optRegex = /(?:\n|^|\s)(?:[\(\[]([A-Da-d1-4])[\)\]]|([A-Da-d])[\)\]\.:\-])\s*([^\n\(\[]+)/g;
      const optionsMap: Record<string, string> = { A: '', B: '', C: '', D: '' };

      const mapOptionLetter = (raw: string): 'A' | 'B' | 'C' | 'D' | null => {
        const u = raw.toUpperCase();
        if (u === 'A' || u === '1') return 'A';
        if (u === 'B' || u === '2') return 'B';
        if (u === 'C' || u === '3') return 'C';
        if (u === 'D' || u === '4') return 'D';
        return null;
      };

      let optMatch: RegExpExecArray | null;
      let firstOptIndex = questionBlock.length;

      while ((optMatch = optRegex.exec(questionBlock)) !== null) {
        const rawLetter = optMatch[1] || optMatch[2];
        const mappedLetter = mapOptionLetter(rawLetter);
        const optVal = optMatch[3].trim();
        if (mappedLetter && !optionsMap[mappedLetter]) {
          optionsMap[mappedLetter] = optVal;
          if (optMatch.index < firstOptIndex) {
            firstOptIndex = optMatch.index;
          }
        }
      }

      // Question body is text before the first option
      let qText = questionBlock.slice(0, firstOptIndex).trim();
      qText = qText.replace(/^(?:Q\.?|Que\.?|Question)?\s*\d{1,4}[\s.:\-–)]+/, '').trim();
      if (!qText || qText.length < 5) continue;

      // Extract inline answer if present
      const inlineAnsMatch = questionBlock.match(/(?:Ans|Answer)[\s.:\-–—]*\(?([A-Da-d1-4])\)?/i);
      const rawInline = inlineAnsMatch ? inlineAnsMatch[1] : undefined;
      const inlineAns = rawInline ? mapOptionLetter(rawInline) || undefined : undefined;

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

      // Visual diagram detection
      const isVisualRequired = /figure|diagram|chart|map|geometry|table/i.test(qText);
      const warnings: string[] = [];
      if (isVisualRequired) {
        warnings.push('⚠️ Visual content required: Diagram / Figure detected on source page');
      }
      if (ansResolution.warning) {
        warnings.push(ansResolution.warning);
      }

      // Deterministic taxonomy classification
      const taxonomy = matchDeterministicTaxonomy(
        qText,
        explanation,
        subjects,
        topics,
        { subject: job.defaults.subject, topic: job.defaults.topic }
      );
      if (taxonomy.warning) {
        warnings.push(taxonomy.warning);
      }

      const dupCheck = checkDuplicate(qText, existingQuestions);
      const parsedSource = this.extractStructuredSourceFromText(qText);
      const stagedId = `staged_${job.id}_p${pageNumber}_q${current.qNum}_${Math.random().toString(36).substr(2, 6)}`;

      const staged: StagedQuestion = {
        id: stagedId,
        jobId: job.id,
        batchId,
        question_text: parsedSource.cleanText,
        option_a_text: optionsMap.A,
        option_b_text: optionsMap.B,
        option_c_text: optionsMap.C,
        option_d_text: optionsMap.D,
        correct_answer: ansResolution.finalAnswer,
        explanation_text: explanation,
        exam: job.defaults.exam || 'ANCHSL',
        category: job.defaults.category,
        subject: taxonomy.subject,
        chapter: job.defaults.chapter,
        topic: taxonomy.topic,
        difficulty: job.defaults.difficulty || 'Medium',
        positive_marks: job.defaults.positiveMarks ?? 2.0,
        negative_marks: job.defaults.negativeMarks ?? 0.5,
        language: job.defaults.language || 'both',
        year: job.defaults.year,
        source_exam: parsedSource.sourceExam,
        sourceExam: parsedSource.sourceExam,
        exam_date: parsedSource.examDate,
        examDate: parsedSource.examDate,
        shift: parsedSource.shift,

        source_pdf: job.fileName,
        source_page: pageNumber,
        source_question_number: current.qNum,

        confidence_score: 100,
        confidence_level: 'HIGH',
        review_status: 'pending',
        answer_source: ansResolution.answerSource,
        validation_warnings: warnings,
        is_duplicate: dupCheck.isDuplicate,
        duplicate_of_id: dupCheck.duplicateOfId,
        duplicate_type: dupCheck.duplicateType,
        admin_notes: isVisualRequired ? 'IMAGE_REVIEW_REQUIRED' : undefined,
      };

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
export const aiBatchProcessor = new AiBatchProcessor();
