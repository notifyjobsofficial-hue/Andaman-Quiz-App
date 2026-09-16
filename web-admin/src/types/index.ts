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
  negativeMarks: number;
  attemptsCount: number;
  isFree: boolean;
  price?: number;
  originalPrice?: number;
  offerPrice?: number;
  description?: string;
  instructions?: string;
  status: 'published' | 'draft' | 'archived';
  language: 'en' | 'hi' | 'both';
  displayOrder: number;
  isLive: boolean;
  isPreviousYear: boolean;
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
}

export interface QuestionOfTheDay {
  id: string;
  date: string; // YYYY-MM-DD
  questionId: string;
  question: Question;
}

export interface AppConfig {
  id: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  supportEmail: string;
  whatsappUrl?: string;
  telegramUrl?: string;
  officialWebsiteUrl?: string;
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
