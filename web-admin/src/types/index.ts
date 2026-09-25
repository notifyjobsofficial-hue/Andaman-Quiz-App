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
  questionImageUrl?: string;
  question_image_url?: string;
  option_a_text: string;
  optionAImageUrl?: string;
  option_a_image_url?: string;
  option_b_text: string;
  optionBImageUrl?: string;
  option_b_image_url?: string;
  option_c_text: string;
  optionCImageUrl?: string;
  option_c_image_url?: string;
  option_d_text: string;
  optionDImageUrl?: string;
  option_d_image_url?: string;
  optionImages?: string[];
  option_images?: string[];
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation_text: string;
  explanationImageUrl?: string;
  explanation_image_url?: string;
  exam: string;
  category?: string;
  subject: string;
  subjectId?: string;
  chapter?: string;
  chapterId?: string;
  topic: string;
  topicId?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  positive_marks: number;
  negative_marks: number;
  language: 'en' | 'hi' | 'both';
  year?: string;
  source_exam?: string;
  sourceExam?: string;
  exam_date?: string;
  examDate?: string;
  shift?: string;
  status: 'published' | 'draft' | 'archived';
  usageType?: 'PRACTICE' | 'MOCK' | 'BOTH' | 'NOT_USED';
  usage_type?: 'PRACTICE' | 'MOCK' | 'BOTH' | 'NOT_USED';
  source?: 'MANUAL' | 'BULK_IMPORT' | 'PDF_IMPORT';
  created_at?: string;
  updated_at?: string;
}

export interface QuestionUsageSummary {
  inPractice: boolean;
  practiceTaxonomy?: { exam: string; subject: string; topic: string };
  mockTests: { id: string; title: string; examCode: string }[];
  liveTests: { id: string; title: string; mockTestId: string }[];
  studentAvailable: boolean;
  statusBadge: 'PRACTICE' | 'MOCK' | 'BOTH' | 'NOT_USED';
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
  testId: string;
  mockTestId?: string;
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

export interface LiveTestRegistration {
  id: string;
  liveTestId: string;
  testId: string;
  studentName: string;
  mobile?: string;
  studentPhone?: string;
  installationId: string;
  registeredAt: string;
  paymentType: 'FREE' | 'PAID';
  entitlementStatus: string;
  status: 'REGISTERED' | 'STARTED' | 'SUBMITTED';
  startedAt?: string;
  submittedAt?: string;
  score?: number;
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

export interface FeatureFlags {
  practiceEnabled: boolean;
  mockEnabled: boolean;
  liveTestEnabled: boolean;
  reportingEnabled: boolean;
  battleEnabled: boolean;
  studyEnabled: boolean;
  careerEnabled: boolean;
  currentAffairsEnabled: boolean;
}

export interface AppConfig {
  id: string;
  appName?: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  supportEmail: string;
  supportPhone?: string;
  whatsappUrl?: string;
  telegramUrl?: string;
  officialWebsiteUrl?: string;
  privacyPolicyUrl?: string;
  termsConditionsUrl?: string;
  minSupportedVersion?: string;
  latestVersion?: string;
  forceUpdateEnabled?: boolean;
  playStoreUrl?: string;
  defaultExamCode?: string;
  dailyQuestionGoalDefault?: number;
  adsEnabled: boolean;
  freeTestResultAdEnabled: boolean;
  quizResultAdEnabled: boolean;
  adFrequency: number;
  admobBannerId?: string;
  admobInterstitialId?: string;
  featureFlags?: FeatureFlags;
}

// ==========================================
// Phase A: Admin-Controlled LMS Types
// ==========================================

// --- 1. Test Series & Folders ---
export interface TestSeries {
  id: string;
  title: string;
  examCode: string;
  description: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  isFree: boolean;
  price?: number;
  originalPrice?: number;
  offerPrice?: number;
  productId?: string;
  validityDays: number;
  isFeatured: boolean;
  sortOrder: number;
  status: 'draft' | 'published' | 'archived';
  totalTests: number;
  totalFolders: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TestSeriesFolder {
  id: string;
  seriesId: string;
  title: string;
  iconName?: string;
  sortOrder: number;
  isFree: boolean;
  itemCount: number;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface TestSeriesItem {
  id: string;
  seriesId: string;
  folderId: string;
  testId: string; // References canonical MockTest
  sortOrder: number;
  accessMode: 'FREE' | 'PAID' | 'SERIES_ONLY';
  unlockAt?: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

// --- 2. Study Library ---
export interface StudyFolder {
  id: string;
  examCode: string;
  title: string;
  description?: string;
  iconName?: string;
  sortOrder: number;
  isFree: boolean;
  itemCount: number;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export type StudyMaterialType =
  | 'PDF'
  | 'ARTICLE'
  | 'EXTERNAL_LINK'
  | 'IMAGE_NOTE'
  | 'SYLLABUS'
  | 'STRATEGY';

export interface StudyMaterial {
  id: string;
  folderId: string;
  examCode: string;
  subjectId?: string;
  topicId?: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  materialType: StudyMaterialType;
  fileUrl?: string;
  articleContent?: string;
  externalUrl?: string;
  isFree: boolean;
  downloadAllowed: boolean;
  sortOrder: number;
  isFeatured: boolean;
  status: 'draft' | 'published' | 'archived';
  publishDate: string;
  createdAt: string;
  updatedAt: string;
}

// --- 3. Battle / Competition Mode ---
export interface BattleItem {
  id: string;
  title: string;
  examCode: string;
  canonicalTestId: string;
  startAt: string;
  registrationDeadline: string;
  durationMinutes: number;
  maxParticipants?: number;
  isFree: boolean;
  entryFee?: number;
  prizeDescription?: string;
  leaderboardVisible: boolean;
  status: 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED';
  instructions?: string;
  participantCount: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BattleRegistration {
  id: string;
  battleId: string;
  testId: string;
  studentName: string;
  mobile?: string;
  installationId: string;
  registeredAt: string;
  status: 'REGISTERED' | 'LOBBY' | 'STARTED' | 'SUBMITTED';
  startedAt?: string;
  submittedAt?: string;
  clientScore?: number;
  clientAccuracy?: number;
  score?: number;
  accuracy?: number;
  timeTakenSeconds?: number;
  answers?: Record<string, any>;
  resultStatus: 'PENDING_VERIFICATION' | 'VERIFIED';
  verifiedScore?: number;
  verifiedAccuracy?: number;
  rank?: number;
  leaderboardTime?: number;
}

// --- 4. Question Reporting System ---
export type QuestionReportIssueType =
  | 'INCORRECT_QUESTION'
  | 'WRONG_ANSWER'
  | 'FORMATTING_ISSUE'
  | 'IMAGE_ISSUE'
  | 'EXPLANATION_ISSUE'
  | 'OTHER';

export type QuestionReportStatus = 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'REJECTED';

export interface QuestionReport {
  id: string;
  questionId: string;
  testId?: string;
  topicId?: string;
  issueType: QuestionReportIssueType;
  details?: string;
  installationId: string;
  status: QuestionReportStatus;
  adminNotes?: string;
  resolvedBy?: string;
  createdAt: string;
  resolvedAt?: string;
}

// --- 5. Career Goal & Roadmap ---
export interface CareerSelectionStage {
  stageNumber: number;
  title: string;
  description: string;
}

export interface CareerExamPatternSection {
  name: string;
  questions: number;
  marks: number;
}

export interface CareerExamPattern {
  totalMarks: number;
  durationMinutes: number;
  negativeMarking: string;
  sections: CareerExamPatternSection[];
}

export interface CareerGoal {
  id: string;
  examCode: string;
  title: string;
  department: string;
  overview: string;
  eligibilityAge: string;
  eligibilityQualification: string;
  domicileNotice?: string;
  selectionStages: CareerSelectionStage[];
  examPattern: CareerExamPattern;
  syllabusSummary: string;
  syllabusPdfUrl?: string;
  recommendedSeriesIds: string[];
  recommendedMaterialIds: string[];
  officialNotificationUrl?: string;
  applyOnlineUrl?: string;
  status: 'draft' | 'published';
  updatedAt: string;
}

// --- 6. Current Affairs ---
export interface CurrentAffairsItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  category: string;
  summary: string;
  content: string;
  imageUrl?: string;
  pdfUrl?: string;
  canonicalQuestionIds: string[];
  isFree: boolean;
  status: 'draft' | 'published' | 'archived';
  publishDate: string;
  createdAt: string;
  updatedAt: string;
}

// --- 7. Dynamic Home Section Config ---
export interface HomeSectionConfig {
  id: string;
  sectionType: string;
  titleOverride?: string;
  enabled: boolean;
  sortOrder: number;
  itemLimit?: number;
  examFilter?: string;
}

// --- 8. Entitlement Verification Item ---
export interface EntitlementItem {
  id: string;
  entitlementType: 'TEST' | 'SERIES' | 'STUDY_MATERIAL' | 'BUNDLE';
  isVerifiedOnServer: boolean;
  unlockedAt: string;
  orderId?: string;
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

export type AnswerSource = 'SOURCE_ANSWER' | 'AI_INFERRED' | 'UNRESOLVED' | 'MANUAL';

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
  questionImageUrl?: string;
  question_image_url?: string;
  option_a_text: string;
  optionAImageUrl?: string;
  option_a_image_url?: string;
  option_b_text: string;
  optionBImageUrl?: string;
  option_b_image_url?: string;
  option_c_text: string;
  optionCImageUrl?: string;
  option_c_image_url?: string;
  option_d_text: string;
  optionDImageUrl?: string;
  option_d_image_url?: string;
  correct_answer: 'A' | 'B' | 'C' | 'D' | '';
  explanation_text: string;
  explanationImageUrl?: string;
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
  source_exam?: string;
  sourceExam?: string;
  exam_date?: string;
  examDate?: string;
  shift?: string;
  usageType?: 'PRACTICE' | 'MOCK' | 'BOTH' | 'NOT_USED';
  usage_type?: 'PRACTICE' | 'MOCK' | 'BOTH' | 'NOT_USED';

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

