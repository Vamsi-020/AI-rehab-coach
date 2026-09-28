/**
 * Shoulder Abduction Runtime & Rep Counting Diagnostic & Validation Suite.
 *
 * Verifies:
 * 1. Left-arm shoulder abduction full movement lifecycle.
 * 2. Right-arm shoulder abduction full movement lifecycle.
 * 3. Equal left/right confidence does not permanently force left side when right is selected.
 * 4. Hip visibility below 0.5 does NOT invalidate shoulder abduction when shoulder and elbow are valid.
 * 5. Dynamic side selection chooses actively moving shoulder in auto mode.
 * 6. ExerciseAnalyzer produces START -> MOVING -> TARGET -> RETURNING -> START transitions.
 * 7. RepCounter receives analyzer outputs and increments repCount exactly once per completed rep without double-counting.
 * 8. Biomechanical angle calculation: downward torso vector fallback preserves anatomical accuracy when hip is occluded.
 */

import { createExerciseAnalyzer } from '../services/exerciseAnalyzer.js';
import { createRepCounter } from '../services/repCounter.js';
import { createAngleEngine } from '../services/jointAngleService.js';
import { MOVEMENT_STATES, getExerciseDefinition } from '../services/exerciseDefinitions.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function createMockPose(landmarksMap, defaultVis = 0.95) {
  const byName = {};
  const landmarks = [];

  for (let i = 0; i < 33; i++) {
    const lm = {
      id: i,
      name: `landmark_${i}`,
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: defaultVis,
      isValid: defaultVis >= 0.5,
    };
    landmarks.push(lm);
  }

  for (const [name, data] of Object.entries(landmarksMap)) {
    const vis = typeof data.visibility === 'number' ? data.visibility : defaultVis;
    const isValid = data.isValid !== undefined ? data.isValid : vis >= 0.5;
    const lm = {
      id: 99,
      name,
      x: data.x ?? 0.5,
      y: data.y ?? 0.5,
      z: 0,
      visibility: vis,
      isValid,
    };
    byName[name] = lm;
  }

  return { landmarks, byName };
}

export function runShoulderAbductionRuntimeTests() {
  console.log('--- Running Shoulder Abduction Runtime & Rep Counting Tests ---');

  // Test 1: Exercise Definition Thresholds and Required Landmarks
  console.log('1. Verifying Shoulder Abduction exercise definition thresholds and required landmarks...');
  const def = getExerciseDefinition('shoulder-abduction-scapular');
  assert(def !== undefined, 'shoulder-abduction-scapular must exist');
  assert(def.startingPosition.angle === 25, 'startingPosition.angle must be 25');
  assert(def.startingPosition.tolerance === 15, 'startingPosition.tolerance must be 15');
  assert(def.targetPosition.angle === 90, 'targetPosition.angle must be 90');
  assert(def.targetPosition.tolerance === 15, 'targetPosition.tolerance must be 15');
  assert(def.returnPosition.angle === 30, 'returnPosition.angle must be 30');
  assert(def.returnPosition.tolerance === 15, 'returnPosition.tolerance must be 15');
  assert(def.movementDirection === 'increasing', 'movementDirection must be increasing');
  assert(!def.requiredLandmarks.includes('leftHip'), 'Hip must NOT be in requiredLandmarks');
  assert(def.requiredLandmarks.includes('leftShoulder') && def.requiredLandmarks.includes('leftElbow'), 'Left shoulder and elbow required');
  assert(def.sideRequiredLandmarks.right.includes('rightShoulder') && def.sideRequiredLandmarks.right.includes('rightElbow'), 'Right shoulder and elbow required');
  console.log('  [PASS] Thresholds and side-aware required landmarks verified.');

  // Test 2: Angle calculation with hip visibility < 0.5 (laptop / desk webcam simulation)
  console.log('2. Verifying anatomical angle computation when hip visibility < 0.5...');
  const angleEngine = createAngleEngine();

  // Pose with right arm raised 90 degrees, but right hip occluded below desk (visibility 0.1)
  const deskPose = createMockPose({
    rightShoulder: { x: 0.5, y: 0.3, visibility: 0.96 },
    rightElbow: { x: 0.8, y: 0.3, visibility: 0.94 }, // Horizontal arm (90 deg to downward torso)
    rightHip: { x: 0.5, y: 0.8, visibility: 0.1, isValid: false }, // Occluded hip!
    leftShoulder: { x: 0.3, y: 0.3, visibility: 0.96 },
    leftElbow: { x: 0.3, y: 0.6, visibility: 0.94 }, // Arm resting along side
    leftHip: { x: 0.3, y: 0.8, visibility: 0.05, isValid: false }, // Occluded hip!
  });

  const angles = angleEngine.calculateAll(deskPose);
  assert(angles.rightShoulder.isValid === true, 'rightShoulder angle must remain valid even when hip is occluded');
  assert(Math.abs(angles.rightShoulder.angle - 90) < 1.0, `Expected ~90° for horizontal abduction, got ${angles.rightShoulder.angle}`);
  assert(angles.leftShoulder.isValid === true, 'leftShoulder angle must remain valid even when hip is occluded');
  assert(angles.leftShoulder.angle < 20, `Expected <20° for resting arm, got ${angles.leftShoulder.angle}`);
  console.log(`  [PASS] Hip occlusion fallback computes valid anatomical angles (Right: ${angles.rightShoulder.angle}°, Left: ${angles.leftShoulder.angle}°).`);

  // Test 3: Equal confidence selection with explicit selectedSide
  console.log('3. Verifying explicit selectedSide does not default to left side when confidences are equal...');
  const equalConfPose = createMockPose({
    leftShoulder: { visibility: 0.98 },
    leftElbow: { visibility: 0.98 },
    rightShoulder: { visibility: 0.98 },
    rightElbow: { visibility: 0.98 },
  });
  const equalConfAngles = {
    leftShoulder: { joint: 'leftShoulder', angle: 20, confidence: 0.98, isValid: true },
    rightShoulder: { joint: 'rightShoulder', angle: 20, confidence: 0.98, isValid: true },
    leftElbow: { joint: 'leftElbow', angle: 160, confidence: 0.98, isValid: true },
    rightElbow: { joint: 'rightElbow', angle: 160, confidence: 0.98, isValid: true },
  };

  const rightSelectedAnalyzer = createExerciseAnalyzer('shoulder-abduction-scapular', {
    preferredSide: 'right',
  });
  const resRightSelect = rightSelectedAnalyzer.analyze(equalConfPose, equalConfAngles);
  assert(resRightSelect.valid === true, `Analysis must be valid (state: ${resRightSelect.state})`);
  assert(resRightSelect.primaryJoint === 'rightShoulder', `Expected rightShoulder, got ${resRightSelect.primaryJoint}`);

  const leftSelectedAnalyzer = createExerciseAnalyzer('shoulder-abduction-scapular', {
    preferredSide: 'left',
  });
  const resLeftSelect = leftSelectedAnalyzer.analyze(equalConfPose, equalConfAngles);
  assert(resLeftSelect.valid === true, `Analysis must be valid (state: ${resLeftSelect.state})`);
  assert(resLeftSelect.primaryJoint === 'leftShoulder', `Expected leftShoulder, got ${resLeftSelect.primaryJoint}`);
  console.log('  [PASS] Explicit side selection verified for equal confidence.');

  // Test 4: Dynamic auto side selection when right arm moves
  console.log('4. Verifying dynamic auto side selection tracks the shoulder that is actually moving...');
  const autoAnalyzer = createExerciseAnalyzer('shoulder-abduction-scapular', {
    preferredSide: 'auto',
  });

  const dualArmPose = createMockPose({
    leftShoulder: { visibility: 0.95 },
    leftElbow: { visibility: 0.95 },
    rightShoulder: { visibility: 0.95 },
    rightElbow: { visibility: 0.95 },
  });

  // Frame A: Both arms at side resting (both ~10°)
  const restingAngles = {
    leftShoulder: { joint: 'leftShoulder', angle: 10, confidence: 0.95, isValid: true },
    rightShoulder: { joint: 'rightShoulder', angle: 10, confidence: 0.95, isValid: true },
  };
  const resResting = autoAnalyzer.analyze(dualArmPose, restingAngles);
  assert(resResting.state === MOVEMENT_STATES.START, `Expected START, got ${resResting.state}`);

  // Frame B: Right arm raises to 60 degrees, left arm stays at side (~10°)
  const rightMovingAngles = {
    leftShoulder: { joint: 'leftShoulder', angle: 10, confidence: 0.95, isValid: true },
    rightShoulder: { joint: 'rightShoulder', angle: 60, confidence: 0.95, isValid: true },
  };
  const resRightMoving = autoAnalyzer.analyze(dualArmPose, rightMovingAngles);
  assert(resRightMoving.primaryJoint === 'rightShoulder', `Auto mode must select rightShoulder when right arm moves, got ${resRightMoving.primaryJoint}`);
  assert(resRightMoving.state === MOVEMENT_STATES.MOVING, `Expected MOVING, got ${resRightMoving.state}`);
  console.log('  [PASS] Dynamic auto side selection correctly identifies actively moving arm.');

  // Test 5: Full Left Arm Repetition Counting Pipeline (pre-computed angles -> Analyzer -> RepCounter)
  console.log('5. Verifying complete Left Arm repetition counting through full pipeline...');
  const leftAnalyzer = createExerciseAnalyzer('shoulder-abduction-scapular', { preferredSide: 'left' });
  const leftRepCounter = createRepCounter('shoulder-abduction-scapular', {
    consecutiveFramesToTransition: 1,
    minRepDurationMs: 100,
    cooldownMs: 50,
  });

  const leftPose = createMockPose({
    leftShoulder: { visibility: 0.95 },
    leftElbow: { visibility: 0.95 },
  });

  const makeLeftAngles = (angle) => ({
    leftShoulder: { joint: 'leftShoulder', angle, confidence: 0.95, isValid: true },
  });

  let t = 1000;
  // Step 1: START (arm resting at ~20°)
  let analysis = leftAnalyzer.analyze(leftPose, makeLeftAngles(20), t);
  assert(analysis.state === MOVEMENT_STATES.START, `Expected START, got ${analysis.state}`);
  let repResult = leftRepCounter.process(analysis, t);
  assert(repResult.rep_count === 0, 'Rep count must be 0 at START');

  // Step 2: MOVING (arm raising to 55°)
  t += 100;
  leftAnalyzer.analyze(leftPose, makeLeftAngles(55), t);
  analysis = leftAnalyzer.analyze(leftPose, makeLeftAngles(55), t + 10);
  assert(analysis.state === MOVEMENT_STATES.MOVING, `Expected MOVING, got ${analysis.state}`);
  repResult = leftRepCounter.process(analysis, t + 10);
  assert(repResult.state === 'MOVING', `Expected rep counter state MOVING, got ${repResult.state}`);

  // Step 3: TARGET (arm at 90°)
  t += 200;
  leftAnalyzer.analyze(leftPose, makeLeftAngles(90), t);
  analysis = leftAnalyzer.analyze(leftPose, makeLeftAngles(90), t + 10);
  assert(analysis.state === MOVEMENT_STATES.TARGET, `Expected TARGET, got ${analysis.state}`);
  repResult = leftRepCounter.process(analysis, t + 10);
  assert(repResult.state === 'TARGET', `Expected rep counter state TARGET, got ${repResult.state}`);

  // Step 4: RETURNING (arm lowering to 45°)
  t += 200;
  leftAnalyzer.analyze(leftPose, makeLeftAngles(45), t);
  analysis = leftAnalyzer.analyze(leftPose, makeLeftAngles(45), t + 10);
  assert(analysis.state === MOVEMENT_STATES.RETURNING, `Expected RETURNING, got ${analysis.state}`);
  repResult = leftRepCounter.process(analysis, t + 10);
  assert(repResult.state === 'RETURNING', `Expected rep counter state RETURNING, got ${repResult.state}`);

  // Step 5: START (arm back at side — rep complete)
  t += 200;
  leftAnalyzer.analyze(leftPose, makeLeftAngles(20), t);
  analysis = leftAnalyzer.analyze(leftPose, makeLeftAngles(20), t + 10);
  assert(analysis.state === MOVEMENT_STATES.START, `Expected START, got ${analysis.state}`);
  repResult = leftRepCounter.process(analysis, t + 10);
  assert(repResult.rep_count === 1, `Expected rep_count to be 1, got ${repResult.rep_count}`);
  assert(repResult.rep_completed === true, 'rep_completed must be true on completion frame');
  console.log('  [PASS] Left arm repetition: START -> MOVING -> TARGET -> RETURNING -> START increments repCount to 1.');

  // Test 6: Full Right Arm Repetition Counting Pipeline (hip occluded, right side explicit)
  console.log('6. Verifying complete Right Arm repetition counting through full pipeline...');
  const rightAnalyzer = createExerciseAnalyzer('shoulder-abduction-scapular', { preferredSide: 'right' });
  const rightRepCounter = createRepCounter('shoulder-abduction-scapular', {
    consecutiveFramesToTransition: 1,
    minRepDurationMs: 100,
    cooldownMs: 50,
  });

  const rightPose = createMockPose({
    rightShoulder: { visibility: 0.95 },
    rightElbow: { visibility: 0.95 },
    rightHip: { visibility: 0.05, isValid: false }, // occluded hip
  });

  const makeRightAngles = (angle) => ({
    rightShoulder: { joint: 'rightShoulder', angle, confidence: 0.95, isValid: true },
  });

  t = 3000;
  // Step 1: START (right arm resting, hip occluded)
  let rAnalysis = rightAnalyzer.analyze(rightPose, makeRightAngles(20), t);
  assert(rAnalysis.state === MOVEMENT_STATES.START, `Expected START for right arm, got ${rAnalysis.state}`);
  assert(rAnalysis.primaryJoint === 'rightShoulder', `Expected rightShoulder, got ${rAnalysis.primaryJoint}`);
  let rRepResult = rightRepCounter.process(rAnalysis, t);
  assert(rRepResult.rep_count === 0, 'Initial right rep count must be 0');

  // Step 2: MOVING (right arm abducted to 60°)
  t += 100;
  rightAnalyzer.analyze(rightPose, makeRightAngles(60), t);
  rAnalysis = rightAnalyzer.analyze(rightPose, makeRightAngles(60), t + 10);
  assert(rAnalysis.state === MOVEMENT_STATES.MOVING, `Expected MOVING for right arm, got ${rAnalysis.state}`);
  rRepResult = rightRepCounter.process(rAnalysis, t + 10);
  assert(rRepResult.state === 'MOVING', `Expected rep counter state MOVING, got ${rRepResult.state}`);

  // Step 3: TARGET (right arm at 90°)
  t += 200;
  rightAnalyzer.analyze(rightPose, makeRightAngles(90), t);
  rAnalysis = rightAnalyzer.analyze(rightPose, makeRightAngles(90), t + 10);
  assert(rAnalysis.state === MOVEMENT_STATES.TARGET, `Expected TARGET for right arm, got ${rAnalysis.state}`);
  rRepResult = rightRepCounter.process(rAnalysis, t + 10);
  assert(rRepResult.state === 'TARGET', `Expected rep counter state TARGET, got ${rRepResult.state}`);

  // Step 4: RETURNING (right arm lowering to 45°)
  t += 200;
  rightAnalyzer.analyze(rightPose, makeRightAngles(45), t);
  rAnalysis = rightAnalyzer.analyze(rightPose, makeRightAngles(45), t + 10);
  assert(rAnalysis.state === MOVEMENT_STATES.RETURNING, `Expected RETURNING for right arm, got ${rAnalysis.state}`);
  rRepResult = rightRepCounter.process(rAnalysis, t + 10);
  assert(rRepResult.state === 'RETURNING', `Expected rep counter state RETURNING, got ${rRepResult.state}`);

  // Step 5: START (right arm back — rep complete)
  t += 200;
  rightAnalyzer.analyze(rightPose, makeRightAngles(20), t);
  rAnalysis = rightAnalyzer.analyze(rightPose, makeRightAngles(20), t + 10);
  assert(rAnalysis.state === MOVEMENT_STATES.START, `Expected START for right arm, got ${rAnalysis.state}`);
  rRepResult = rightRepCounter.process(rAnalysis, t + 10);
  assert(rRepResult.rep_count === 1, `Expected right rep_count to be 1, got ${rRepResult.rep_count}`);
  assert(rRepResult.rep_completed === true, 'rep_completed must be true on right rep completion');
  console.log('  [PASS] Right arm repetition with occluded hip: START -> MOVING -> TARGET -> RETURNING -> START increments repCount to 1.');

  console.log('\nAll Shoulder Abduction Runtime & Rep Counting Tests PASSED successfully!');
}

runShoulderAbductionRuntimeTests();
