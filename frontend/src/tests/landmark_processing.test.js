/**
 * Unit Tests for Phase 8: Pose Landmark Processing & Movement Data Foundation.
 *
 * Validates:
 * 1. Landmark extraction and 33-point standard structure with named mappings.
 * 2. Configurable confidence filtering (visibility cutoffs).
 * 3. Safe handling of missing, undefined, and NaN landmarks.
 * 4. Exponential Moving Average (EMA) smoothing for jitter reduction.
 * 5. Track-loss handling and smoother re-initialization.
 * 6. Body-relative scale and origin normalization (camera invariance).
 * 7. Fallback resilience when torso landmarks are missing.
 * 8. End-to-end LandmarkProcessor pipeline and named landmark dictionary.
 */

import {
  LANDMARK_COUNT,
  LANDMARK_INDEX,
  LANDMARK_NAMES,
  extractLandmark,
  extractLandmarks,
  LandmarkSmoother,
  normalizePoseCoordinates,
  LandmarkProcessor,
  createPoseProcessor,
  calculateDistance,
  calculateMidpoint,
} from '../services/landmarkProcessor.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function runLandmarkProcessingTests() {
  console.log('--- Running Phase 8 Pose Landmark Processing Tests ---');

  // Test 1: Standard MediaPipe 33 Landmark Definitions & Mappings
  console.log('1. Checking 33 landmark named mappings and index alignment...');
  assert(LANDMARK_COUNT === 33, 'Expected 33 standard landmarks');
  assert(LANDMARK_NAMES.length === 33, 'Expected 33 landmark names in array');
  assert(LANDMARK_INDEX.NOSE === 0, 'NOSE index should be 0');
  assert(LANDMARK_INDEX.LEFT_SHOULDER === 11, 'LEFT_SHOULDER index should be 11');
  assert(LANDMARK_INDEX.RIGHT_SHOULDER === 12, 'RIGHT_SHOULDER index should be 12');
  assert(LANDMARK_INDEX.LEFT_HIP === 23, 'LEFT_HIP index should be 23');
  assert(LANDMARK_INDEX.RIGHT_HIP === 24, 'RIGHT_HIP index should be 24');
  assert(LANDMARK_INDEX.LEFT_KNEE === 25, 'LEFT_KNEE index should be 25');
  assert(LANDMARK_INDEX.RIGHT_KNEE === 26, 'RIGHT_KNEE index should be 26');
  assert(LANDMARK_NAMES[11] === 'leftShoulder', 'Index 11 should map to leftShoulder');
  assert(LANDMARK_NAMES[25] === 'leftKnee', 'Index 25 should map to leftKnee');
  console.log('  [PASS] 33 landmark definitions and indices align perfectly.');

  // Test 2: Helper Math Functions (Distance & Midpoint)
  console.log('2. Testing 3D distance and midpoint calculations...');
  const p1 = { x: 0, y: 0, z: 0 };
  const p2 = { x: 3, y: 4, z: 0 };
  const dist = calculateDistance(p1, p2);
  assert(Math.abs(dist - 5) < 1e-6, `3-4-5 distance failed: got ${dist}`);

  const mid = calculateMidpoint(p1, p2);
  assert(mid.x === 1.5 && mid.y === 2.0 && mid.z === 0, 'Midpoint calculation mismatch');
  // Safe null handling
  assert(calculateDistance(null, p2) === 0, 'Distance with null should return 0 safely');
  assert(calculateMidpoint(null, null).x === 0, 'Midpoint with null should return zeros safely');
  console.log('  [PASS] Distance and midpoint math functions are robust.');

  // Test 3: Landmark Extraction & Confidence Filtering
  console.log('3. Testing landmark extraction with confidence filtering...');
  const validRaw = { x: 0.45, y: 0.65, z: -0.1, visibility: 0.92 };
  const lowConfRaw = { x: 0.45, y: 0.65, z: -0.1, visibility: 0.35 };

  const extracted1 = extractLandmark(validRaw, 25, 0.5);
  assert(extracted1.id === 25, 'ID mismatch');
  assert(extracted1.name === 'leftKnee', 'Name mismatch');
  assert(extracted1.isValid === true, 'High-confidence landmark should be valid');
  assert(extracted1.x === 0.45 && extracted1.y === 0.65, 'Coordinates mismatch');

  const extracted2 = extractLandmark(lowConfRaw, 25, 0.5);
  assert(extracted2.isValid === false, 'Low-confidence landmark should be marked invalid');

  // Configurable threshold behavior
  const extractedWithLowThreshold = extractLandmark(lowConfRaw, 25, 0.3);
  assert(extractedWithLowThreshold.isValid === true, 'Should be valid with lowered threshold 0.3');
  console.log('  [PASS] Extraction and configurable confidence filtering verified.');

  // Test 4: Missing, Undefined, and NaN Coordinate Resilience
  console.log('4. Testing resilience against missing, null, undefined, and NaN landmarks...');
  const nullExtracted = extractLandmark(null, 0);
  assert(nullExtracted.isValid === false, 'Null landmark should be invalid');
  assert(nullExtracted.x === 0 && nullExtracted.y === 0, 'Default coordinates should be 0');

  const nanRaw = { x: NaN, y: 0.5, z: 0, visibility: 0.99 };
  const nanExtracted = extractLandmark(nanRaw, 1);
  assert(nanExtracted.isValid === false, 'NaN coordinates must be marked invalid');

  // Passing empty array to extractLandmarks should yield 33 safe landmarks
  const emptyList = extractLandmarks([]);
  assert(emptyList.length === 33, 'Should always return 33 landmarks even if raw list is empty');
  assert(emptyList.every((lm) => lm.isValid === false), 'All should be invalid on empty input');
  console.log('  [PASS] Missing and malformed landmark data handled safely without throwing.');

  // Test 5: Landmark Smoothing (Exponential Moving Average)
  console.log('5. Testing Exponential Moving Average (EMA) smoothing...');
  const smoother = new LandmarkSmoother(0.5, 5); // alpha = 0.5 for simple calculation

  // Frame 1: Landmark at (10, 20, 0)
  const frame1 = [extractLandmark({ x: 10, y: 20, z: 0, visibility: 1.0 }, 0)];
  const smoothed1 = smoother.smooth(frame1);
  assert(smoothed1[0].x === 10 && smoothed1[0].y === 20, 'First frame should match raw input');

  // Frame 2: Landmark jumps to (20, 40, 0) due to tremor/noise
  // With alpha = 0.5: S_2 = 0.5 * 20 + 0.5 * 10 = 15; y = 0.5 * 40 + 0.5 * 20 = 30
  const frame2 = [extractLandmark({ x: 20, y: 40, z: 0, visibility: 1.0 }, 0)];
  const smoothed2 = smoother.smooth(frame2);
  assert(
    Math.abs(smoothed2[0].x - 15) < 1e-6,
    `Smoothed X expected 15, got ${smoothed2[0].x}`
  );
  assert(
    Math.abs(smoothed2[0].y - 30) < 1e-6,
    `Smoothed Y expected 30, got ${smoothed2[0].y}`
  );

  // Test smoother reset
  smoother.reset();
  const frameAfterReset = [extractLandmark({ x: 50, y: 50, z: 0, visibility: 1.0 }, 0)];
  const smoothedAfterReset = smoother.smooth(frameAfterReset);
  assert(
    smoothedAfterReset[0].x === 50,
    'After reset, smoother should re-initialize directly to 50'
  );
  console.log('  [PASS] EMA smoothing and reset behavior validated.');

  // Test 6: Smoother Recovery After Track Loss
  console.log('6. Testing track loss recovery and smoother missing streak...');
  const trackLossSmoother = new LandmarkSmoother(0.5, 2); // resets after 2 missing frames
  trackLossSmoother.smooth([extractLandmark({ x: 10, y: 10, z: 0, visibility: 1.0 }, 0)]);

  // Simulate 3 frames of lost tracking (missing/invalid)
  for (let f = 0; f < 3; f++) {
    trackLossSmoother.smooth([extractLandmark(null, 0)]);
  }

  // Landmark reappears at a completely different position (100, 100)
  const reappeared = trackLossSmoother.smooth([
    extractLandmark({ x: 100, y: 100, z: 0, visibility: 1.0 }, 0),
  ]);
  // Since missing streak exceeded 2 frames, it should NOT interpolate from 10 to 100 (which would be 55)
  // It should directly take 100
  assert(
    reappeared[0].x === 100,
    `Expected direct re-initialization to 100 after track loss, got ${reappeared[0].x}`
  );
  console.log('  [PASS] Track loss recovery correctly re-initializes without artificial drag.');

  // Test 7: Coordinate Normalization (Body-Relative & Scale-Invariant)
  console.log('7. Testing body-relative and scale-invariant normalization...');
  // Build a synthetic patient standing:
  // Shoulders at y = 0.2, Hips at y = 0.6 (torso length = 0.4)
  // Left shoulder at x = 0.4, Right shoulder at x = 0.6 (midShoulder = (0.5, 0.2))
  // Left hip at x = 0.45, Right hip at x = 0.55 (midHip = (0.5, 0.6))
  const createSyntheticPose = (scaleMultiplier = 1.0, offsetX = 0.0) => {
    const raw = new Array(33).fill(null);
    const midX = 0.5 + offsetX;
    raw[LANDMARK_INDEX.LEFT_SHOULDER] = {
      x: midX - 0.1 * scaleMultiplier,
      y: 0.2 * scaleMultiplier,
      z: 0,
      visibility: 1.0,
    };
    raw[LANDMARK_INDEX.RIGHT_SHOULDER] = {
      x: midX + 0.1 * scaleMultiplier,
      y: 0.2 * scaleMultiplier,
      z: 0,
      visibility: 1.0,
    };
    raw[LANDMARK_INDEX.LEFT_HIP] = {
      x: midX - 0.05 * scaleMultiplier,
      y: 0.6 * scaleMultiplier,
      z: 0,
      visibility: 1.0,
    };
    raw[LANDMARK_INDEX.RIGHT_HIP] = {
      x: midX + 0.05 * scaleMultiplier,
      y: 0.6 * scaleMultiplier,
      z: 0,
      visibility: 1.0,
    };
    // Left knee at y = 0.9 * scaleMultiplier
    raw[LANDMARK_INDEX.LEFT_KNEE] = {
      x: midX - 0.05 * scaleMultiplier,
      y: 0.9 * scaleMultiplier,
      z: 0,
      visibility: 1.0,
    };
    return extractLandmarks(raw);
  };

  const poseA = createSyntheticPose(1.0, 0.0); // Close to camera, centered
  const poseB = createSyntheticPose(0.5, 0.2); // Further away (half size), shifted right

  const normA = normalizePoseCoordinates(poseA);
  const normB = normalizePoseCoordinates(poseB);

  assert(normA.isTorsoValid === true, 'Pose A torso should be valid');
  assert(normB.isTorsoValid === true, 'Pose B torso should be valid');

  // Check origin centering: midHip should be at nx = 0, ny = 0
  const midHipA_x = (normA.landmarks[23].nx + normA.landmarks[24].nx) / 2;
  const midHipA_y = (normA.landmarks[23].ny + normA.landmarks[24].ny) / 2;
  assert(Math.abs(midHipA_x) < 1e-6, `Expected mid-hip nx to be 0, got ${midHipA_x}`);
  assert(Math.abs(midHipA_y) < 1e-6, `Expected mid-hip ny to be 0, got ${midHipA_y}`);

  // Scale Invariance: relative normalized knee position should match between Pose A and Pose B
  const kneeA_ny = normA.landmarks[LANDMARK_INDEX.LEFT_KNEE].ny;
  const kneeB_ny = normB.landmarks[LANDMARK_INDEX.LEFT_KNEE].ny;
  assert(
    Math.abs(kneeA_ny - kneeB_ny) < 1e-4,
    `Knee relative ny should be scale invariant! Pose A: ${kneeA_ny}, Pose B: ${kneeB_ny}`
  );
  console.log('  [PASS] Normalization provides origin centering and scale invariance.');

  // Test 8: Fallback When Torso Landmarks are Missing
  console.log('8. Testing normalization fallback when torso landmarks are missing...');
  const incompletePose = extractLandmarks([]); // all invalid
  const fallbackNorm = normalizePoseCoordinates(incompletePose);
  assert(fallbackNorm.isTorsoValid === false, 'isTorsoValid should be false');
  assert(fallbackNorm.torsoCenter === null, 'torsoCenter should be null');
  assert(fallbackNorm.landmarks[0].nx === null, 'Normalized coords should safely be null');
  console.log('  [PASS] Normalization degrades gracefully on incomplete pose data.');

  // Test 9: End-to-End LandmarkProcessor Pipeline
  console.log('9. Testing LandmarkProcessor full pipeline & named dictionary access...');
  const processor = createPoseProcessor({
    minConfidence: 0.5,
    enableSmoothing: true,
    smoothingAlpha: 0.7,
    enableNormalization: true,
  });

  const rawSample = new Array(33).fill(null);
  rawSample[LANDMARK_INDEX.LEFT_SHOULDER] = { x: 0.4, y: 0.3, z: 0, visibility: 0.95 };
  rawSample[LANDMARK_INDEX.RIGHT_SHOULDER] = { x: 0.6, y: 0.3, z: 0, visibility: 0.95 };
  rawSample[LANDMARK_INDEX.LEFT_HIP] = { x: 0.45, y: 0.7, z: 0, visibility: 0.95 };
  rawSample[LANDMARK_INDEX.RIGHT_HIP] = { x: 0.55, y: 0.7, z: 0, visibility: 0.95 };
  rawSample[LANDMARK_INDEX.LEFT_KNEE] = { x: 0.45, y: 1.0, z: 0, visibility: 0.90 };

  const processedPose = processor.process(rawSample);

  assert(processedPose.rawCount === 33, 'rawCount should be 33');
  assert(processedPose.validCount === 5, `Expected 5 valid landmarks, got ${processedPose.validCount}`);
  assert(
    processedPose.trackingQuality === Math.round((5 / 33) * 100),
    'Tracking quality percentage mismatch'
  );
  assert(processedPose.isSmoothed === true, 'isSmoothed should be true');
  assert(processedPose.isNormalized === true, 'isNormalized should be true');

  // Convenient named landmark dictionary access:
  assert(processedPose.byName.leftKnee !== undefined, 'Should have byName.leftKnee');
  assert(processedPose.byName.leftKnee.isValid === true, 'leftKnee should be valid');
  assert(processedPose.byName.nose.isValid === false, 'nose should be invalid');

  // Test dynamic config update
  processor.updateConfig({ minConfidence: 0.96 }); // Exceeds 0.95
  const stricterPose = processor.process(rawSample);
  assert(
    stricterPose.validCount === 0,
    'All landmarks should be rejected under strict 0.96 threshold'
  );

  console.log('  [PASS] Full LandmarkProcessor pipeline verified successfully.');

  console.log('\nAll Phase 8 Pose Landmark Processing Tests PASSED successfully!');
}

runLandmarkProcessingTests();
