/**
 * Unit Tests for Phase 10: Exercise Analysis Engine.
 *
 * Validates:
 * 1. Knee Flexion movement lifecycle (START -> MOVING -> TARGET -> RETURNING -> START).
 * 2. Shoulder Raise movement lifecycle (increasing angle progression).
 * 3. Squat movement lifecycle and posture alignment alert (excessive trunk forward lean).
 * 4. Missing required landmarks detection -> MOVEMENT_STATES.INVALID.
 * 5. Low-confidence landmark detection -> MOVEMENT_STATES.LOW_CONFIDENCE.
 * 6. Invalid / NaN angle handling -> MOVEMENT_STATES.INVALID.
 * 7. Incomplete movement handling (reversing before reaching target).
 * 8. Resilience against noisy angle values (spike smoothing).
 * 9. Reset and dynamic exercise switching.
 */

import {
  ExerciseAnalyzer,
  createExerciseAnalyzer,
} from '../services/exerciseAnalyzer.js';
import {
  MOVEMENT_STATES,
  EXERCISE_DEFINITIONS,
  getExerciseDefinition,
} from '../services/exerciseDefinitions.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Helper to generate a mock pose with specific landmarks and visibility.
 */
function createMockPose(landmarksMap, defaultVis = 1.0) {
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

/**
 * Helper to generate mock pre-computed angles.
 */
function createMockAngles(jointName, angleVal, confidence = 1.0, isValid = true) {
  return {
    [jointName]: {
      joint: jointName,
      angle: angleVal,
      confidence,
      isValid,
    },
  };
}

function runExerciseAnalyzerTests() {
  console.log('--- Running Phase 10 Exercise Analysis Engine Tests ---');

  // Test 1: Exercise Definitions Registry
  console.log('1. Checking built-in exercise definitions (Knee Flexion, Shoulder Raise, Squat)...');
  assert(EXERCISE_DEFINITIONS['knee-flexion'] !== undefined, 'Knee flexion definition missing');
  assert(EXERCISE_DEFINITIONS['shoulder-raise'] !== undefined, 'Shoulder raise definition missing');
  assert(EXERCISE_DEFINITIONS['squat'] !== undefined, 'Squat definition missing');

  const def = getExerciseDefinition('knee-flexion');
  assert(def.id === 'knee-flexion', 'ID mismatch');
  assert(def.requiredLandmarks.includes('leftKnee'), 'Missing leftKnee requirement');
  assert(def.movementDirection === 'decreasing', 'Knee flexion should decrease angle');
  console.log('  [PASS] Exercise definitions properly configured.');

  // Test 2: Knee Flexion Full Lifecycle (START -> MOVING -> TARGET -> RETURNING -> START)
  console.log('2. Testing Knee Flexion lifecycle...');
  const kneeAnalyzer = createExerciseAnalyzer('knee-flexion', { preferredSide: 'left' });
  const kneePose = createMockPose({
    leftHip: { visibility: 0.95 },
    leftKnee: { visibility: 0.95 },
    leftAnkle: { visibility: 0.95 },
  });

  // State 1: Start Position (Standing / extended knee at 175°)
  const resStart = kneeAnalyzer.analyze(
    kneePose,
    createMockAngles('leftKnee', 175)
  );
  assert(resStart.state === MOVEMENT_STATES.START, `Expected START, got ${resStart.state}`);
  assert(resStart.progressPct === 0, `Expected 0% progress at start, got ${resStart.progressPct}`);
  assert(resStart.valid === true, 'Start state should be valid');

  // State 2: Moving toward target (Leg begins bending to 135°)
  const resMoving = kneeAnalyzer.analyze(
    kneePose,
    createMockAngles('leftKnee', 135)
  );
  assert(resMoving.state === MOVEMENT_STATES.MOVING, `Expected MOVING, got ${resMoving.state}`);
  assert(resMoving.progressPct > 20, `Expected >20% progress, got ${resMoving.progressPct}`);

  // State 3: Target reached (Knee bent to 88° and held at target)
  kneeAnalyzer.analyze(kneePose, createMockAngles('leftKnee', 88));
  const resTarget = kneeAnalyzer.analyze(
    kneePose,
    createMockAngles('leftKnee', 88)
  );
  assert(resTarget.state === MOVEMENT_STATES.TARGET, `Expected TARGET, got ${resTarget.state}`);
  assert(resTarget.progressPct === 100, `Expected 100% progress at target, got ${resTarget.progressPct}`);

  // State 4: Returning phase (Knee extending back up through 130°)
  const resReturning = kneeAnalyzer.analyze(
    kneePose,
    createMockAngles('leftKnee', 130)
  );
  assert(
    resReturning.state === MOVEMENT_STATES.RETURNING,
    `Expected RETURNING, got ${resReturning.state}`
  );

  // State 5: Back to start position (Knee back at 172°)
  const resReturned = kneeAnalyzer.analyze(
    kneePose,
    createMockAngles('leftKnee', 172)
  );
  assert(
    resReturned.state === MOVEMENT_STATES.START,
    `Expected START after return, got ${resReturned.state}`
  );
  console.log('  [PASS] Knee Flexion full movement lifecycle validated.');

  // Test 3: Shoulder Raise Lifecycle (Increasing Angle Movement)
  console.log('3. Testing Shoulder Raise lifecycle (increasing angle)...');
  const shoulderAnalyzer = createExerciseAnalyzer('shoulder-raise', { preferredSide: 'left' });
  const shoulderPose = createMockPose({
    leftHip: { visibility: 0.95 },
    leftShoulder: { visibility: 0.95 },
    leftElbow: { visibility: 0.95 },
  });

  // Start (Arm at side, 20°)
  const sStart = shoulderAnalyzer.analyze(
    shoulderPose,
    createMockAngles('leftShoulder', 20)
  );
  assert(sStart.state === MOVEMENT_STATES.START, `Expected START, got ${sStart.state}`);

  // Moving (Arm raising, 55°)
  const sMoving = shoulderAnalyzer.analyze(
    shoulderPose,
    createMockAngles('leftShoulder', 55)
  );
  assert(sMoving.state === MOVEMENT_STATES.MOVING, `Expected MOVING, got ${sMoving.state}`);

  // Target (Arm at shoulder height, 92°)
  shoulderAnalyzer.analyze(shoulderPose, createMockAngles('leftShoulder', 92));
  const sTarget = shoulderAnalyzer.analyze(
    shoulderPose,
    createMockAngles('leftShoulder', 92)
  );
  assert(sTarget.state === MOVEMENT_STATES.TARGET, `Expected TARGET, got ${sTarget.state}`);

  // Returning (Arm lowering, 45°)
  const sReturn = shoulderAnalyzer.analyze(
    shoulderPose,
    createMockAngles('leftShoulder', 45)
  );
  assert(sReturn.state === MOVEMENT_STATES.RETURNING, `Expected RETURNING, got ${sReturn.state}`);
  console.log('  [PASS] Shoulder Raise increasing angle lifecycle validated.');

  // Test 4: Squat Lifecycle & Posture Alignment Warning
  console.log('4. Testing Squat lifecycle and torso lean alignment warning...');
  const squatAnalyzer = createExerciseAnalyzer('squat');
  const squatPose = createMockPose({
    leftHip: { visibility: 0.95 },
    rightHip: { visibility: 0.95 },
    leftKnee: { visibility: 0.95 },
    rightKnee: { visibility: 0.95 },
    leftAnkle: { visibility: 0.95 },
    rightAnkle: { visibility: 0.95 },
  });

  // Standing start
  const sqStart = squatAnalyzer.analyze(
    squatPose,
    createMockAngles('leftKnee', 170)
  );
  assert(sqStart.state === MOVEMENT_STATES.START, `Expected START, got ${sqStart.state}`);

  // Moving / descending
  squatAnalyzer.analyze(squatPose, createMockAngles('leftKnee', 125));

  // Squat depth (Target knee angle 92°) with good torso posture (hip angle = 80°)
  const squatAnglesGood = {
    leftKnee: { angle: 92, confidence: 1.0, isValid: true },
    leftHip: { angle: 80, confidence: 1.0, isValid: true },
  };
  const sqTarget = squatAnalyzer.analyze(squatPose, squatAnglesGood);
  assert(sqTarget.state === MOVEMENT_STATES.TARGET, `Expected TARGET, got ${sqTarget.state}`);
  assert(sqTarget.postureAlert === null, 'No posture alert expected for normal hip angle');

  // Squat depth with excessive forward lean (hip angle collapsed to 45° < 60° limit)
  const squatAnglesLean = {
    leftKnee: { angle: 92, confidence: 1.0, isValid: true },
    leftHip: { angle: 45, confidence: 1.0, isValid: true },
  };
  const sqLean = squatAnalyzer.analyze(squatPose, squatAnglesLean);
  assert(
    sqLean.postureAlert !== null,
    'Expected posture alert for excessive forward trunk lean'
  );
  console.log('  [PASS] Squat lifecycle and posture alignment rules validated.');

  // Test 5: Missing Required Landmarks Handling
  console.log('5. Testing missing required landmarks detection...');
  const incompletePose = createMockPose({
    leftHip: { visibility: 0.95 },
    // leftKnee missing!
    leftAnkle: { visibility: 0.95 },
  });
  delete incompletePose.byName.leftKnee;

  const resMissing = kneeAnalyzer.analyze(incompletePose);
  assert(
    resMissing.state === MOVEMENT_STATES.INVALID,
    `Expected INVALID on missing landmark, got ${resMissing.state}`
  );
  assert(resMissing.valid === false, 'Result should be invalid');
  console.log('  [PASS] Missing landmarks correctly trigger INVALID state.');

  // Test 6: Low Confidence Landmark Handling
  console.log('6. Testing low confidence landmark detection...');
  const lowConfPose = createMockPose({
    leftHip: { visibility: 0.95 },
    leftKnee: { visibility: 0.25 }, // Low confidence (threshold is 0.5)
    leftAnkle: { visibility: 0.95 },
  });

  const resLowConf = kneeAnalyzer.analyze(lowConfPose);
  assert(
    resLowConf.state === MOVEMENT_STATES.LOW_CONFIDENCE,
    `Expected LOW_CONFIDENCE, got ${resLowConf.state}`
  );
  assert(resLowConf.valid === false, 'Result should be invalid');
  console.log('  [PASS] Low confidence correctly triggers LOW_CONFIDENCE state.');

  // Test 7: Invalid / NaN Angles
  console.log('7. Testing invalid and NaN angle handling...');
  const resNaN = kneeAnalyzer.analyze(
    kneePose,
    createMockAngles('leftKnee', NaN, 1.0, false)
  );
  assert(
    resNaN.state === MOVEMENT_STATES.INVALID,
    `Expected INVALID on NaN angle, got ${resNaN.state}`
  );
  assert(resNaN.valid === false, 'Result must be marked invalid');
  console.log('  [PASS] Invalid and NaN angles trigger INVALID state safely.');

  // Test 8: Incomplete Movement (Reversing before reaching target)
  console.log('8. Testing incomplete movement detection...');
  kneeAnalyzer.reset();
  // Start
  kneeAnalyzer.analyze(kneePose, createMockAngles('leftKnee', 170));
  // Move slightly (150, 145)
  kneeAnalyzer.analyze(kneePose, createMockAngles('leftKnee', 150));
  kneeAnalyzer.analyze(kneePose, createMockAngles('leftKnee', 145));
  // Reverse back toward start (152, 160) without reaching 90° target
  kneeAnalyzer.analyze(kneePose, createMockAngles('leftKnee', 152));
  const resIncomplete = kneeAnalyzer.analyze(kneePose, createMockAngles('leftKnee', 160));
  assert(
    resIncomplete.state === MOVEMENT_STATES.RETURNING ||
      resIncomplete.state === MOVEMENT_STATES.START,
    `Expected RETURNING or START for incomplete movement, got ${resIncomplete.state}`
  );
  console.log('  [PASS] Incomplete movement handled cleanly.');

  // Test 9: Noisy Angle Values (Spike Filtering via recent history)
  console.log('9. Testing spike filtering against sudden single-frame noisy measurements...');
  kneeAnalyzer.reset();
  // Series of stable target frames at 90°
  kneeAnalyzer.analyze(kneePose, createMockAngles('leftKnee', 90));
  kneeAnalyzer.analyze(kneePose, createMockAngles('leftKnee', 90));
  // A single sudden glitch frame spike to 180°
  const resGlitch = kneeAnalyzer.analyze(kneePose, createMockAngles('leftKnee', 180));
  // Due to history smoothing, the smoothed angle should not jump all the way to 180°
  assert(
    resGlitch.angle < 150,
    `Spike should be dampened by smoother, got ${resGlitch.angle}`
  );
  console.log('  [PASS] Single-frame noisy spikes properly dampened.');

  // Test 10: Dynamic Exercise Switching & State Reset
  console.log('10. Testing dynamic exercise switching and state reset...');
  kneeAnalyzer.setExercise('shoulder-raise');
  assert(kneeAnalyzer.definition.id === 'shoulder-raise', 'Should switch to shoulder-raise');
  assert(kneeAnalyzer.currentState === MOVEMENT_STATES.START, 'State should be reset to START');
  console.log('  [PASS] Dynamic exercise switching and reset validated.');

  // Test 11: Shoulder Abduction Definition & Biomechanical Verification
  console.log('11. Testing Shoulder Abduction definition, aliases, and movement lifecycle...');
  const abdScapularDef = getExerciseDefinition('shoulder-abduction-scapular');
  const abdDef = getExerciseDefinition('shoulder-abduction');

  assert(abdScapularDef !== undefined, 'shoulder-abduction-scapular definition must exist');
  assert(abdDef !== undefined, 'shoulder-abduction definition must exist');

  // Verify primary joints
  assert(
    abdScapularDef.primaryJoints.includes('leftShoulder') && abdScapularDef.primaryJoints.includes('rightShoulder'),
    'Shoulder abduction primary joints must include leftShoulder and rightShoulder'
  );
  assert(
    !abdScapularDef.primaryJoints.includes('leftKnee') && !abdScapularDef.primaryJoints.includes('rightKnee'),
    'Shoulder abduction must NOT use knee joints'
  );

  // Verify direction and thresholds
  assert(abdScapularDef.movementDirection === 'increasing', 'Shoulder abduction direction must be increasing');
  assert(abdScapularDef.startingPosition.angle >= 20 && abdScapularDef.startingPosition.angle <= 30, 'Starting angle around 25°');
  assert(abdScapularDef.targetPosition.angle >= 80 && abdScapularDef.targetPosition.angle <= 100, 'Target angle around 90°');
  assert(abdScapularDef.returnPosition.angle >= 20 && abdScapularDef.returnPosition.angle <= 40, 'Return angle around 30°');

  // Verify required landmarks are side-aware and do not require hip
  assert(abdScapularDef.requiredLandmarks.includes('leftElbow'), 'Must require elbow landmark');
  assert(abdScapularDef.requiredLandmarks.includes('leftShoulder'), 'Must require shoulder landmark');
  assert(!abdScapularDef.requiredLandmarks.includes('leftHip'), 'Shoulder abduction must NOT require hip landmark');
  assert(abdScapularDef.sideRequiredLandmarks?.right.includes('rightShoulder'), 'Right side must require rightShoulder');
  assert(abdScapularDef.sideRequiredLandmarks?.right.includes('rightElbow'), 'Right side must require rightElbow');

  // Left-arm shoulder abduction lifecycle (START -> MOVING -> TARGET -> RETURNING -> START)
  // Also verifies: hip visibility below 0.5 does not invalidate shoulder abduction!
  const abdAnalyzerLeft = createExerciseAnalyzer('shoulder-abduction-scapular', { preferredSide: 'left' });
  const abdPoseLeft = createMockPose({
    leftElbow: { visibility: 0.95 },
    leftShoulder: { visibility: 0.95 },
    leftHip: { visibility: 0.1 }, // Hip below 0.5 must NOT invalidate shoulder abduction!
  });

  const resLeftStart = abdAnalyzerLeft.analyze(abdPoseLeft, createMockAngles('leftShoulder', 25));
  assert(resLeftStart.state === MOVEMENT_STATES.START, `Expected START for left arm, got ${resLeftStart.state}`);

  abdAnalyzerLeft.analyze(abdPoseLeft, createMockAngles('leftShoulder', 55));
  const resLeftMoving = abdAnalyzerLeft.analyze(abdPoseLeft, createMockAngles('leftShoulder', 55));
  assert(resLeftMoving.state === MOVEMENT_STATES.MOVING, `Expected MOVING for left arm, got ${resLeftMoving.state}`);

  abdAnalyzerLeft.analyze(abdPoseLeft, createMockAngles('leftShoulder', 92));
  const resLeftTarget = abdAnalyzerLeft.analyze(abdPoseLeft, createMockAngles('leftShoulder', 92));
  assert(resLeftTarget.state === MOVEMENT_STATES.TARGET, `Expected TARGET for left arm, got ${resLeftTarget.state}`);

  abdAnalyzerLeft.analyze(abdPoseLeft, createMockAngles('leftShoulder', 50));
  const resLeftReturn = abdAnalyzerLeft.analyze(abdPoseLeft, createMockAngles('leftShoulder', 50));
  assert(resLeftReturn.state === MOVEMENT_STATES.RETURNING, `Expected RETURNING for left arm, got ${resLeftReturn.state}`);

  abdAnalyzerLeft.analyze(abdPoseLeft, createMockAngles('leftShoulder', 25));
  const resLeftCompleted = abdAnalyzerLeft.analyze(abdPoseLeft, createMockAngles('leftShoulder', 25));
  assert(resLeftCompleted.state === MOVEMENT_STATES.START, `Expected return to START for left arm, got ${resLeftCompleted.state}`);

  // Right-arm shoulder abduction lifecycle
  const abdAnalyzerRight = createExerciseAnalyzer('shoulder-abduction-scapular', { preferredSide: 'right' });
  const abdPoseRight = createMockPose({
    rightElbow: { visibility: 0.95 },
    rightShoulder: { visibility: 0.95 },
    rightHip: { visibility: 0.05 }, // Hip below 0.5 must NOT invalidate
  });

  const resRightStart = abdAnalyzerRight.analyze(abdPoseRight, createMockAngles('rightShoulder', 25));
  assert(resRightStart.state === MOVEMENT_STATES.START, `Expected START for right arm, got ${resRightStart.state}`);
  assert(resRightStart.primaryJoint === 'rightShoulder', `Expected rightShoulder, got ${resRightStart.primaryJoint}`);

  abdAnalyzerRight.analyze(abdPoseRight, createMockAngles('rightShoulder', 60));
  const resRightMoving = abdAnalyzerRight.analyze(abdPoseRight, createMockAngles('rightShoulder', 60));
  assert(resRightMoving.state === MOVEMENT_STATES.MOVING, `Expected MOVING for right arm, got ${resRightMoving.state}`);

  abdAnalyzerRight.analyze(abdPoseRight, createMockAngles('rightShoulder', 90));
  const resRightTarget = abdAnalyzerRight.analyze(abdPoseRight, createMockAngles('rightShoulder', 90));
  assert(resRightTarget.state === MOVEMENT_STATES.TARGET, `Expected TARGET for right arm, got ${resRightTarget.state}`);

  abdAnalyzerRight.analyze(abdPoseRight, createMockAngles('rightShoulder', 45));
  const resRightReturn = abdAnalyzerRight.analyze(abdPoseRight, createMockAngles('rightShoulder', 45));
  assert(resRightReturn.state === MOVEMENT_STATES.RETURNING, `Expected RETURNING for right arm, got ${resRightReturn.state}`);

  abdAnalyzerRight.analyze(abdPoseRight, createMockAngles('rightShoulder', 22));
  const resRightCompleted = abdAnalyzerRight.analyze(abdPoseRight, createMockAngles('rightShoulder', 22));
  assert(resRightCompleted.state === MOVEMENT_STATES.START, `Expected return to START for right arm, got ${resRightCompleted.state}`);

  // Test 12: Equal left/right confidence does not permanently force left side when right is selected or moving
  console.log('12. Testing side-selection when confidences are equal...');
  const dualPose = createMockPose({
    leftShoulder: { visibility: 0.98 },
    leftElbow: { visibility: 0.98 },
    rightShoulder: { visibility: 0.98 },
    rightElbow: { visibility: 0.98 },
  });
  const equalConfidenceAngles = {
    leftShoulder: { joint: 'leftShoulder', angle: 10, confidence: 0.98, isValid: true },
    rightShoulder: { joint: 'rightShoulder', angle: 10, confidence: 0.98, isValid: true },
  };

  // When right side is explicitly selected with equal confidence:
  const rightPrefAnalyzer = createExerciseAnalyzer('shoulder-abduction-scapular', { preferredSide: 'right' });
  const rightPrefRes = rightPrefAnalyzer.analyze(dualPose, equalConfidenceAngles);
  assert(rightPrefRes.primaryJoint === 'rightShoulder', `Explicit right must select rightShoulder, got ${rightPrefRes.primaryJoint}`);

  // When side is auto, but right arm begins moving:
  const autoAnalyzer = createExerciseAnalyzer('shoulder-abduction-scapular', { preferredSide: 'auto' });
  const rightMovingAngles = {
    leftShoulder: { joint: 'leftShoulder', angle: 10, confidence: 0.98, isValid: true },
    rightShoulder: { joint: 'rightShoulder', angle: 55, confidence: 0.98, isValid: true },
  };
  const autoRes = autoAnalyzer.analyze(dualPose, rightMovingAngles);
  assert(autoRes.primaryJoint === 'rightShoulder', `Auto mode must select actively moving right arm, got ${autoRes.primaryJoint}`);

  console.log('  [PASS] Shoulder Abduction definition, side-awareness, and lifecycles fully verified.');

  console.log('\nAll Phase 10 Exercise Analysis Engine Tests PASSED successfully!');
}

runExerciseAnalyzerTests();
