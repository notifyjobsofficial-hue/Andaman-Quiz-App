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
  addDoc,
  DocumentReference,
  CollectionReference,
  SetOptions
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

/**
 * Recursively sanitizes any payload destined for Cloud Firestore:
 * 1. Omit all keys with `undefined` values (Cloud Firestore throws: "Unsupported field value: undefined").
 * 2. Omit or filter `NaN` and infinite numeric values.
 * 3. Omit invalid Date objects (isNaN(date.getTime())).
 * 4. Recursively sanitize nested objects and arrays.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  if (typeof data === 'number') {
    if (Number.isNaN(data) || !Number.isFinite(data)) {
      return null as any;
    }
    return data;
  }
  if (data instanceof Date) {
    if (Number.isNaN(data.getTime())) {
      return null as any;
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined && item !== null) as any;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(data as Record<string, any>)) {
      if (val === undefined) {
        continue; // omit undefined keys completely
      }
      if (typeof val === 'number' && (Number.isNaN(val) || !Number.isFinite(val))) {
        continue; // omit NaN / infinite numbers
      }
      if (val instanceof Date && Number.isNaN(val.getTime())) {
        continue; // omit invalid Dates
      }
      const sanitizedVal = sanitizeForFirestore(val);
      if (sanitizedVal !== undefined) {
        cleaned[key] = sanitizedVal;
      }
    }
    return cleaned as any;
  }
  return data;
}

/**
 * Safe Firestore setDoc wrapper that automatically sanitizes all data before writing.
 */
export async function safeSetDoc<T>(
  docRef: DocumentReference,
  data: T,
  options?: SetOptions
): Promise<void> {
  const cleanData: any = sanitizeForFirestore(data);
  return options ? setDoc(docRef, cleanData, options) : setDoc(docRef, cleanData);
}

/**
 * Safe Firestore addDoc wrapper that automatically sanitizes all data before writing.
 */
export async function safeAddDoc<T>(
  collRef: CollectionReference,
  data: T
): Promise<DocumentReference> {
  const cleanData: any = sanitizeForFirestore(data);
  return addDoc(collRef, cleanData);
}

// Audit Log Helper
export async function logActivity(action: string, details: string) {
  try {
    const adminEmail = auth.currentUser?.email || 'System';
    await safeAddDoc(collection(db, 'admin_activity'), {
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
  await safeSetDoc(doc(db, 'categories', cat.id), cat, { merge: true });
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
  await safeSetDoc(doc(db, 'exams', exam.id), exam, { merge: true });
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
  await safeSetDoc(doc(db, 'subjects', sub.id), sub, { merge: true });
  await logActivity('Save Subject', `Subject ${sub.name} saved`);
}

export async function deleteSubject(id: string): Promise<void> {
  await deleteDoc(doc(db, 'subjects', id));
  await logActivity('Delete Subject', `Deleted subject ID: ${id}`);
}

export async function fetchTopics(subjectId?: string): Promise<Topic[]> {
  const q = collection(db, 'topics');
  if (subjectId) {
    const snap = await getDocs(query(q, where('subjectId', '==', subjectId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Topic));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Topic));
}

export async function saveTopic(topic: Topic): Promise<void> {
  await safeSetDoc(doc(db, 'topics', topic.id), topic, { merge: true });
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
  const payload = {
    ...question,
    updated_at: new Date().toISOString(),
  };
  await safeSetDoc(doc(db, 'questions', question.id), payload, { merge: true });
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

    for (let idx = 0; idx < chunk.length; idx++) {
      const q = chunk[idx];
      const rowNum = i + idx + 2;
      const ref = doc(db, 'questions', q.id);

      const rawData = {
        ...q,
        created_at: q.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const cleanData = sanitizeForFirestore(rawData);
      try {
        batch.set(ref, cleanData, { merge: true });
      } catch (err: any) {
        throw new Error(`Row ${rowNum} ("${(q.question_text || q.id).slice(0, 30)}..."): ${err.message}`);
      }
    }

    try {
      await batch.commit();
    } catch (batchErr: any) {
      throw new Error(`Firestore batch write failed for rows ${i + 2} to ${i + chunk.length + 1}: ${batchErr.message}`);
    }

    inserted += chunk.length;
    onProgress?.(inserted, total);
  }

  await logActivity('Bulk Import Questions', `Successfully imported ${inserted} questions`);
  return inserted;
}

// 5. Mock Tests
export async function fetchMockTests(): Promise<MockTest[]> {
  const map = new Map<string, MockTest>();
  try {
    const snapMockTests = await getDocs(collection(db, 'mock_tests'));
    snapMockTests.docs.forEach((d) => {
      map.set(d.id, { id: d.id, ...d.data() } as MockTest);
    });
  } catch (err) {
    console.warn('Notice querying mock_tests:', err);
  }

  try {
    const snapMocks = await getDocs(collection(db, 'mocks'));
    snapMocks.docs.forEach((d) => {
      if (!map.has(d.id)) {
        map.set(d.id, { id: d.id, ...d.data() } as MockTest);
      }
    });
  } catch (err) {
    console.warn('Notice querying mocks:', err);
  }

  return Array.from(map.values());
}

export async function saveMockTest(test: MockTest): Promise<void> {
  const payload: any = { ...test };

  // For FREE tests: productId, price, originalPrice, offerPrice must be omitted from Firestore
  if (payload.isFree) {
    delete payload.price;
    delete payload.originalPrice;
    delete payload.offerPrice;
    delete payload.productId;
  }

  // If not scheduled / live, clean up start/end dates
  if (!payload.isLive) {
    delete payload.startDate;
    delete payload.endDate;
  }

  // Save to BOTH 'mock_tests' and 'mocks' collections for complete project-wide compatibility
  await safeSetDoc(doc(db, 'mock_tests', test.id), payload, { merge: true });
  await safeSetDoc(doc(db, 'mocks', test.id), payload, { merge: true });
  await logActivity('Save Mock Test', `Test ${test.title} (${test.isFree ? 'FREE' : 'PAID: ₹' + (test.offerPrice || test.price || 0)}) saved`);
}

export async function deleteMockTest(id: string): Promise<void> {
  await deleteDoc(doc(db, 'mock_tests', id));
  await deleteDoc(doc(db, 'mocks', id));
  await logActivity('Delete Mock Test', `Deleted mock test ID: ${id}`);
}

// 6. App Content: Banners, Notices, Config
export async function fetchBanners(): Promise<HomeBanner[]> {
  const snap = await getDocs(query(collection(db, 'banners'), orderBy('order', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as HomeBanner));
}

export async function saveBanner(banner: HomeBanner): Promise<void> {
  await safeSetDoc(doc(db, 'banners', banner.id), banner, { merge: true });
}

export async function deleteBanner(id: string): Promise<void> {
  await deleteDoc(doc(db, 'banners', id));
}

export async function fetchNotices(): Promise<AppNotice[]> {
  const snap = await getDocs(query(collection(db, 'notices'), orderBy('date', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotice));
}

export async function saveNotice(notice: AppNotice): Promise<void> {
  await safeSetDoc(doc(db, 'notices', notice.id), notice, { merge: true });
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
  await safeSetDoc(doc(db, 'app_config', 'main'), config, { merge: true });
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

export async function saveQOTD(qotd: {
  id: string;
  date: string;
  questionId: string;
  questionText?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  active?: boolean;
}): Promise<void> {
  await safeSetDoc(doc(db, 'qotd', qotd.id), qotd, { merge: true });
  // Also update 'current' doc for easy student app access
  await safeSetDoc(doc(db, 'qotd', 'current'), qotd, { merge: true });
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
