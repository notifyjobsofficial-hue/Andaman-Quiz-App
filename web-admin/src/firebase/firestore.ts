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
  LiveTestItem,
  LiveTestRegistration,
  AppConfig,
  AdminActivity,
  TestSeries,
  TestSeriesFolder,
  TestSeriesItem,
  StudyFolder,
  StudyMaterial,
  BattleItem,
  BattleRegistration,
  QuestionReport,
  CareerGoal,
  CurrentAffairsItem,
  HomeSectionConfig
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
  if (cleanData && typeof cleanData === 'object') {
    for (const key of Object.keys(cleanData)) {
      if (cleanData[key] === undefined) {
        delete cleanData[key];
      }
    }
  }
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
  if (cleanData && typeof cleanData === 'object') {
    for (const key of Object.keys(cleanData)) {
      if (cleanData[key] === undefined) {
        delete cleanData[key];
      }
    }
  }
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

  // For FREE mocks: isFree is true, price is 0, paid fields are omitted
  if (payload.isFree) {
    payload.isFree = true;
    payload.price = 0;
    delete payload.productId;
    delete payload.originalPrice;
    delete payload.offerPrice;
  } else {
    payload.isFree = false;
    payload.price = Number(payload.price) || 0;
    if (payload.productId) {
      payload.productId = String(payload.productId).trim();
    }
  }

  // If not scheduled / live, clean up start/end dates
  if (!payload.isLive) {
    delete payload.startDate;
    delete payload.endDate;
  }

  // Before the FINAL setDoc() call, sanitize the complete mock object using the existing centralized sanitizeForFirestore()
  const cleanPayload = sanitizeForFirestore(payload);

  // Save to BOTH 'mock_tests' and 'mocks' collections for complete project-wide compatibility
  await safeSetDoc(doc(db, 'mock_tests', test.id), cleanPayload, { merge: true });
  await safeSetDoc(doc(db, 'mocks', test.id), cleanPayload, { merge: true });
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
  try {
    const snap = await getDocs(query(collection(db, 'notices'), orderBy('date', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotice));
  } catch (err) {
    console.warn('Failed to fetch notices:', err);
    return [];
  }
}

export async function saveNotice(notice: AppNotice): Promise<void> {
  const sanitized = sanitizeForFirestore(notice);
  await safeSetDoc(doc(db, 'notices', notice.id), sanitized, { merge: true });
  await logActivity('Save Notice', `Notice "${notice.title}" updated/created`);
}

export async function deleteNotice(id: string): Promise<void> {
  await deleteDoc(doc(db, 'notices', id));
  await logActivity('Delete Notice', `Deleted notice ID: ${id}`);
}

// 6.5 Live Tests
export async function fetchLiveTests(): Promise<LiveTestItem[]> {
  try {
    const snap = await getDocs(query(collection(db, 'live_tests'), orderBy('startAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LiveTestItem));
  } catch (err) {
    console.warn('Failed to fetch live tests:', err);
    return [];
  }
}

export async function saveLiveTest(test: LiveTestItem): Promise<void> {
  const sanitized = sanitizeForFirestore(test);
  await safeSetDoc(doc(db, 'live_tests', test.id), sanitized, { merge: true });
  await logActivity('Save Live Test', `Live test "${test.title}" scheduled/updated`);
}

export async function deleteLiveTest(id: string): Promise<void> {
  await deleteDoc(doc(db, 'live_tests', id));
  await logActivity('Delete Live Test', `Deleted live test ID: ${id}`);
}

export async function fetchLiveTestRegistrations(liveTestId: string): Promise<LiveTestRegistration[]> {
  try {
    const snap = await getDocs(collection(db, 'live_tests', liveTestId, 'registrations'));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LiveTestRegistration));
    list.sort((a, b) => new Date(b.registeredAt || 0).getTime() - new Date(a.registeredAt || 0).getTime());
    return list;
  } catch (err) {
    console.warn('Failed to fetch live test registrations:', err);
    return [];
  }
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
    const map = new Map<string, any>();
    for (const d of snap.docs) {
      if (d.id === 'current') continue; // Don't list 'current' pointer as a separate entry
      const data = d.data();
      const dateKey = data.date || d.id;
      if (!map.has(dateKey)) {
        map.set(dateKey, { id: d.id, ...data });
      }
    }
    return Array.from(map.values());
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
  const docId = qotd.date || qotd.id;
  const payload = { ...qotd, id: docId, active: true };
  await safeSetDoc(doc(db, 'qotd', docId), payload, { merge: true });
  // Also update 'current' doc for easy student app access
  await safeSetDoc(doc(db, 'qotd', 'current'), payload, { merge: true });
  await logActivity('Save QOTD', `Question of the Day set for date ${payload.date}`);
}

export async function deleteQOTD(idOrDate: string): Promise<void> {
  // 1. Delete document by ID / date
  try {
    await deleteDoc(doc(db, 'qotd', idOrDate));
  } catch (err) {
    console.warn(`Could not delete doc qotd/${idOrDate}:`, err);
  }

  // 2. Also check if 'current' document matches this date or ID, and delete it
  try {
    const currentRef = doc(db, 'qotd', 'current');
    const currentSnap = await getDoc(currentRef);
    if (currentSnap.exists()) {
      const data = currentSnap.data();
      if (data.date === idOrDate || data.id === idOrDate || idOrDate === 'current') {
        await deleteDoc(currentRef);
      }
    }
  } catch (err) {
    console.warn('Could not check/delete qotd/current:', err);
  }

  // 3. Delete any other documents with matching date field to prevent duplicates
  try {
    const q = query(collection(db, 'qotd'), where('date', '==', idOrDate));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Could not query matching date docs in qotd:', err);
  }

  await logActivity('Delete QOTD', `Deleted QOTD for date/ID: ${idOrDate}`);
}

export async function fetchRecentActivities(count: number = 10): Promise<AdminActivity[]> {
  try {
    const snap = await getDocs(query(collection(db, 'admin_activity'), orderBy('timestamp', 'desc'), limit(count)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminActivity));
  } catch (_) {
    return [];
  }
}

export interface TopicPracticeStats {
  topicId: string;
  totalSessions: number;
  updatedAt?: any;
}

export async function fetchPracticeTopicStats(): Promise<Record<string, TopicPracticeStats>> {
  try {
    const snap = await getDocs(collection(db, 'practice_topic_stats'));
    const result: Record<string, TopicPracticeStats> = {};
    for (const d of snap.docs) {
      const data = d.data();
      result[d.id] = {
        topicId: d.id,
        totalSessions: typeof data.totalSessions === 'number' ? data.totalSessions : 0,
        updatedAt: data.updatedAt,
      };
    }
    return result;
  } catch (err) {
    console.warn('Error fetching practice_topic_stats:', err);
    return {};
  }
}

// ==========================================
// Phase A: Admin-Controlled LMS Functions
// ==========================================

// --- 1. Test Series, Folders & Items ---
export async function fetchTestSeries(): Promise<TestSeries[]> {
  try {
    const snap = await getDocs(query(collection(db, 'test_series'), orderBy('sortOrder', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TestSeries));
  } catch (err) {
    console.warn('Error fetching test_series:', err);
    return [];
  }
}

export async function saveTestSeries(series: TestSeries): Promise<void> {
  await safeSetDoc(doc(db, 'test_series', series.id), series, { merge: true });
  await logActivity('Save Test Series', `Test Series "${series.title}" (${series.id}) saved`);
}

export async function deleteTestSeries(id: string): Promise<void> {
  await deleteDoc(doc(db, 'test_series', id));
  await logActivity('Delete Test Series', `Deleted Test Series ID: ${id}`);
}

export async function fetchTestSeriesFolders(seriesId: string): Promise<TestSeriesFolder[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'test_series', seriesId, 'folders'), orderBy('sortOrder', 'asc'))
    );
    return snap.docs.map((d) => ({ id: d.id, seriesId, ...d.data() } as TestSeriesFolder));
  } catch (err) {
    console.warn(`Error fetching folders for series ${seriesId}:`, err);
    return [];
  }
}

export async function saveTestSeriesFolder(folder: TestSeriesFolder): Promise<void> {
  await safeSetDoc(doc(db, 'test_series', folder.seriesId, 'folders', folder.id), folder, {
    merge: true,
  });
  await logActivity('Save Test Series Folder', `Folder "${folder.title}" in series ${folder.seriesId} saved`);
}

export async function deleteTestSeriesFolder(seriesId: string, folderId: string): Promise<void> {
  await deleteDoc(doc(db, 'test_series', seriesId, 'folders', folderId));
  await logActivity('Delete Test Series Folder', `Deleted folder ${folderId} from series ${seriesId}`);
}

export async function fetchTestSeriesItems(
  seriesId: string,
  folderId: string
): Promise<TestSeriesItem[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'test_series', seriesId, 'folders', folderId, 'items'),
        orderBy('sortOrder', 'asc')
      )
    );
    return snap.docs.map((d) => ({ id: d.id, seriesId, folderId, ...d.data() } as TestSeriesItem));
  } catch (err) {
    console.warn(`Error fetching items for folder ${folderId}:`, err);
    return [];
  }
}

export async function saveTestSeriesItem(item: TestSeriesItem): Promise<void> {
  await safeSetDoc(
    doc(db, 'test_series', item.seriesId, 'folders', item.folderId, 'items', item.id),
    item,
    { merge: true }
  );
  await logActivity('Save Test Series Item', `Item test ${item.testId} saved in series ${item.seriesId}`);
}

export async function deleteTestSeriesItem(
  seriesId: string,
  folderId: string,
  itemId: string
): Promise<void> {
  await deleteDoc(doc(db, 'test_series', seriesId, 'folders', folderId, 'items', itemId));
  await logActivity('Delete Test Series Item', `Deleted item ${itemId} from folder ${folderId}`);
}

// --- 2. Study Library ---
export async function fetchStudyFolders(): Promise<StudyFolder[]> {
  try {
    const snap = await getDocs(query(collection(db, 'study_folders'), orderBy('sortOrder', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudyFolder));
  } catch (err) {
    console.warn('Error fetching study_folders:', err);
    return [];
  }
}

export async function saveStudyFolder(folder: StudyFolder): Promise<void> {
  await safeSetDoc(doc(db, 'study_folders', folder.id), folder, { merge: true });
  await logActivity('Save Study Folder', `Study folder "${folder.title}" saved`);
}

export async function deleteStudyFolder(id: string): Promise<void> {
  await deleteDoc(doc(db, 'study_folders', id));
  await logActivity('Delete Study Folder', `Deleted study folder ID: ${id}`);
}

export async function fetchStudyMaterials(folderId?: string): Promise<StudyMaterial[]> {
  try {
    const coll = collection(db, 'study_materials');
    const q = folderId
      ? query(coll, where('folderId', '==', folderId), orderBy('sortOrder', 'asc'))
      : query(coll, orderBy('sortOrder', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudyMaterial));
  } catch (err) {
    console.warn('Error fetching study_materials:', err);
    return [];
  }
}

export async function saveStudyMaterial(material: StudyMaterial): Promise<void> {
  await safeSetDoc(doc(db, 'study_materials', material.id), material, { merge: true });
  await logActivity('Save Study Material', `Study material "${material.title}" saved`);
}

export async function deleteStudyMaterial(id: string): Promise<void> {
  await deleteDoc(doc(db, 'study_materials', id));
  await logActivity('Delete Study Material', `Deleted study material ID: ${id}`);
}

// --- 3. Battles ---
export async function fetchBattles(): Promise<BattleItem[]> {
  try {
    const snap = await getDocs(query(collection(db, 'battles'), orderBy('startAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BattleItem));
  } catch (err) {
    console.warn('Error fetching battles:', err);
    return [];
  }
}

export async function saveBattle(battle: BattleItem): Promise<void> {
  const payload = { ...battle };
  if (payload.status === 'CANCELLED') {
    payload.isPublished = false;
  }
  await safeSetDoc(doc(db, 'battles', battle.id), payload, { merge: true });
  await logActivity('Save Battle', `Battle "${battle.title}" saved (status: ${payload.status}, isPublished: ${payload.isPublished})`);
}

export async function deleteBattle(id: string): Promise<void> {
  await deleteDoc(doc(db, 'battles', id));
  await logActivity('Delete Battle', `Deleted battle ID: ${id}`);
}

export async function fetchBattleRegistrations(battleId: string): Promise<BattleRegistration[]> {
  try {
    const snap = await getDocs(collection(db, 'battles', battleId, 'registrations'));
    return snap.docs.map((d) => ({ id: d.id, battleId, ...d.data() } as BattleRegistration));
  } catch (err) {
    console.warn(`Error fetching registrations for battle ${battleId}:`, err);
    return [];
  }
}

// --- 4. Question Reports ---
export async function fetchQuestionReports(): Promise<QuestionReport[]> {
  try {
    const snap = await getDocs(query(collection(db, 'question_reports'), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as QuestionReport));
  } catch (err) {
    console.warn('Error fetching question_reports:', err);
    return [];
  }
}

export async function updateQuestionReport(
  id: string,
  updates: Partial<QuestionReport>
): Promise<void> {
  await safeSetDoc(doc(db, 'question_reports', id), updates, { merge: true });
  await logActivity('Update Question Report', `Report ${id} updated status: ${updates.status || 'modified'}`);
}

export async function deleteQuestionReport(id: string): Promise<void> {
  await deleteDoc(doc(db, 'question_reports', id));
  await logActivity('Delete Question Report', `Deleted question report ID: ${id}`);
}

// --- 5. Career Goals ---
export async function fetchCareerGoals(): Promise<CareerGoal[]> {
  try {
    const snap = await getDocs(collection(db, 'career_goals'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CareerGoal));
  } catch (err) {
    console.warn('Error fetching career_goals:', err);
    return [];
  }
}

export async function saveCareerGoal(goal: CareerGoal): Promise<void> {
  await safeSetDoc(doc(db, 'career_goals', goal.id), goal, { merge: true });
  await logActivity('Save Career Goal', `Career goal "${goal.title}" saved`);
}

export async function deleteCareerGoal(id: string): Promise<void> {
  await deleteDoc(doc(db, 'career_goals', id));
  await logActivity('Delete Career Goal', `Deleted career goal ID: ${id}`);
}

// --- 6. Current Affairs ---
export async function fetchCurrentAffairs(): Promise<CurrentAffairsItem[]> {
  try {
    const snap = await getDocs(query(collection(db, 'current_affairs'), orderBy('date', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CurrentAffairsItem));
  } catch (err) {
    console.warn('Error fetching current_affairs:', err);
    return [];
  }
}

export async function saveCurrentAffairs(item: CurrentAffairsItem): Promise<void> {
  await safeSetDoc(doc(db, 'current_affairs', item.id), item, { merge: true });
  await logActivity('Save Current Affairs', `Current affairs "${item.title}" saved`);
}

export async function deleteCurrentAffairs(id: string): Promise<void> {
  await deleteDoc(doc(db, 'current_affairs', id));
  await logActivity('Delete Current Affairs', `Deleted current affairs ID: ${id}`);
}

// --- 7. Dynamic Home Sections ---
export async function fetchHomeSections(): Promise<HomeSectionConfig[]> {
  try {
    const snap = await getDocs(query(collection(db, 'app_home_sections'), orderBy('sortOrder', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as HomeSectionConfig));
  } catch (err) {
    console.warn('Error fetching app_home_sections:', err);
    return [];
  }
}

export async function saveHomeSections(sections: HomeSectionConfig[]): Promise<void> {
  const batch = writeBatch(db);
  for (const section of sections) {
    const ref = doc(db, 'app_home_sections', section.id);
    batch.set(ref, sanitizeForFirestore(section), { merge: true });
  }
  await batch.commit();
  await logActivity('Save Home Sections', `Saved ${sections.length} home section configurations`);
}


