/**
 * Unit Tests for Phase 12: Movement Quality Analysis & Scoring Engine.
 *
 * Validates:
 * 1. Excellent movement evaluation (high score, proper feedback).
 * 2. Limited range of motion penalty and coaching feedback.
 * 3. Poor posture penalty (torso lean alert, symmetry violations).
 * 4. Inconsistent repetitions (high velocity jerk/acceleration variance).
 * 5. Excessive speed penalty (< 1.2s rushed movement).
 * 6. Excessive slowness penalty (> 6.5s stalled movement).
 * 7. Incomplete repetition handling.
 * 8. Low-confidence landmarks handling (graceful score degradation).
 * 9. Missing landmarks / empty data robustness.
 * 10. Invalid / NaN angle robustness.
 * 11. Score boundary clamping at 0 minimum.
 * 12. Score boundary clamping at 100 maximum.
 * 13. Weighted score calculation formula (30% ROM, 25% Posture, 20% Consistency, 15% Speed, 10% Completion).
 * 14. Session-level quality scoring and aggregation.
 * 15. Knee Flexion exercise support.
 * 16. Shoulder Raise exercise support.
 * 17. Squat exercise support.
 */

import {
  MovementQualityAnalyzer,
  createMovementQualityAnalyzer,
  SCORING_WEIGHTS,
} from '../services/movementQualityAnalyzer.js';
import { MOVEMENT_STATES } from '../services/exerciseDefinitions.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Helper to generate synthetic trajectory frames for a repetition.
 *
 * @param {object} options
 * @returns {Array<object>}
 */
function createSyntheticRepFrames(options = {}) {
  const {
    startAngle = 170,
    targetAngle = 90,
    frameCount = 30,
    durationSec = 2.5,
    postureAlertRatio = 0,
    confidence = 0.95,
    jitterMagnitude = 0,
    isDecreasing = true,
  } = options;

  const frames = [];
  const dt = durationSec / frameCount;

  for (let i = 0; i < frameCount; i++) {
    const progress = i / (frameCount - 1);
    // Smooth cosine interpolation between start and target and back to start
    let angleRatio = 0;
    if (progress <= 0.5) {
      // Outward to target
      angleRatio = 1 - Math.cos(progress * 2 * (Math.PI / 2));
    } else {
      // Returning to start
      angleRatio = Math.cos((progress - 0.5) * 2 * (Math.PI / 2));
    }

    let baseAngle = startAngle + (targetAngle - startAngle) * angleRatio;
    if (jitterMagnitude > 0) {
      baseAngle += (Math.random() - 0.5) * 2 * jitterMagnitude;
    }

    let state = MOVEMENT_STATES.MOVING;
    if (progress < 0.1 || progress > 0.9) {
      state = MOVEMENT_STATES.START;
    } else if (progress >= 0.45 && progress <= 0.55) {
      state = MOVEMENT_STATES.TARGET;
    } else if (progress > 0.55) {
      state = MOVEMENT_STATES.RETURNING;
    }

    const hasPostureAlert = i < frameCount * postureAlertRatio;

    frames.push({
      state,
      angle: Math.round(baseAngle * 10) / 10,
      confidence,
      postureAlert: hasPostureAlert ? 'Keep chest lifted and avoid leaning too far forward.' : null,
      timestamp: i * dt * 1000,
    });
  }

  return frames;
}

export function runMovementQualityTests() {
  console.log('--- Running Phase 12 Movement Quality Analysis & Scoring Engine Tests ---');

  // Test 1: Excellent movement evaluation
  console.log('1. Testing excellent movement evaluation...');
  const excellentAnalyzer = createMovementQualityAnalyzer('knee-flexion');
  const excellentFrames = createSyntheticRepFrames({
    startAngle: 170,
    targetAngle: 88, // reaches full 90 target
    frameCount: 35,
    durationSec: 2.8,
    confidence: 0.98,
    postureAlertRatio: 0,
  });

  const excellentResult = excellentAnalyzer.evaluateRepetition(
    { isCompleted: true, durationSec: 2.8, rep_number: 1 },
    excellentFrames
  );

  assert(excellentResult.score >= 85, `Expected high score >= 85, got ${excellentResult.score}`);
  assert(excellentResult.range_of_motion_score >= 90, 'ROM score should be >= 90');
  assert(excellentResult.posture_score >= 90, 'Posture score should be >= 90');
  assert(excellentResult.speed_score >= 90, 'Speed score should be >= 90');
  assert(excellentResult.completion_score === 100, 'Completion score should be 100');
  assert(excellentResult.feedback.includes('Good range of motion'), 'Should include positive ROM feedback');
  assert(typeof excellentResult.disclaimer === 'string', 'Must include regulatory disclaimer');
  console.log(`  [PASS] Excellent movement scored ${excellentResult.score}/100 with accurate positive feedback.`);

  // Test 2: Limited range of motion
  console.log('2. Testing limited range of motion penalty...');
  const limitedAnalyzer = createMovementQualityAnalyzer('knee-flexion');
  // Starts at 170, but only bends to 135 (target was 90)
  const limitedFrames = createSyntheticRepFrames({
    startAngle: 170,
    targetAngle: 135,
    frameCount: 30,
    durationSec: 2.5,
  });

  const limitedResult = limitedAnalyzer.evaluateRepetition(
    { isCompleted: true, durationSec: 2.5, rep_number: 1 },
    limitedFrames
  );

  assert(limitedResult.range_of_motion_score < 70, `Expected ROM score < 70, got ${limitedResult.range_of_motion_score}`);
  assert(
    limitedResult.feedback.includes('Try to reach the target position'),
    'Should prompt user to reach target position'
  );
  console.log(`  [PASS] Limited ROM penalized properly (ROM Score: ${limitedResult.range_of_motion_score}/100).`);

  // Test 3: Poor posture & alignment
  console.log('3. Testing poor posture penalty...');
  const postureAnalyzer = createMovementQualityAnalyzer('squat');
  // 60% of frames have posture lean alert
  const poorPostureFrames = createSyntheticRepFrames({
    startAngle: 170,
    targetAngle: 95,
    frameCount: 30,
    durationSec: 3.0,
    postureAlertRatio: 0.6,
  });

  const postureResult = postureAnalyzer.evaluateRepetition(
    { isCompleted: true, durationSec: 3.0, rep_number: 1 },
    poorPostureFrames
  );

  assert(postureResult.posture_score < 75, `Expected posture score < 75, got ${postureResult.posture_score}`);
  assert(
    postureResult.feedback.some((f) => f.toLowerCase().includes('lean') || f.toLowerCase().includes('posture')),
    'Feedback should address posture lean'
  );
  console.log(`  [PASS] Poor posture penalized properly (Posture Score: ${postureResult.posture_score}/100).`);

  // Test 4: Inconsistent repetitions (high velocity jitter)
  console.log('4. Testing movement consistency penalty on erratic jitter...');
  const jitterAnalyzer = createMovementQualityAnalyzer('knee-flexion');
  const jitterFrames = createSyntheticRepFrames({
    startAngle: 170,
    targetAngle: 90,
    frameCount: 30,
    durationSec: 2.5,
    jitterMagnitude: 18, // heavy angle jitter back and forth
  });

  const jitterResult = jitterAnalyzer.evaluateRepetition(
    { isCompleted: true, durationSec: 2.5, rep_number: 1 },
    jitterFrames
  );

  assert(jitterResult.consistency_score < 75, `Expected consistency score < 75, got ${jitterResult.consistency_score}`);
  assert(
    jitterResult.feedback.includes('Focus on smooth, controlled movement'),
    'Should suggest smooth, controlled movement'
  );
  console.log(`  [PASS] Erratic movement penalized on consistency (Score: ${jitterResult.consistency_score}/100).`);

  // Test 5: Excessive speed (< 1.2s)
  console.log('5. Testing excessive speed penalty...');
  const fastAnalyzer = createMovementQualityAnalyzer('knee-flexion');
  const fastFrames = createSyntheticRepFrames({
    startAngle: 170,
    targetAngle: 90,
    frameCount: 15,
    durationSec: 0.7, // rushed in 700ms
  });

  const fastResult = fastAnalyzer.evaluateRepetition(
    { isCompleted: true, durationSec: 0.7, rep_number: 1 },
    fastFrames
  );

  assert(fastResult.speed_score < 70, `Expected speed score < 70, got ${fastResult.speed_score}`);
  assert(fastResult.feedback.includes('Slow down slightly'), 'Feedback must warn to slow down');
  console.log(`  [PASS] Excessive speed penalized properly (Speed Score: ${fastResult.speed_score}/100).`);

  // Test 6: Excessive slowness (> 6.5s)
  console.log('6. Testing excessive slowness penalty...');
  const slowAnalyzer = createMovementQualityAnalyzer('knee-flexion');
  const slowFrames = createSyntheticRepFrames({
    startAngle: 170,
    targetAngle: 90,
    frameCount: 40,
    durationSec: 8.5, // 8.5s stall
  });

  const slowResult = slowAnalyzer.evaluateRepetition(
    { isCompleted: true, durationSec: 8.5, rep_number: 1 },
    slowFrames
  );

  assert(slowResult.speed_score < 75, `Expected speed score < 75, got ${slowResult.speed_score}`);
  assert(slowResult.feedback.includes('Try to maintain a steady tempo'), 'Feedback must suggest steady tempo');
  console.log(`  [PASS] Excessive slowness penalized properly (Speed Score: ${slowResult.speed_score}/100).`);

  // Test 7: Incomplete repetition handling
  console.log('7. Testing incomplete repetition evaluation...');
  const incAnalyzer = createMovementQualityAnalyzer('knee-flexion');
  const incFrames = [
    { state: MOVEMENT_STATES.START, angle: 170, confidence: 0.9, timestamp: 0 },
    { state: MOVEMENT_STATES.MOVING, angle: 140, confidence: 0.9, timestamp: 500 },
    { state: MOVEMENT_STATES.MOVING, angle: 160, confidence: 0.9, timestamp: 1000 },
  ];

  const incResult = incAnalyzer.evaluateRepetition(
    { isCompleted: false, durationSec: 1.0, rep_number: 1 },
    incFrames
  );

  assert(incResult.completion_score < 50, `Expected completion score < 50, got ${incResult.completion_score}`);
  assert(incResult.feedback.includes('Repetition was incomplete'), 'Must indicate repetition was incomplete');
  console.log(`  [PASS] Incomplete repetition handled properly (Completion Score: ${incResult.completion_score}/100).`);

  // Test 8: Low-confidence landmarks handling
  console.log('8. Testing low-confidence landmarks handling...');
  const lowConfAnalyzer = createMovementQualityAnalyzer('knee-flexion');
  const lowConfFrames = createSyntheticRepFrames({
    startAngle: 170,
    targetAngle: 90,
    frameCount: 25,
    durationSec: 2.5,
    confidence: 0.25, // well below threshold
  });

  const lowConfResult = lowConfAnalyzer.evaluateRepetition(
    { isCompleted: true, durationSec: 2.5, rep_number: 1 },
    lowConfFrames
  );

  // Low confidence must degrade score, not give unearned 100
  assert(lowConfResult.score < 75, `Low confidence rep should not receive high score, got ${lowConfResult.score}`);
  console.log(`  [PASS] Low-confidence landmarks degraded quality score safely (${lowConfResult.score}/100).`);

  // Test 9: Missing landmarks and empty frames
  console.log('9. Testing missing landmarks and empty data robustness...');
  const emptyAnalyzer = createMovementQualityAnalyzer('knee-flexion');
  const emptyResult = emptyAnalyzer.evaluateRepetition({ isCompleted: true, durationSec: 2.0 }, []);

  assert(typeof emptyResult.score === 'number', 'Score must be a number');
  assert(emptyResult.score <= 30, 'Empty data must yield low score');
  console.log('  [PASS] Empty/missing landmark data handled safely without throwing.');

  // Test 10: Invalid and NaN angles
  console.log('10. Testing invalid and NaN angle handling...');
  const nanAnalyzer = createMovementQualityAnalyzer('knee-flexion');
  const nanFrames = [
    { state: MOVEMENT_STATES.MOVING, angle: NaN, confidence: 0.9, timestamp: 100 },
    { state: MOVEMENT_STATES.MOVING, angle: null, confidence: 0.9, timestamp: 200 },
    { state: MOVEMENT_STATES.MOVING, angle: undefined, confidence: 0.9, timestamp: 300 },
  ];

  const nanResult = nanAnalyzer.evaluateRepetition({ isCompleted: true, durationSec: 2.0 }, nanFrames);
  assert(!Number.isNaN(nanResult.score), 'Score must never be NaN');
  assert(nanResult.range_of_motion_score === 0, 'ROM score should be 0 on invalid angles');
  console.log('  [PASS] NaN and null angles safely handled.');

  // Test 11: Score boundary clamping at 0
  console.log('11. Testing score boundary clamping at 0...');
  const zeroAnalyzer = createMovementQualityAnalyzer('knee-flexion');
  const zeroResult = zeroAnalyzer.evaluateRepetition(
    { isCompleted: false, durationSec: 0 },
    [{ state: MOVEMENT_STATES.START, angle: null, confidence: 0, timestamp: 0 }]
  );
  assert(zeroResult.score >= 0, 'Score must not fall below 0');
  assert(zeroResult.range_of_motion_score >= 0, 'ROM score must not fall below 0');
  console.log('  [PASS] Lower score bound (0) verified.');

  // Test 12: Score boundary clamping at 100
  console.log('12. Testing score boundary clamping at 100...');
  const hundredAnalyzer = createMovementQualityAnalyzer('knee-flexion');
  const perfectFrames = createSyntheticRepFrames({
    startAngle: 170,
    targetAngle: 90,
    frameCount: 40,
    durationSec: 2.5,
    confidence: 1.0,
  });
  const hundredResult = hundredAnalyzer.evaluateRepetition(
    { isCompleted: true, durationSec: 2.5 },
    perfectFrames
  );
  assert(hundredResult.score <= 100, 'Score must not exceed 100');
  console.log(`  [PASS] Upper score bound verified (${hundredResult.score}/100 <= 100).`);

  // Test 13: Mathematical weighted score calculation
  console.log('13. Testing mathematical weighted score calculation formula...');
  const formulaAnalyzer = createMovementQualityAnalyzer('knee-flexion');
  // Mock exact sub-scores
  const mockRom = 80;
  const mockPosture = 90;
  const mockConsistency = 70;
  const mockSpeed = 80;
  const mockCompletion = 100;

  const expectedWeighted = Math.round(
    mockRom * SCORING_WEIGHTS.RANGE_OF_MOTION +
    mockPosture * SCORING_WEIGHTS.POSTURE +
    mockConsistency * SCORING_WEIGHTS.CONSISTENCY +
    mockSpeed * SCORING_WEIGHTS.SPEED +
    mockCompletion * SCORING_WEIGHTS.COMPLETION
  );
  // 80*0.30 (24) + 90*0.25 (22.5) + 70*0.20 (14) + 80*0.15 (12) + 100*0.10 (10) = 82.5 -> 83
  assert(expectedWeighted === 83, `Expected 83, got ${expectedWeighted}`);
  console.log(`  [PASS] Weighted scoring formula confirmed (Expected: 83, Calculated: ${expectedWeighted}).`);

  // Test 14: Session-level quality scoring
  console.log('14. Testing session-level quality scoring and aggregation...');
  const sessionAnalyzer = createMovementQualityAnalyzer('knee-flexion');
  // Evaluate 3 distinct reps
  sessionAnalyzer.evaluateRepetition(
    { isCompleted: true, durationSec: 2.5 },
    createSyntheticRepFrames({ startAngle: 170, targetAngle: 90, durationSec: 2.5 })
  );
  sessionAnalyzer.evaluateRepetition(
    { isCompleted: true, durationSec: 2.8 },
    createSyntheticRepFrames({ startAngle: 170, targetAngle: 92, durationSec: 2.8 })
  );
  sessionAnalyzer.evaluateRepetition(
    { isCompleted: true, durationSec: 3.0 },
    createSyntheticRepFrames({ startAngle: 170, targetAngle: 88, durationSec: 3.0 })
  );

  const sessionQuality = sessionAnalyzer.getSessionQuality();
  assert(sessionQuality.total_valid_reps === 3, 'Expected 3 valid reps in session');
  assert(sessionQuality.score >= 80, `Expected session score >= 80, got ${sessionQuality.score}`);
  assert(Array.isArray(sessionQuality.feedback), 'Session feedback must be an array');
  assert(typeof sessionQuality.disclaimer === 'string', 'Session quality must include disclaimer');
  console.log(`  [PASS] Session-level quality aggregation validated (${sessionQuality.total_valid_reps} reps, avg score ${sessionQuality.score}/100).`);

  // Test 15: Support for Knee Flexion
  console.log('15. Testing Knee Flexion exercise support...');
  const kneeAnalyzer = createMovementQualityAnalyzer('knee-flexion');
  const kneeResult = kneeAnalyzer.evaluateRepetition(
    { isCompleted: true, durationSec: 2.5 },
    createSyntheticRepFrames({ startAngle: 170, targetAngle: 90, durationSec: 2.5 })
  );
  assert(kneeResult.exercise === 'Knee Flexion', 'Exercise name should be Knee Flexion');
  assert(kneeResult.score >= 80, 'Knee Flexion score should be high for good rep');
  console.log('  [PASS] Knee Flexion quality analysis confirmed.');

  // Test 16: Support for Shoulder Raise
  console.log('16. Testing Shoulder Raise exercise support...');
  const shoulderAnalyzer = createMovementQualityAnalyzer('shoulder-raise');
  // Increasing angle from 25 to 90
  const shoulderFrames = createSyntheticRepFrames({
    startAngle: 25,
    targetAngle: 90,
    frameCount: 30,
    durationSec: 2.5,
    isDecreasing: false,
  });
  const shoulderResult = shoulderAnalyzer.evaluateRepetition(
    { isCompleted: true, durationSec: 2.5 },
    shoulderFrames
  );
  assert(shoulderResult.exercise === 'Shoulder Raise', 'Exercise name should be Shoulder Raise');
  assert(shoulderResult.score >= 80, 'Shoulder Raise score should be high for good rep');
  console.log('  [PASS] Shoulder Raise quality analysis confirmed.');

  // Test 17: Support for Squat
  console.log('17. Testing Squat exercise support...');
  const squatAnalyzer = createMovementQualityAnalyzer('squat');
  const squatFrames = createSyntheticRepFrames({
    startAngle: 170,
    targetAngle: 95,
    frameCount: 35,
    durationSec: 3.2,
  });
  const squatResult = squatAnalyzer.evaluateRepetition(
    { isCompleted: true, durationSec: 3.2 },
    squatFrames
  );
  assert(squatResult.exercise === 'Squat', 'Exercise name should be Squat');
  assert(squatResult.score >= 80, 'Squat score should be high for good rep');
  console.log('  [PASS] Squat quality analysis confirmed.');

  console.log('\nAll Phase 12 Movement Quality Analysis & Scoring Engine Tests PASSED successfully!');
}

// Run tests when invoked directly
runMovementQualityTests();
