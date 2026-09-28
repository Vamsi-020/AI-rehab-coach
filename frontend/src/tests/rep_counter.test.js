/**
 * Unit Tests for Phase 11: Repetition Counting Engine.
 *
 * Validates:
 * 1. One complete repetition (START -> MOVING -> TARGET -> RETURNING -> START -> REP + 1).
 * 2. Multiple sequential repetitions.
 * 3. Incomplete repetition handling (aborting before TARGET).
 * 4. Duplicate target frame suppression (prolonged stay in TARGET).
 * 5. Low-confidence landmark rejection (confidence < threshold).
 * 6. Debouncing against rapid noise jitter.
 * 7. Minimum repetition duration guard (rejecting glitch speed movements).
 * 8. Session reset functionality.
 * 9. Support across all three Phase 10 exercises:
 *    - Knee Flexion
 *    - Shoulder Raise
 *    - Squat
 * 10. Structured output schema compliance.
 */

import { RepCounter, createRepCounter, REP_STATES } from '../services/repCounter.js';
import { MOVEMENT_STATES } from '../services/exerciseDefinitions.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Helper to feed a movement state to the RepCounter over N frames.
 *
 * @param {RepCounter} counter
 * @param {string} movementState
 * @param {number} frames
 * @param {number} startTimeMs
 * @param {number} frameIntervalMs
 * @param {number} confidence
 * @returns {{ lastResult: object, currentTime: number }}
 */
function simulateState(
  counter,
  movementState,
  frames = 2,
  startTimeMs = 0,
  frameIntervalMs = 50,
  confidence = 0.95
) {
  let currentTime = startTimeMs;
  let lastResult = null;

  for (let i = 0; i < frames; i++) {
    lastResult = counter.process(
      {
        exercise: counter.definition.name,
        state: movementState,
        confidence,
        feedback: `In state ${movementState}`,
      },
      currentTime
    );
    currentTime += frameIntervalMs;
  }

  return { lastResult, currentTime };
}

export function runRepCounterTests() {
  console.log('--- Running Phase 11 Repetition Counting Engine Tests ---');

  // Test 1: Structured result schema compliance
  console.log('1. Testing structured result format...');
  const testCounter = createRepCounter('knee-flexion');
  const res = testCounter.process({
    state: MOVEMENT_STATES.START,
    confidence: 0.92,
    feedback: 'Ready',
  }, 100);

  assert(typeof res.exercise === 'string', 'Missing exercise string in output');
  assert(typeof res.state === 'string', 'Missing state string in output');
  assert(typeof res.rep_count === 'number', 'Missing rep_count number');
  assert(typeof res.rep_completed === 'boolean', 'Missing rep_completed boolean');
  assert(typeof res.confidence === 'number', 'Missing confidence number');
  assert(typeof res.feedback === 'string', 'Missing feedback string');
  assert(res.rep_count === 0, 'Initial rep count should be 0');
  console.log('  [PASS] Structured result format confirmed.');

  // Test 2: One complete repetition lifecycle
  console.log('2. Testing one complete repetition lifecycle...');
  const rep1Counter = createRepCounter('knee-flexion', {
    consecutiveFramesToTransition: 2,
    minRepDurationMs: 400,
    cooldownMs: 200,
  });

  let t = 1000;
  // Step 1: START
  let step = simulateState(rep1Counter, MOVEMENT_STATES.START, 3, t, 50);
  t = step.currentTime;
  assert(rep1Counter.repCount === 0, 'Rep count should be 0 in START');
  assert(rep1Counter.state === REP_STATES.START, 'State should be START');

  // Step 2: MOVING
  step = simulateState(rep1Counter, MOVEMENT_STATES.MOVING, 3, t, 50);
  t = step.currentTime;
  assert(rep1Counter.state === REP_STATES.MOVING, 'State should be MOVING');
  assert(rep1Counter.repCount === 0, 'Rep count should be 0 during MOVING');

  // Step 3: TARGET
  step = simulateState(rep1Counter, MOVEMENT_STATES.TARGET, 3, t, 50);
  t = step.currentTime;
  assert(rep1Counter.state === REP_STATES.TARGET, 'State should be TARGET');
  assert(rep1Counter.repCount === 0, 'Rep count should be 0 during TARGET');

  // Step 4: RETURNING
  step = simulateState(rep1Counter, MOVEMENT_STATES.RETURNING, 3, t, 50);
  t = step.currentTime;
  assert(rep1Counter.state === REP_STATES.RETURNING, 'State should be RETURNING');
  assert(rep1Counter.repCount === 0, 'Rep count should be 0 during RETURNING');

  // Step 5: START (Completes repetition)
  t += 200; // ensure total duration > minRepDurationMs
  step = simulateState(rep1Counter, MOVEMENT_STATES.START, 2, t, 50);
  t = step.currentTime;

  assert(rep1Counter.repCount === 1, `Expected 1 rep completed, got ${rep1Counter.repCount}`);
  assert(step.lastResult.rep_completed === true, 'rep_completed must be true on completion frame');
  assert(rep1Counter.state === REP_STATES.START, 'State should return to START');
  console.log('  [PASS] One complete repetition successfully counted (START -> MOVING -> TARGET -> RETURNING -> START).');

  // Test 3: Multiple repetitions
  console.log('3. Testing multiple sequential repetitions...');
  const multiCounter = createRepCounter('knee-flexion', {
    consecutiveFramesToTransition: 2,
    minRepDurationMs: 300,
    cooldownMs: 150,
  });

  t = 1000;
  for (let rep = 1; rep <= 3; rep++) {
    t += 200; // pass cooldown
    t = simulateState(multiCounter, MOVEMENT_STATES.START, 2, t, 40).currentTime;
    t = simulateState(multiCounter, MOVEMENT_STATES.MOVING, 2, t, 40).currentTime;
    t = simulateState(multiCounter, MOVEMENT_STATES.TARGET, 2, t, 40).currentTime;
    t = simulateState(multiCounter, MOVEMENT_STATES.RETURNING, 2, t, 40).currentTime;
    t += 200; // satisfy minRepDuration
    const finish = simulateState(multiCounter, MOVEMENT_STATES.START, 2, t, 40);
    t = finish.currentTime;
    assert(multiCounter.repCount === rep, `Expected ${rep} reps, got ${multiCounter.repCount}`);
  }
  assert(multiCounter.getStats().totalCompleted === 3, 'Stats should show 3 completed reps');
  console.log('  [PASS] Multiple sequential repetitions verified (3/3 reps counted accurately).');

  // Test 4: Incomplete repetition rejection
  console.log('4. Testing incomplete repetition rejection...');
  const incompleteCounter = createRepCounter('knee-flexion', {
    consecutiveFramesToTransition: 2,
    minRepDurationMs: 300,
  });

  t = 1000;
  // Start moving, but return to start before ever reaching TARGET
  t = simulateState(incompleteCounter, MOVEMENT_STATES.START, 2, t, 50).currentTime;
  t = simulateState(incompleteCounter, MOVEMENT_STATES.MOVING, 4, t, 50).currentTime;
  // User gives up and returns to START
  t = simulateState(incompleteCounter, MOVEMENT_STATES.START, 3, t, 50).currentTime;

  assert(incompleteCounter.repCount === 0, 'Incomplete movement must NOT count as a repetition');
  assert(incompleteCounter.state === REP_STATES.START, 'State should reset cleanly to START');
  console.log('  [PASS] Incomplete repetition correctly rejected without counting.');

  // Test 5: Duplicate target frame suppression
  console.log('5. Testing duplicate target frame suppression...');
  const dupCounter = createRepCounter('knee-flexion', {
    consecutiveFramesToTransition: 2,
  });

  t = 1000;
  t = simulateState(dupCounter, MOVEMENT_STATES.START, 2, t, 50).currentTime;
  t = simulateState(dupCounter, MOVEMENT_STATES.MOVING, 2, t, 50).currentTime;
  // User stays at peak target hold for 30 consecutive frames (1.5 seconds)
  const targetHold = simulateState(dupCounter, MOVEMENT_STATES.TARGET, 30, t, 50);
  t = targetHold.currentTime;

  assert(dupCounter.repCount === 0, 'Rep count must remain 0 while holding TARGET');
  assert(dupCounter.state === REP_STATES.TARGET, 'State must remain in TARGET');

  // Then user returns and finishes rep
  t = simulateState(dupCounter, MOVEMENT_STATES.RETURNING, 2, t, 50).currentTime;
  t = simulateState(dupCounter, MOVEMENT_STATES.START, 2, t, 50).currentTime;
  assert(dupCounter.repCount === 1, 'Only exactly 1 rep should be counted after prolonged hold');
  console.log('  [PASS] Duplicate target frames safely suppressed; exactly 1 rep counted.');

  // Test 6: Low-confidence landmarks rejection
  console.log('6. Testing low-confidence landmarks rejection...');
  const lowConfCounter = createRepCounter('knee-flexion', {
    confidenceThreshold: 0.6,
  });

  t = 1000;
  t = simulateState(lowConfCounter, MOVEMENT_STATES.START, 2, t, 50, 0.95).currentTime;
  t = simulateState(lowConfCounter, MOVEMENT_STATES.MOVING, 2, t, 50, 0.95).currentTime;

  // Frame with low confidence (0.3 < 0.6) reporting TARGET
  const lowConfRes = lowConfCounter.process(
    {
      exercise: 'Knee Flexion',
      state: MOVEMENT_STATES.TARGET,
      confidence: 0.3,
      feedback: 'Low confidence',
    },
    t
  );
  assert(lowConfCounter.state === REP_STATES.MOVING, 'Low confidence frame must not advance rep state');
  assert(lowConfRes.rep_count === 0, 'No rep counted on low confidence');
  console.log('  [PASS] Low-confidence landmarks correctly ignored.');

  // Test 7: Debounce and noisy state jitter handling
  console.log('7. Testing debounce and noisy state jitter handling...');
  const jitterCounter = createRepCounter('knee-flexion', {
    consecutiveFramesToTransition: 3, // requires 3 consecutive frames
  });

  t = 1000;
  t = simulateState(jitterCounter, MOVEMENT_STATES.START, 3, t, 50).currentTime;

  // A single frame jitter to MOVING then immediately back to START
  jitterCounter.process({ state: MOVEMENT_STATES.MOVING, confidence: 0.9 }, t);
  t += 30;
  assert(jitterCounter.state === REP_STATES.START, 'Single frame jitter must not switch state');

  jitterCounter.process({ state: MOVEMENT_STATES.START, confidence: 0.9 }, t);
  assert(jitterCounter.state === REP_STATES.START, 'State held firmly in START');
  console.log('  [PASS] Rapid noisy frame jitter properly debounced.');

  // Test 8: Minimum repetition duration guard
  console.log('8. Testing minimum repetition duration guard...');
  const speedCounter = createRepCounter('knee-flexion', {
    consecutiveFramesToTransition: 1,
    minRepDurationMs: 600, // physically requires at least 600ms
  });

  t = 1000;
  // Impossibly fast glitch rep in 80ms total
  simulateState(speedCounter, MOVEMENT_STATES.START, 1, t, 20);
  simulateState(speedCounter, MOVEMENT_STATES.MOVING, 1, t + 20, 20);
  simulateState(speedCounter, MOVEMENT_STATES.TARGET, 1, t + 40, 20);
  simulateState(speedCounter, MOVEMENT_STATES.RETURNING, 1, t + 60, 20);
  simulateState(speedCounter, MOVEMENT_STATES.START, 1, t + 80, 20);

  assert(speedCounter.repCount === 0, 'Glitch speed repetition below minRepDurationMs must be rejected');
  console.log('  [PASS] Glitch speed movement below minRepDurationMs correctly rejected.');

  // Test 9: Session reset
  console.log('9. Testing session reset...');
  const resetCounter = createRepCounter('knee-flexion', {
    consecutiveFramesToTransition: 1,
    minRepDurationMs: 100,
  });

  t = 1000;
  simulateState(resetCounter, MOVEMENT_STATES.START, 1, t, 50);
  simulateState(resetCounter, MOVEMENT_STATES.MOVING, 1, t + 50, 50);
  simulateState(resetCounter, MOVEMENT_STATES.TARGET, 1, t + 100, 50);
  simulateState(resetCounter, MOVEMENT_STATES.RETURNING, 1, t + 150, 50);
  simulateState(resetCounter, MOVEMENT_STATES.START, 1, t + 200, 50);
  assert(resetCounter.repCount === 1, 'Should have 1 rep before reset');

  resetCounter.reset();
  assert(resetCounter.repCount === 0, 'Rep count must be 0 after reset');
  assert(resetCounter.state === REP_STATES.START, 'State must be START after reset');
  assert(resetCounter.getStats().totalCompleted === 0, 'Stats must be zeroed after reset');
  console.log('  [PASS] Session reset cleared all states and counters.');

  // Test 10: Support for all therapeutic exercises including Shoulder Abduction
  console.log('10. Testing support for Knee Flexion, Shoulder Raise, Squat, and Shoulder Abduction...');
  const exercises = [
    'knee-flexion',
    'shoulder-raise',
    'squat',
    'shoulder-abduction-scapular',
    'shoulder-abduction',
  ];

  for (const exId of exercises) {
    const exCounter = createRepCounter(exId, {
      consecutiveFramesToTransition: 1,
      minRepDurationMs: 100,
      cooldownMs: 50,
    });

    t = 1000;
    simulateState(exCounter, MOVEMENT_STATES.START, 1, t, 50);
    simulateState(exCounter, MOVEMENT_STATES.MOVING, 1, t + 50, 50);
    simulateState(exCounter, MOVEMENT_STATES.TARGET, 1, t + 100, 50);
    simulateState(exCounter, MOVEMENT_STATES.RETURNING, 1, t + 150, 50);
    const endStep = simulateState(exCounter, MOVEMENT_STATES.START, 1, t + 200, 50);

    assert(exCounter.repCount === 1, `Exercise ${exId} should have completed 1 rep`);
    assert(endStep.lastResult.exercise === exCounter.definition.name, `Output exercise name mismatch for ${exId}`);
  }
  console.log('  [PASS] All therapeutic exercises (Knee Flexion, Shoulder Raise, Squat, Shoulder Abduction) supported.');

  // Test 11: Shoulder Abduction Left and Right Complete Repetition Counting
  console.log('11. Testing Shoulder Abduction left and right complete repetition counting...');
  const abdCounter = createRepCounter('shoulder-abduction-scapular', {
    consecutiveFramesToTransition: 1,
    minRepDurationMs: 100,
    cooldownMs: 50,
  });

  // Rep 1: Left arm complete rep
  let curT = 1000;
  simulateState(abdCounter, MOVEMENT_STATES.START, 1, curT, 50);
  simulateState(abdCounter, MOVEMENT_STATES.MOVING, 1, curT + 100, 50);
  simulateState(abdCounter, MOVEMENT_STATES.TARGET, 1, curT + 200, 50);
  simulateState(abdCounter, MOVEMENT_STATES.RETURNING, 1, curT + 300, 50);
  const rep1Result = simulateState(abdCounter, MOVEMENT_STATES.START, 1, curT + 400, 50);

  assert(abdCounter.repCount === 1, `Expected repCount 1 after left rep, got ${abdCounter.repCount}`);
  assert(rep1Result.lastResult.rep_completed === true, 'rep_completed should be true on completion frame');

  // Rep 2: Right arm complete rep
  curT = 2000;
  simulateState(abdCounter, MOVEMENT_STATES.START, 1, curT, 50);
  simulateState(abdCounter, MOVEMENT_STATES.MOVING, 1, curT + 100, 50);
  simulateState(abdCounter, MOVEMENT_STATES.TARGET, 1, curT + 200, 50);
  simulateState(abdCounter, MOVEMENT_STATES.RETURNING, 1, curT + 300, 50);
  const rep2Result = simulateState(abdCounter, MOVEMENT_STATES.START, 1, curT + 400, 50);

  assert(abdCounter.repCount === 2, `Expected repCount 2 after right rep, got ${abdCounter.repCount}`);
  assert(rep2Result.lastResult.rep_completed === true, 'rep_completed should be true on completion frame of rep 2');
  console.log('  [PASS] Shoulder Abduction left and right reps counted accurately without double-counting.');

  console.log('\nAll Phase 11 Repetition Counting Engine Tests PASSED successfully!');
}

// Run tests when invoked directly
runRepCounterTests();
