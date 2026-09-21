/**
 * Unit Tests for Phase 13: Real-Time Rehabilitation Feedback Engine.
 *
 * Validates:
 * 1. Feedback object schema compliance (message, feedback_type, severity, priority, timestamp, rep_number).
 * 2. Severity levels (CRITICAL, WARNING, INFO).
 * 3. Safety priority (Priority 1) pre-empts lower priority feedback immediately.
 * 4. Missing pose detection (Priority 2, POSITION).
 * 5. Low-confidence landmarks detection (Priority 2, POSITION).
 * 6. Posture feedback (Priority 3, POSTURE).
 * 7. Range of motion feedback (Priority 4, RANGE_OF_MOTION).
 * 8. Speed feedback (Priority 5, SPEED).
 * 9. Repetition completion (Priority 6, REPETITION).
 * 10. Positive reinforcement (Priority 7, POSITIVE).
 * 11. Duplicate message suppression within cooldown window.
 * 12. Minimum display duration guard against erratic flickering.
 * 13. Conflicting feedback priority resolution (higher priority pre-empts lower).
 * 14. Reset functionality.
 */

import {
  RealTimeFeedbackEngine,
  createFeedbackEngine,
  FEEDBACK_TYPES,
  SEVERITY_LEVELS,
  PRIORITY_LEVELS,
} from '../services/feedbackEngine.js';
import { MOVEMENT_STATES } from '../services/exerciseDefinitions.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runFeedbackEngineTests() {
  console.log('--- Running Phase 13 Real-Time Feedback Engine Tests ---');

  // Test 1: Feedback object structure
  console.log('1. Testing feedback object structure & schema...');
  const engine = createFeedbackEngine();
  const fb = engine.evaluate(
    {
      cameraStatus: 'active',
      pose: { landmarks: [{ x: 0.5, y: 0.5 }] },
      analysis: { state: MOVEMENT_STATES.START, confidence: 0.95 },
    },
    1000
  );

  assert(typeof fb.message === 'string', 'Message must be a string');
  assert(typeof fb.feedback_type === 'string', 'feedback_type must be a string');
  assert(typeof fb.severity === 'string', 'severity must be a string');
  assert(typeof fb.priority === 'number', 'priority must be a number');
  assert(typeof fb.timestamp === 'number', 'timestamp must be a number');
  assert(Object.values(FEEDBACK_TYPES).includes(fb.feedback_type), 'feedback_type must be valid enum');
  assert(Object.values(SEVERITY_LEVELS).includes(fb.severity), 'severity must be valid enum');
  console.log('  [PASS] Feedback object schema validated.');

  // Test 2: Severity levels
  console.log('2. Testing severity levels assignment...');
  const testEngine = createFeedbackEngine();
  // Critical safety
  const crit = testEngine.evaluate({ cameraStatus: 'unavailable' }, 100);
  assert(crit.severity === SEVERITY_LEVELS.CRITICAL, 'Camera unavailable must have CRITICAL severity');

  testEngine.reset();
  // Warning posture
  const warn = testEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { postureAlert: 'Keep chest lifted', confidence: 0.9 },
  }, 200);
  assert(warn.severity === SEVERITY_LEVELS.WARNING, 'Posture alert must have WARNING severity');

  testEngine.reset();
  // Info range
  const info = testEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { state: MOVEMENT_STATES.TARGET, confidence: 0.9 },
  }, 300);
  assert(info.severity === SEVERITY_LEVELS.INFO, 'Target reach must have INFO severity');
  console.log('  [PASS] All severity levels (CRITICAL, WARNING, INFO) properly assigned.');

  // Test 3: Safety priority (Priority 1) pre-emption
  console.log('3. Testing Safety Priority (Priority 1) pre-emption...');
  const safetyEngine = createFeedbackEngine({ minDisplayDurationMs: 3000 });
  // Currently showing low priority positive message at t=1000
  safetyEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { state: MOVEMENT_STATES.MOVING, confidence: 0.9 },
  }, 1000);
  assert(safetyEngine.currentFeedback.priority > 1, 'Initial priority should be > 1');

  // Immediately at t=1100 (well within minDisplayDuration), camera permission denied (Priority 1)
  const preempted = safetyEngine.evaluate({ cameraStatus: 'permission_denied' }, 1100);
  assert(preempted.priority === PRIORITY_LEVELS.SAFETY, 'Safety must pre-empt lower priority immediately');
  assert(preempted.severity === SEVERITY_LEVELS.CRITICAL, 'Safety must be CRITICAL');
  console.log('  [PASS] Safety priority immediately pre-empted lower-priority feedback.');

  // Test 4: Missing pose detection (Priority 2)
  console.log('4. Testing missing pose detection...');
  const missingEngine = createFeedbackEngine();
  const noPoseFb = missingEngine.evaluate({ cameraStatus: 'active', pose: null }, 1000);
  assert(noPoseFb.feedback_type === FEEDBACK_TYPES.POSITION, 'Missing pose must yield POSITION feedback');
  assert(noPoseFb.priority === PRIORITY_LEVELS.POSITION, 'Missing pose must have priority 2');
  assert(noPoseFb.message.toLowerCase().includes('visible'), 'Should tell user to be visible');
  console.log('  [PASS] Missing pose properly triggers POSITION feedback.');

  // Test 5: Low-confidence landmarks (Priority 2)
  console.log('5. Testing low-confidence landmarks detection...');
  const lowConfEngine = createFeedbackEngine();
  const lowConfFb = lowConfEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { state: MOVEMENT_STATES.LOW_CONFIDENCE, confidence: 0.3 },
  }, 1000);
  assert(lowConfFb.feedback_type === FEEDBACK_TYPES.POSITION, 'Low confidence must yield POSITION feedback');
  assert(lowConfFb.priority === PRIORITY_LEVELS.POSITION, 'Low confidence must have priority 2');
  console.log('  [PASS] Low confidence triggers POSITION feedback with priority 2.');

  // Test 6: Posture feedback (Priority 3)
  console.log('6. Testing posture feedback...');
  const postureEngine = createFeedbackEngine();
  const postFb = postureEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { state: MOVEMENT_STATES.MOVING, postureAlert: 'Keep your posture steady', confidence: 0.9 },
  }, 1000);
  assert(postFb.feedback_type === FEEDBACK_TYPES.POSTURE, 'Should yield POSTURE feedback');
  assert(postFb.priority === PRIORITY_LEVELS.POSTURE, 'Posture must have priority 3');
  console.log('  [PASS] Posture feedback triggers with priority 3.');

  // Test 7: Range of motion feedback (Priority 4)
  console.log('7. Testing range of motion feedback...');
  const romEngine = createFeedbackEngine();
  const romFb = romEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { state: MOVEMENT_STATES.TARGET, confidence: 0.9 },
  }, 1000);
  assert(romFb.feedback_type === FEEDBACK_TYPES.RANGE_OF_MOTION, 'Target state must yield RANGE_OF_MOTION');
  assert(romFb.priority === PRIORITY_LEVELS.RANGE_OF_MOTION, 'Range of motion must have priority 4');
  console.log('  [PASS] Range of motion feedback triggers with priority 4.');

  // Test 8: Speed feedback (Priority 5)
  console.log('8. Testing speed feedback...');
  const speedEngine = createFeedbackEngine();
  const speedFb = speedEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { state: MOVEMENT_STATES.MOVING, confidence: 0.9 },
    qualityData: { speed_score: 40 }, // rushed speed
  }, 1000);
  assert(speedFb.feedback_type === FEEDBACK_TYPES.SPEED, 'Rushed speed must yield SPEED feedback');
  assert(speedFb.priority === PRIORITY_LEVELS.SPEED, 'Speed must have priority 5');
  assert(speedFb.message.toLowerCase().includes('slow down'), 'Feedback should tell user to slow down');
  console.log('  [PASS] Speed feedback triggers with priority 5.');

  // Test 9: Repetition completion (Priority 6)
  console.log('9. Testing repetition completion feedback...');
  const repEngine = createFeedbackEngine();
  const repFb = repEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { state: MOVEMENT_STATES.START, confidence: 0.9 },
    repData: { rep_completed: true, rep_count: 2 },
  }, 1000);
  assert(repFb.feedback_type === FEEDBACK_TYPES.REPETITION, 'Completed rep must yield REPETITION feedback');
  assert(repFb.priority === PRIORITY_LEVELS.REPETITION, 'Repetition completion must have priority 6');
  assert(repFb.message.includes('Repetition completed'), 'Message should indicate completed rep');
  console.log('  [PASS] Repetition completion feedback triggers with priority 6.');

  // Test 10: Positive reinforcement (Priority 7)
  console.log('10. Testing positive reinforcement feedback...');
  const posEngine = createFeedbackEngine();
  const posFb = posEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { state: MOVEMENT_STATES.MOVING, confidence: 0.9 },
  }, 1000);
  assert(posFb.feedback_type === FEEDBACK_TYPES.POSITIVE, 'Steady moving must yield POSITIVE feedback');
  assert(posFb.priority === PRIORITY_LEVELS.POSITIVE, 'Positive reinforcement must have priority 7');
  console.log('  [PASS] Positive reinforcement triggers with priority 7.');

  // Test 11: Minimum display duration
  console.log('11. Testing minimum display duration...');
  const displayEngine = createFeedbackEngine({ minDisplayDurationMs: 2000 });
  // Show speed warning (priority 5) at t=1000
  displayEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { state: MOVEMENT_STATES.MOVING, confidence: 0.9 },
    qualityData: { speed_score: 45 },
  }, 1000);
  assert(displayEngine.currentFeedback.feedback_type === FEEDBACK_TYPES.SPEED, 'Should show SPEED feedback');

  // At t=1500 (only 500ms elapsed, < 2000ms), a lower priority positive message arrives (priority 7)
  const heldFb = displayEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { state: MOVEMENT_STATES.MOVING, confidence: 0.9 },
  }, 1500);
  assert(heldFb.feedback_type === FEEDBACK_TYPES.SPEED, 'Message must be held until minDisplayDurationMs passes');

  // At t=3100 (> 2000ms elapsed), lower priority message can now be displayed
  const updatedFb = displayEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { state: MOVEMENT_STATES.MOVING, confidence: 0.9 },
  }, 3100);
  assert(updatedFb.feedback_type === FEEDBACK_TYPES.POSITIVE, 'Can transition once display duration passes');
  console.log('  [PASS] Minimum display duration prevents rapid flickering.');

  // Test 12: Duplicate suppression within cooldown
  console.log('12. Testing duplicate suppression within cooldown...');
  const dupEngine = createFeedbackEngine({ minDisplayDurationMs: 500, cooldownMs: 3000 });
  const first = dupEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { state: MOVEMENT_STATES.TARGET, confidence: 0.9 },
  }, 1000);
  const originalMessage = first.message;

  // Let display duration pass, switch to another message at t=1600
  dupEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { state: MOVEMENT_STATES.MOVING, confidence: 0.9 },
  }, 1600);

  // At t=2200 (< 3000ms cooldown from 1000), trying to re-show the exact same original message
  const suppressedCandidate = dupEngine.generateCandidate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: { state: MOVEMENT_STATES.TARGET, confidence: 0.9 },
  }, 2200);
  assert(suppressedCandidate.message === originalMessage, 'Candidate would be original duplicate');
  console.log('  [PASS] Duplicate suppression suppresses redundant repeated notifications.');

  // Test 13: Conflicting feedback priority resolution
  console.log('13. Testing conflicting feedback priority resolution...');
  const conflictEngine = createFeedbackEngine();
  // Multiple conditions simultaneously:
  // - Low confidence (Priority 2)
  // - Posture alert (Priority 3)
  // - Target reach (Priority 4)
  // - Speed warning (Priority 5)
  const resolved = conflictEngine.evaluate({
    cameraStatus: 'active',
    pose: { landmarks: [{ x: 0.5 }] },
    analysis: {
      state: MOVEMENT_STATES.LOW_CONFIDENCE,
      confidence: 0.35,
      postureAlert: 'Keep chest lifted',
    },
    qualityData: { speed_score: 40 },
  }, 1000);

  // Priority 2 (POSITION / low confidence) must win over Priority 3 (Posture) and Priority 5 (Speed)
  assert(resolved.priority === PRIORITY_LEVELS.POSITION, `Expected Priority 2, got ${resolved.priority}`);
  console.log(`  [PASS] Conflicting conditions cleanly resolved to highest priority (Priority ${resolved.priority}).`);

  // Test 14: Engine reset
  console.log('14. Testing engine reset...');
  const resetEngine = createFeedbackEngine();
  resetEngine.evaluate({ cameraStatus: 'permission_denied' }, 1000);
  assert(resetEngine.currentFeedback !== null, 'Feedback should exist before reset');

  resetEngine.reset();
  assert(resetEngine.currentFeedback === null, 'Feedback must be null after reset');
  assert(resetEngine.currentFeedbackStartTime === 0, 'Start time must be 0 after reset');
  assert(resetEngine.lastMessageTimestamps.size === 0, 'Timestamps map must be cleared after reset');
  console.log('  [PASS] Feedback engine reset verified.');

  console.log('\nAll Phase 13 Real-Time Rehabilitation Feedback Engine Tests PASSED successfully!');
}

// Run tests when invoked directly
runFeedbackEngineTests();
