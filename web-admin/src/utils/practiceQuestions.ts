import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Question, Subject, Topic, Exam, MockTest } from '../types';
import { safeSetDoc, saveQuestion } from '../firebase/firestore';

/**
 * Checks if a question belongs to Student Practice (usageType is PRACTICE or BOTH).
 * Legacy fallback defaults to 'BOTH'.
 */
export function isPracticeQuestion(q: Question): boolean {
  const usage = (q.usageType || q.usage_type || 'BOTH').toUpperCase();
  return usage === 'PRACTICE' || usage === 'BOTH';
}

/**
 * Checks if a practice question needs topic/subject organization.
 * A question needs organization if it is practice-eligible, but:
 * - Has no subject or empty subject
 * - Has no topic or empty topic
 * - Topic is generic ('General', 'Unassigned', etc.)
 * - Has no subjectId
 */
export function isNeedsOrganization(q: Question): boolean {
  if (!isPracticeQuestion(q)) return false;
  const hasSubject = !!(q.subject && q.subject.trim());
  const hasTopic = !!(q.topic && q.topic.trim());
  if (!hasSubject || !hasTopic) return true;

  const topicLower = q.topic.trim().toLowerCase();
  if (topicLower === 'general' || topicLower === 'unassigned' || topicLower === 'miscellaneous') {
    return true;
  }
  return false;
}

/**
 * Gets all practice-eligible questions belonging to a given subject.
 */
export function getSubjectQuestions(subject: Subject, questions: Question[]): Question[] {
  const subId = subject.id;
  const subName = subject.name.trim().toLowerCase();

  return questions.filter((q) => {
    if (!isPracticeQuestion(q)) return false;
    if (q.subjectId && q.subjectId === subId) return true;
    if (q.subject && q.subject.trim().toLowerCase() === subName) return true;
    return false;
  });
}

/**
 * Gets all practice-eligible questions belonging to a given topic within a subject.
 */
export function getTopicQuestions(
  topic: Topic,
  subject: Subject,
  questions: Question[]
): Question[] {
  const subjectQs = getSubjectQuestions(subject, questions);
  const topicId = topic.id;
  const topicName = topic.name.trim().toLowerCase();

  return subjectQs.filter((q) => {
    if (q.topicId && q.topicId === topicId) return true;
    if (q.topic && q.topic.trim().toLowerCase() === topicName) return true;
    return false;
  });
}

/**
 * Calculates topic question breakdown (total, published, draft, archived).
 */
export function calculateTopicMetrics(
  topic: Topic,
  subject: Subject,
  questions: Question[]
): { total: number; published: number; draft: number; archived: number } {
  const qs = getTopicQuestions(topic, subject, questions);
  let published = 0;
  let draft = 0;
  let archived = 0;

  qs.forEach((q) => {
    const st = q.status || 'published';
    if (st === 'published') published++;
    else if (st === 'draft') draft++;
    else if (st === 'archived') archived++;
  });

  return {
    total: qs.length,
    published,
    draft,
    archived,
  };
}

/**
 * Calculates subject-level metrics and previews for topics.
 */
export function calculateSubjectMetrics(
  subject: Subject,
  topics: Topic[],
  questions: Question[]
): {
  totalQuestions: number;
  published: number;
  draft: number;
  topicCount: number;
  topicsBreakdown: Array<{ topic: Topic; count: number; published: number; draft: number }>;
} {
  const subjectQs = getSubjectQuestions(subject, questions);
  let published = 0;
  let draft = 0;

  subjectQs.forEach((q) => {
    const st = q.status || 'published';
    if (st === 'published') published++;
    else if (st === 'draft') draft++;
  });

  const subjectTopics = topics.filter((t) => t.subjectId === subject.id);
  const topicsBreakdown = subjectTopics.map((top) => {
    const m = calculateTopicMetrics(top, subject, subjectQs);
    return {
      topic: top,
      count: m.total,
      published: m.published,
      draft: m.draft,
    };
  });

  return {
    totalQuestions: subjectQs.length,
    published,
    draft,
    topicCount: subjectTopics.length,
    topicsBreakdown,
  };
}

/**
 * Calculates global top-level Practice summary counters.
 */
export function calculateGlobalPracticeMetrics(questions: Question[]): {
  totalPractice: number;
  publishedPractice: number;
  draftPractice: number;
  needsOrganization: number;
} {
  let totalPractice = 0;
  let publishedPractice = 0;
  let draftPractice = 0;
  let needsOrganization = 0;

  questions.forEach((q) => {
    if (!isPracticeQuestion(q)) return;
    totalPractice++;
    const st = q.status || 'published';
    if (st === 'published') publishedPractice++;
    else if (st === 'draft') draftPractice++;

    if (isNeedsOrganization(q)) {
      needsOrganization++;
    }
  });

  return {
    totalPractice,
    publishedPractice,
    draftPractice,
    needsOrganization,
  };
}

/**
 * Assigns one or more existing questions from Question Bank to a Topic.
 * - Updates topic, topicId, subject, subjectId, and exam
 * - Ensures usageType is PRACTICE (or BOTH if question is already used in a Mock Test)
 * - PRESERVES existing question status (does NOT silently publish drafts!)
 * - PRESERVES canonical question ID (NO DUPLICATES!)
 */
export async function assignQuestionsToTopic(
  questionIds: string[],
  targetTopic: Topic,
  targetSubject: Subject,
  targetExamCode: string,
  allQuestions: Question[],
  allMockTests: MockTest[]
): Promise<Question[]> {
  const idSet = new Set(questionIds);
  const targetQuestions = allQuestions.filter((q) => idSet.has(q.id));

  // Determine which questions are in mock tests
  const mockReferencedIds = new Set<string>();
  allMockTests.forEach((m) => {
    m.sections?.forEach((s) => {
      s.questionIds?.forEach((id) => mockReferencedIds.add(id));
    });
  });

  const updatedQuestions: Question[] = [];
  const batch = writeBatch(db);

  for (const q of targetQuestions) {
    const isInMock = mockReferencedIds.has(q.id);
    const newUsage = isInMock ? 'BOTH' : 'PRACTICE';

    const updated: Question = {
      ...q,
      exam: targetExamCode || q.exam,
      subject: targetSubject.name,
      subjectId: targetSubject.id,
      topic: targetTopic.name,
      topicId: targetTopic.id,
      usageType: newUsage,
      usage_type: newUsage,
      status: q.status || 'published', // preserves existing status!
      updated_at: new Date().toISOString(),
    };

    updatedQuestions.push(updated);
    batch.set(doc(db, 'questions', q.id), updated, { merge: true });
  }

  await batch.commit();
  return updatedQuestions;
}

/**
 * Moves questions from one topic to another.
 * Preserves question ID, status, and usageType.
 */
export async function moveQuestionsToTopic(
  questionIds: string[],
  targetTopic: Topic,
  targetSubject?: Subject,
  allQuestions: Question[] = []
): Promise<Question[]> {
  const idSet = new Set(questionIds);
  const targetQuestions = allQuestions.filter((q) => idSet.has(q.id));

  const updatedQuestions: Question[] = [];
  const batch = writeBatch(db);

  for (const q of targetQuestions) {
    const updated: Question = {
      ...q,
      topic: targetTopic.name,
      topicId: targetTopic.id,
      ...(targetSubject ? { subject: targetSubject.name, subjectId: targetSubject.id } : {}),
      updated_at: new Date().toISOString(),
    };

    updatedQuestions.push(updated);
    batch.set(doc(db, 'questions', q.id), updated, { merge: true });
  }

  await batch.commit();
  return updatedQuestions;
}

/**
 * Updates publication status of selected questions.
 * Decoupled from topic assignment and usageType.
 */
export async function bulkUpdateQuestionStatus(
  questionIds: string[],
  newStatus: 'published' | 'draft' | 'archived',
  allQuestions: Question[] = []
): Promise<Question[]> {
  const idSet = new Set(questionIds);
  const targetQuestions = allQuestions.filter((q) => idSet.has(q.id));

  const updatedQuestions: Question[] = [];
  const batch = writeBatch(db);

  for (const q of targetQuestions) {
    const updated: Question = {
      ...q,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    updatedQuestions.push(updated);
    batch.set(doc(db, 'questions', q.id), updated, { merge: true });
  }

  await batch.commit();
  return updatedQuestions;
}

/**
 * Removes selected questions from student practice.
 * - Does NOT delete the question document!
 * - If question is used in Mock Tests: sets usageType = 'MOCK'
 * - If question is not in Mock Tests: sets usageType = 'MOCK'
 * Preserves canonical ID and question data in Question Bank.
 */
export async function bulkRemoveFromPractice(
  questionIds: string[],
  allQuestions: Question[],
  allMockTests: MockTest[]
): Promise<Question[]> {
  const idSet = new Set(questionIds);
  const targetQuestions = allQuestions.filter((q) => idSet.has(q.id));

  const updatedQuestions: Question[] = [];
  const batch = writeBatch(db);

  for (const q of targetQuestions) {
    const updated: Question = {
      ...q,
      usageType: 'MOCK',
      usage_type: 'MOCK',
      updated_at: new Date().toISOString(),
    };

    updatedQuestions.push(updated);
    batch.set(doc(db, 'questions', q.id), updated, { merge: true });
  }

  await batch.commit();
  return updatedQuestions;
}
