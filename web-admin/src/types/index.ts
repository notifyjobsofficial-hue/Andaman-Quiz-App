export interface ExamCategory {
  id: string;
  name: string;
  code: string;
  order: number;
  isActive: boolean;
}

export interface Exam {
  id: string;
  name: string;
  code: string;
  description: string;
  totalQuestions: number;
  iconName: string;
  categoryId?: string;
  order: number;
  isEnabled: boolean;
}

export interface Subject {
  id: string;
  name: string;
  hindiName: string;
  iconName: string;
  questionCount: number;
  examCodes: string[];
  isAndamanSpecial: boolean;
  order?: number;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  hindiName: string;
  questionCount: number;
}

export interface Question {
  id: string;
  question_text: string;
  question_image_url?: string;
  option_a_text: string;
  option_a_image_url?: string;
  option_b_text: string;
  option_b_image_url?: string;
  option_c_text: string;
  option_c_image_url?: string;
  option_d_text: string;
  option_d_image_url?: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation_text: string;
  explanation_image_url?: string;
  exam: string;
  category?: string;
  subject: string;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  positive_marks: number;
  negative_marks: number;
  language: 'en' | 'hi' | 'both';
  year?: string;
  status: 'published' | 'draft' | 'archived';
  created_at?: string;
  updated_at?: string;
}

export interface TestSection {
  id: string;
  name: string;
  hindiName?: string;
  questionIds: string[];
}

export interface MockTest {
  id: string;
  title: string;
  examCode: string;
  categoryId?: string;
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  positiveMarks?: number;
  negativeMarks: number;
  attemptsCount: number;
  isFree: boolean;
  price?: number;
  originalPrice?: number;
  offerPrice?: number;
  productId?: string; // Google Play Store SKU / Product ID for paid mocks
  description?: string;
  instructions?: string;
  status: 'published' | 'draft' | 'archived';
  language: 'en' | 'hi' | 'both';
  displayOrder: number;
  isLive: boolean;
  isFeatured?: boolean;
  isPreviousYear: boolean;
  startDate?: string;
  endDate?: string;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showResultImmediately?: boolean;
  showExplanation?: boolean;
  sections: TestSection[];
  created_at?: string;
}

export interface HomeBanner {
  id: string;
  title: string;
  imageUrl: string;
  targetRoute: string;
  active: boolean;
  order: number;
}

export interface AppNotice {
  id: string;
  title: string;
  body: string;
  date: string;
  active: boolean;
  isPinned: boolean;
  type?: 'JOB' | 'ADMIT_CARD' | 'RESULT' | 'ANSWER_KEY' | 'EXAM_DATE' | 'NOTICE';
  shortDescription?: string;
  content?: string;
  organization?: string;
  exam?: string;
  imageUrl?: string;
  pdfUrl?: string;
  officialUrl?: string;
  applyUrl?: string;
  externalUrl?: string;
  publishAt?: string;
  expiresAt?: string;
  status?: 'published' | 'draft' | 'scheduled';
  pinned?: boolean;
  primaryUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LiveTestItem {
  id: string;
  mockTestId: string;
  title: string;
  startAt: string;
  endAt: string;
  instructions?: string;
  featured: boolean;
  isPublished: boolean;
  allowEarlyJoin: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface QuestionOfTheDay {
  id: string;
  date: string; // YYYY-MM-DD
  questionId: string;
  questionText?: string;
  questionImageUrl?: string;
  options?: string[];
  optionImages?: string[];
  correctAnswer?: string;
  correctIndex?: number;
  explanation?: string;
  explanationImageUrl?: string;
  exam?: string;
  examName?: string;
  source?: string;
  year?: string;
  shift?: string;
  examDate?: string;
  topic?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  durationSeconds?: number;
  publishedDate?: string;
  active?: boolean;
}

export interface AppConfig {
  id: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  supportEmail: string;
  whatsappUrl?: string;
  telegramUrl?: string;
  officialWebsiteUrl?: string;
  adsEnabled: boolean;
  freeTestResultAdEnabled: boolean;
  quizResultAdEnabled: boolean;
  adFrequency: number;
  admobBannerId?: string;
  admobInterstitialId?: string;
}

export interface AdminActivity {
  id: string;
  adminEmail: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface AdminUser {
  uid: string;
  email: string;
  role: 'superadmin' | 'editor';
  createdAt: string;
}

// ==========================================
// AI PDF Import & Human Review System Types
// ==========================================

export type ImportMode =
  | 'questions_key'
  | 'questions_answers_explanations'
  | 'previous_year'
  | 'question_bank';

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ConfidenceLevel = 'HIGH' | 'REVIEW' | 'ERROR' | 'MEDIUM' | 'LOW';

export type AnswerSource = 'SOURCE_ANSWER' | 'AI_INFERRED' | 'UNRESOLVED';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'skipped';

export type ExtractionMode = 'free_local' | 'ai_assisted';

export interface JobDefaults {
  exam?: string;
  category?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  language?: 'en' | 'hi' | 'both';
  positiveMarks?: number;
  negativeMarks?: number;
  year?: string;
}

export interface JobConfig {
  extractionMode?: ExtractionMode; // 'free_local' (default, ₹0 API usage) or 'ai_assisted'
  autoDetectTaxonomy: boolean;
  autoDetectDifficulty: boolean;
  extractImages: boolean;
  ocrEnabled?: boolean;
}

export interface JobProgress {
  currentBatch: number;
  totalBatches: number;
  processedPages: number;
  totalPages: number;
  ocrProgress?: number;
}

export interface JobMetrics {
  detectedQuestions: number;
  highConfidence: number;
  needsReview: number;
  errors: number;
  approved: number;
  rejected: number;
  pendingReview: number;
  duplicates: number;
}

export interface PdfImportJob {
  id: string;
  fileName: string;
  storagePath: string;
  fileSize: number;
  totalPages: number;
  status: JobStatus;
  importMode: ImportMode;
  defaults: JobDefaults;
  config: JobConfig;
  progress: JobProgress;
  metrics: JobMetrics;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  error?: string;
  aiUsage?: {
    totalTokens: number;
    estimatedCostUsd: number;
    modelUsed: string;
  };
}

export interface PdfBatch {
  id: string;
  jobId: string;
  batchIndex: number;
  startPage: number;
  endPage: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  questionsDetected: number;
  error?: string;
  retries: number;
  updatedAt?: string;
}

export interface StagedQuestion {
  id: string;
  jobId: string;
  batchId: string;
  question_text: string;
  question_image_url?: string;
  option_a_text: string;
  option_a_image_url?: string;
  option_b_text: string;
  option_b_image_url?: string;
  option_c_text: string;
  option_c_image_url?: string;
  option_d_text: string;
  option_d_image_url?: string;
  correct_answer: 'A' | 'B' | 'C' | 'D' | '';
  explanation_text: string;
  explanation_image_url?: string;
  exam: string;
  category?: string;
  subject: string;
  chapter?: string;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  positive_marks: number;
  negative_marks: number;
  language: 'en' | 'hi' | 'both';
  year?: string;

  // Source Traceability
  source_pdf: string;
  source_page: number;
  source_question_number: number | string;
  page_image_url?: string;
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Confidence & Verification Engine
  confidence_score: number; // 0 to 100
  confidence_level: ConfidenceLevel;
  review_status: ReviewStatus;
  answer_source: AnswerSource;
  validation_warnings: string[];
  is_duplicate: boolean;
  duplicate_of_id?: string;
  duplicate_type?: 'EXACT' | 'NORMALIZED' | 'SIMILAR';
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  published_question_id?: string;
}

