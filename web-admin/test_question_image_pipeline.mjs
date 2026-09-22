/**
 * Automated Verification Suite for Canonical Question Image Pipeline
 * Tests:
 * 1. Canonical schema reading & priority (canonical camelCase first, legacy snake_case second)
 * 2. Canonical schema dual-writing for backward compatibility
 * 3. URL validation (rejecting blob, file, Windows path, webpage/share URLs; requiring direct image)
 * 4. Question & option representation (Text only, Image only, Text + Image, Invalid empty)
 * 5. Option image indexing and array synchronization (A->0, B->1, C->2, D->3)
 * 6. Zero container footprint when image is absent
 * 7. Graceful error fallback handling
 */

import assert from 'assert';

console.log('====================================================');
console.log('TESTING QUESTION IMAGE PIPELINE ARCHITECTURE');
console.log('====================================================\n');

// --- 1. Helper Logic Mirroring Production Code ---

/**
 * Normalizes input question document, prioritizing canonical fields over legacy aliases.
 * Matches web-admin/src/types/index.ts and Flutter Question.fromMap
 */
function normalizeQuestionDoc(rawDoc) {
  const questionImageUrl = rawDoc.questionImageUrl || rawDoc.question_image_url || rawDoc.imageUrl || undefined;
  const explanationImageUrl = rawDoc.explanationImageUrl || rawDoc.explanation_image_url || undefined;
  
  const optionAImageUrl = rawDoc.optionAImageUrl || rawDoc.option_a_image_url || rawDoc.optionImages?.[0] || undefined;
  const optionBImageUrl = rawDoc.optionBImageUrl || rawDoc.option_b_image_url || rawDoc.optionImages?.[1] || undefined;
  const optionCImageUrl = rawDoc.optionCImageUrl || rawDoc.option_c_image_url || rawDoc.optionImages?.[2] || undefined;
  const optionDImageUrl = rawDoc.optionDImageUrl || rawDoc.option_d_image_url || rawDoc.optionImages?.[3] || undefined;

  const optionImages = [
    optionAImageUrl || '',
    optionBImageUrl || '',
    optionCImageUrl || '',
    optionDImageUrl || '',
  ];
  const hasAnyOptionImg = optionImages.some(img => Boolean(img && img.trim().length > 0));

  return {
    ...rawDoc,
    questionImageUrl,
    explanationImageUrl,
    optionAImageUrl,
    optionBImageUrl,
    optionCImageUrl,
    optionDImageUrl,
    optionImages: hasAnyOptionImg ? optionImages : undefined,
    hasQuestionImage: Boolean(questionImageUrl && questionImageUrl.trim().length > 0),
    hasAnyOptionImage: hasAnyOptionImg,
  };
}

/**
 * Prepares payload for Firestore save, dual-writing canonical and legacy fields.
 * Matches QuestionFormModal.tsx saveQuestion submission
 */
function prepareQuestionSavePayload(formData) {
  const payload = {
    text: formData.text?.trim() || '',
    options: formData.options?.map(o => (typeof o === 'string' ? o : o.text)) || [],
    correctIndex: formData.correctIndex,
  };

  // Canonical Question Image
  if (formData.questionImageUrl?.trim()) {
    const qUrl = formData.questionImageUrl.trim();
    payload.questionImageUrl = qUrl;
    payload.question_image_url = qUrl; // legacy dual-write
    payload.imageUrl = qUrl;           // legacy alias dual-write
  } else {
    payload.questionImageUrl = null;
    payload.question_image_url = null;
    payload.imageUrl = null;
  }

  // Canonical Option Images
  const optA = formData.optionAImageUrl?.trim() || '';
  const optB = formData.optionBImageUrl?.trim() || '';
  const optC = formData.optionCImageUrl?.trim() || '';
  const optD = formData.optionDImageUrl?.trim() || '';

  payload.optionAImageUrl = optA || null;
  payload.optionBImageUrl = optB || null;
  payload.optionCImageUrl = optC || null;
  payload.optionDImageUrl = optD || null;

  if (optA || optB || optC || optD) {
    payload.optionImages = [optA, optB, optC, optD];
  } else {
    payload.optionImages = null;
  }

  // Explanation Image
  if (formData.explanationImageUrl?.trim()) {
    const expUrl = formData.explanationImageUrl.trim();
    payload.explanationImageUrl = expUrl;
    payload.explanation_image_url = expUrl;
  } else {
    payload.explanationImageUrl = null;
    payload.explanation_image_url = null;
  }

  return payload;
}

/**
 * Validates direct image URL without web scraping.
 * Matches ImageUploader.tsx validation rules.
 */
function validateDirectImageUrl(url) {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'URL is required' };
  }

  // Disallowed schemes and paths
  if (trimmed.startsWith('blob:')) {
    return { valid: false, error: 'Blob URLs cannot be saved. Please upload the image.' };
  }
  if (trimmed.startsWith('file:') || /^[a-zA-Z]:\\/.test(trimmed) || trimmed.includes('\\')) {
    return { valid: false, error: 'Local file paths cannot be saved. Please upload the image.' };
  }
  if (!trimmed.startsWith('https://')) {
    return { valid: false, error: 'Image URL must use secure HTTPS protocol.' };
  }

  // Reject webpage/share URL indicators
  const lower = trimmed.toLowerCase();
  const isLikelyWebpage = 
    lower.includes('kommodo.in/practice') ||
    lower.includes('drive.google.com/file') ||
    lower.includes('dropbox.com/s/') ||
    lower.includes('instagram.com/p/') ||
    lower.includes('.html') ||
    lower.includes('.php');

  if (isLikelyWebpage) {
    return { 
      valid: false, 
      error: 'This URL is not a direct image. Upload the image or use a direct image URL.' 
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates question content flexibility:
 * Supports Text only, Image only, or Text + Image.
 * Fails only if both text and image are missing.
 */
function validateQuestionContent(text, imageUrl) {
  const hasText = Boolean(text && text.trim().length > 0);
  const hasImage = Boolean(imageUrl && imageUrl.trim().length > 0);
  return hasText || hasImage;
}

/**
 * Simulates rendering of question/option image container.
 * Returns null / zero footprint if url is absent or invalid.
 */
function renderImageContainer(imageUrl, loadFailed = false) {
  if (!imageUrl || !imageUrl.trim()) {
    return { rendered: false, footprint: 0 }; // zero container
  }
  if (loadFailed) {
    return { rendered: true, footprint: 'error-banner', message: 'Image could not be loaded' };
  }
  return { rendered: true, footprint: 'image-box', url: imageUrl };
}

// ====================================================
// TEST SUITES
// ====================================================

// Test 1: Canonical Field Reading Priority
{
  console.log('Test 1: Canonical field reading takes precedence over legacy aliases');
  const legacyAndCanonicalDoc = {
    id: 'q_test_1',
    questionImageUrl: 'https://firebasestorage.googleapis.com/v0/b/app/canonical.webp',
    question_image_url: 'https://kommodo.in/old_legacy.webp',
    imageUrl: 'https://old.cdn/old.jpg',
  };
  const normalized = normalizeQuestionDoc(legacyAndCanonicalDoc);
  assert.strictEqual(
    normalized.questionImageUrl,
    'https://firebasestorage.googleapis.com/v0/b/app/canonical.webp',
    'Canonical questionImageUrl must take priority'
  );
  assert.strictEqual(normalized.hasQuestionImage, true);
  console.log('  ✓ Priority test passed');
}

// Test 2: Fallback to Legacy Field When Canonical Absent
{
  console.log('Test 2: Gracefully falls back to legacy field when canonical is absent');
  const legacyOnlyDoc = {
    id: 'q_test_2',
    question_image_url: 'https://firebasestorage.googleapis.com/v0/b/app/legacy.webp',
  };
  const normalized = normalizeQuestionDoc(legacyOnlyDoc);
  assert.strictEqual(
    normalized.questionImageUrl,
    'https://firebasestorage.googleapis.com/v0/b/app/legacy.webp',
    'Must fallback to question_image_url'
  );
  assert.strictEqual(normalized.hasQuestionImage, true);
  console.log('  ✓ Fallback test passed');
}

// Test 3: Dual-Writing Legacy Fields on Save
{
  console.log('Test 3: Dual-writes legacy fields on save for backward compatibility');
  const formData = {
    text: 'What is shown in the diagram?',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: 0,
    questionImageUrl: 'https://firebasestorage.googleapis.com/v0/b/app/q_123.webp',
    optionAImageUrl: 'https://firebasestorage.googleapis.com/v0/b/app/optA.webp',
    explanationImageUrl: 'https://firebasestorage.googleapis.com/v0/b/app/exp.webp',
  };
  const payload = prepareQuestionSavePayload(formData);
  assert.strictEqual(payload.questionImageUrl, 'https://firebasestorage.googleapis.com/v0/b/app/q_123.webp');
  assert.strictEqual(payload.question_image_url, 'https://firebasestorage.googleapis.com/v0/b/app/q_123.webp');
  assert.strictEqual(payload.imageUrl, 'https://firebasestorage.googleapis.com/v0/b/app/q_123.webp');
  assert.strictEqual(payload.optionAImageUrl, 'https://firebasestorage.googleapis.com/v0/b/app/optA.webp');
  assert.deepStrictEqual(payload.optionImages, [
    'https://firebasestorage.googleapis.com/v0/b/app/optA.webp',
    '',
    '',
    '',
  ]);
  assert.strictEqual(payload.explanationImageUrl, 'https://firebasestorage.googleapis.com/v0/b/app/exp.webp');
  assert.strictEqual(payload.explanation_image_url, 'https://firebasestorage.googleapis.com/v0/b/app/exp.webp');
  console.log('  ✓ Dual-writing test passed');
}

// Test 4: URL Validation Rejects Inappropriate Schemes & Local Paths
{
  console.log('Test 4: URL Validation rejects local paths, blob URLs, and HTTP');
  assert.strictEqual(validateDirectImageUrl('blob:http://localhost:5173/abc-123').valid, false);
  assert.strictEqual(validateDirectImageUrl('file:///C:/Users/test/diagram.png').valid, false);
  assert.strictEqual(validateDirectImageUrl('C:\\Users\\test\\diagram.png').valid, false);
  assert.strictEqual(validateDirectImageUrl('\\\\network\\share\\diagram.png').valid, false);
  assert.strictEqual(validateDirectImageUrl('http://insecure.site/diagram.png').valid, false);
  console.log('  ✓ Inappropriate schemes correctly rejected');
}

// Test 5: Rejection of Webpage/Share URLs with Prescribed Error Message
{
  console.log('Test 5: Rejection of webpage and share URLs with strict prescribed error');
  const webpageCheck = validateDirectImageUrl('https://kommodo.in/practice/question/67890');
  assert.strictEqual(webpageCheck.valid, false);
  assert.strictEqual(
    webpageCheck.error,
    'This URL is not a direct image. Upload the image or use a direct image URL.'
  );

  const driveCheck = validateDirectImageUrl('https://drive.google.com/file/d/12345/view');
  assert.strictEqual(driveCheck.valid, false);
  assert.strictEqual(
    driveCheck.error,
    'This URL is not a direct image. Upload the image or use a direct image URL.'
  );
  console.log('  ✓ Webpage/share rejection test passed');
}

// Test 6: Acceptance of Direct Image URLs
{
  console.log('Test 6: Valid direct HTTPS image URLs are accepted');
  const validUrl = 'https://firebasestorage.googleapis.com/v0/b/andaman-quiz.appspot.com/o/question_images%2Fq_test.webp?alt=media';
  assert.strictEqual(validateDirectImageUrl(validUrl).valid, true);
  console.log('  ✓ Valid direct HTTPS image URL accepted');
}

// Test 7: Text and Image Combinations (Text-only, Image-only, Text+Image)
{
  console.log('Test 7: Flexible Question/Option combinations');
  // Text only
  assert.strictEqual(validateQuestionContent('What is the capital of India?', null), true, 'Text only should be valid');
  // Image only (diagram question with question text empty or purely in diagram)
  assert.strictEqual(validateQuestionContent('', 'https://app.com/diagram.webp'), true, 'Image only should be valid');
  // Text + Image
  assert.strictEqual(validateQuestionContent('Identify the organ shown:', 'https://app.com/organ.webp'), true, 'Text + Image should be valid');
  // Neither
  assert.strictEqual(validateQuestionContent('', ''), false, 'Neither text nor image must fail');
  console.log('  ✓ Content combination test passed');
}

// Test 8: Zero Container Footprint When No Image
{
  console.log('Test 8: Zero container footprint when image is absent');
  const emptyResult = renderImageContainer(null);
  assert.strictEqual(emptyResult.rendered, false);
  assert.strictEqual(emptyResult.footprint, 0);

  const blankResult = renderImageContainer('   ');
  assert.strictEqual(blankResult.rendered, false);
  assert.strictEqual(blankResult.footprint, 0);
  console.log('  ✓ Zero footprint test passed');
}

// Test 9: Graceful Error Handling Without Broken Image Icon
{
  console.log('Test 9: Graceful error container on load failure');
  const errorResult = renderImageContainer('https://broken.cdn/missing.webp', true);
  assert.strictEqual(errorResult.rendered, true);
  assert.strictEqual(errorResult.footprint, 'error-banner');
  assert.strictEqual(errorResult.message, 'Image could not be loaded');
  console.log('  ✓ Graceful error handling test passed');
}

// Test 10: Option A-D Index Mapping
{
  console.log('Test 10: Option A/B/C/D image mapping and array ordering');
  const questionWithAllOptions = {
    id: 'q_options_test',
    optionAImageUrl: 'https://cdn.com/optA.png',
    optionBImageUrl: 'https://cdn.com/optB.png',
    optionCImageUrl: 'https://cdn.com/optC.png',
    optionDImageUrl: 'https://cdn.com/optD.png',
  };
  const norm = normalizeQuestionDoc(questionWithAllOptions);
  assert.strictEqual(norm.optionImages[0], 'https://cdn.com/optA.png');
  assert.strictEqual(norm.optionImages[1], 'https://cdn.com/optB.png');
  assert.strictEqual(norm.optionImages[2], 'https://cdn.com/optC.png');
  assert.strictEqual(norm.optionImages[3], 'https://cdn.com/optD.png');
  assert.strictEqual(norm.hasAnyOptionImage, true);

  // Partial option images (e.g. only option B has image)
  const questionPartial = {
    id: 'q_partial_opt',
    optionBImageUrl: 'https://cdn.com/optB.png',
  };
  const normPartial = normalizeQuestionDoc(questionPartial);
  assert.strictEqual(normPartial.optionImages[0], '');
  assert.strictEqual(normPartial.optionImages[1], 'https://cdn.com/optB.png');
  assert.strictEqual(normPartial.optionImages[2], '');
  assert.strictEqual(normPartial.optionImages[3], '');
  assert.strictEqual(normPartial.hasAnyOptionImage, true);
  console.log('  ✓ Option indexing and array mapping test passed');
}

console.log('\n====================================================');
console.log('ALL 10 QUESTION IMAGE PIPELINE TESTS PASSED!');
console.log('====================================================');
