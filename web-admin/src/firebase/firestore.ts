import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  writeBatch,
  where,
  addDoc
} from 'firebase/firestore';
import { db, auth } from './config';
import {
  ExamCategory,
  Exam,
  Subject,
  Topic,
  Question,
  MockTest,
  HomeBanner,
  AppNotice,
  AppConfig,
  AdminActivity
} from '../types';

// Audit Log Helper
export async function logActivity(action: string, details: string) {
  try {
    const adminEmail = auth.currentUser?.email || 'System';
    await addDoc(collection(db, 'admin_activity'), {
      adminEmail,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to log admin activity:', err);
  }
}

// 1. Categories
export async function fetchCategories(): Promise<ExamCategory[]> {
  const snap = await getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExamCategory));
}

export async function saveCategory(cat: ExamCategory): Promise<void> {
  await setDoc(doc(db, 'categories', cat.id), cat, { merge: true });
  await logActivity('Save Category', `Category ${cat.name} (${cat.code}) updated/created`);
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, 'categories', id));
  await logActivity('Delete Category', `Deleted category ID: ${id}`);
}

// 2. Exams
export async function fetchExams(): Promise<Exam[]> {
  const snap = await getDocs(query(collection(db, 'exams'), orderBy('order', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Exam));
}

export async function saveExam(exam: Exam): Promise<void> {
  await setDoc(doc(db, 'exams', exam.id), exam, { merge: true });
  await logActivity('Save Exam', `Exam ${exam.name} (${exam.code}) saved`);
}

export async function deleteExam(id: string): Promise<void> {
  await deleteDoc(doc(db, 'exams', id));
  await logActivity('Delete Exam', `Deleted exam ID: ${id}`);
}

// 3. Subjects & Topics
export async function fetchSubjects(): Promise<Subject[]> {
  const snap = await getDocs(collection(db, 'subjects'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject));
}

export async function saveSubject(sub: Subject): Promise<void> {
  await setDoc(doc(db, 'subjects', sub.id), sub, { merge: true });
  await logActivity('Save Subject', `Subject ${sub.name} saved`);
}

export async function deleteSubject(id: string): Promise<void> {
  await deleteDoc(doc(db, 'subjects', id));
  await logActivity('Delete Subject', `Deleted subject ID: ${id}`);
}

export async function fetchTopics(subjectId?: string): Promise<Topic[]> {
  let q = collection(db, 'topics');
  if (subjectId) {
    const snap = await getDocs(query(q, where('subjectId', '==', subjectId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Topic));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Topic));
}

export async function saveTopic(topic: Topic): Promise<void> {
  await setDoc(doc(db, 'topics', topic.id), topic, { merge: true });
}

export async function deleteTopic(id: string): Promise<void> {
  await deleteDoc(doc(db, 'topics', id));
}

// 4. Question Bank
export async function fetchQuestions(maxCount: number = 200): Promise<Question[]> {
  const snap = await getDocs(query(collection(db, 'questions'), limit(maxCount)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Question));
}

export async function saveQuestion(question: Question): Promise<void> {
  await setDoc(doc(db, 'questions', question.id), {
    ...question,
    updated_at: new Date().toISOString(),
  }, { merge: true });
  await logActivity('Save Question', `Question ${question.id} saved`);
}

export async function deleteQuestion(id: string): Promise<void> {
  await deleteDoc(doc(db, 'questions', id));
  await logActivity('Delete Question', `Deleted question ID: ${id}`);
}

export async function bulkDeleteQuestions(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.delete(doc(db, 'questions', id));
  }
  await batch.commit();
  await logActivity('Bulk Delete Questions', `Deleted ${ids.length} questions`);
}

// Chunked Batch Writer for Bulk Import (protects against Firestore 500 limit)
export async function batchInsertQuestions(
  questions: Question[],
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  const total = questions.length;
  let inserted = 0;
  const chunkSize = 400;

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = questions.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const q of chunk) {
      const ref = doc(db, 'questions', q.id);
      batch.set(ref, {
        ...q,
        created_at: q.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { merge: true });
    }

    await batch.commit();
    inserted += chunk.length;
    onProgress?.(inserted, total);
  }

  await logActivity('Bulk Import Questions', `Successfully imported ${inserted} questions`);
  return inserted;
}

// 5. Mock Tests
export async function fetchMockTests(): Promise<MockTest[]> {
  const snap = await getDocs(collection(db, 'mocks'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MockTest));
}

export async function saveMockTest(test: MockTest): Promise<void> {
  await setDoc(doc(db, 'mocks', test.id), test, { merge: true });
  await logActivity('Save Mock Test', `Test ${test.title} (${test.isFree ? 'FREE' : 'PAID: ₹' + test.price}) saved`);
}

export async function deleteMockTest(id: string): Promise<void> {
  await deleteDoc(doc(db, 'mocks', id));
  await logActivity('Delete Mock Test', `Deleted mock test ID: ${id}`);
}

// 6. App Content: Banners, Notices, Config
export async function fetchBanners(): Promise<HomeBanner[]> {
  const snap = await getDocs(query(collection(db, 'banners'), orderBy('order', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as HomeBanner));
}

export async function saveBanner(banner: HomeBanner): Promise<void> {
  await setDoc(doc(db, 'banners', banner.id), banner, { merge: true });
}

export async function deleteBanner(id: string): Promise<void> {
  await deleteDoc(doc(db, 'banners', id));
}

export async function fetchNotices(): Promise<AppNotice[]> {
  const snap = await getDocs(query(collection(db, 'notices'), orderBy('date', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotice));
}

export async function saveNotice(notice: AppNotice): Promise<void> {
  await setDoc(doc(db, 'notices', notice.id), notice, { merge: true });
}

export async function deleteNotice(id: string): Promise<void> {
  await deleteDoc(doc(db, 'notices', id));
}

export async function fetchAppConfig(): Promise<AppConfig | null> {
  const snap = await getDoc(doc(db, 'app_config', 'main'));
  if (snap.exists()) {
    return snap.data() as AppConfig;
  }
  return null;
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  await setDoc(doc(db, 'app_config', 'main'), config, { merge: true });
  await logActivity('Update App Config', 'Application configuration updated');
}

// 7. Question of the Day (QOTD)
export async function fetchQOTDList(): Promise<any[]> {
  try {
    const snap = await getDocs(query(collection(db, 'qotd'), orderBy('date', 'desc'), limit(30)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('Failed to fetch QOTD list:', err);
    return [];
  }
}

export async function saveQOTD(qotd: { id: string; date: string; questionId: string; questionText?: string; options?: string[]; correctAnswer?: string; explanation?: string; active?: boolean }): Promise<void> {
  await setDoc(doc(db, 'qotd', qotd.id), qotd, { merge: true });
  // Also update 'current' doc for easy student app access
  await setDoc(doc(db, 'qotd', 'current'), qotd, { merge: true });
  await logActivity('Save QOTD', `Question of the Day set for date ${qotd.date}`);
}

export async function deleteQOTD(id: string): Promise<void> {
  await deleteDoc(doc(db, 'qotd', id));
  await logActivity('Delete QOTD', `Deleted QOTD ID: ${id}`);
}

export async function fetchRecentActivities(count: number = 10): Promise<AdminActivity[]> {
  try {
    const snap = await getDocs(query(collection(db, 'admin_activity'), orderBy('timestamp', 'desc'), limit(count)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminActivity));
  } catch (_) {
    return [];
  }
}
