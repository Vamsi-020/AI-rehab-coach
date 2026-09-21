/**
 * Phase 14 — Session Integration Tests.
 *
 * 15 tests covering the complete SessionController lifecycle:
 * state transitions, telemetry, persistence, duplicate prevention,
 * API failure fallback, and results schema.
 */

import { SessionController, createSessionController, SESSION_STATES } from '../services/sessionController.js';

// ── Minimal performance.now() shim ──────────────────────────────────────────
let _now = 0;
const mockNow = (ms) => { _now = ms; };
const now = () => _now;

// Replace global perf.now for controller calls
global.performance = { now };

// ── Minimal localStorage shim ────────────────────────────────────────────────
const _store = {};
global.localStorage = {
  getItem: (k) => _store[k] ?? null,
  setItem: (k, v) => { _store[k] = v; },
  removeItem: (k) => { delete _store[k]; },
};

// ── Test utilities ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  [PASS] ${label}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${label}`);
    console.error(`         ${err.message}`);
    failed++;
  }
}

async function testAsync(label, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${label}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${label}`);
    console.error(`         ${err.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertTrue(val, msg) {
  if (!val) throw new Error(msg || `Expected truthy, got ${JSON.stringify(val)}`);
}
function assertFalse(val, msg) {
  if (val) throw new Error(msg || `Expected falsy, got ${JSON.stringify(val)}`);
}

// ── Test Suite ───────────────────────────────────────────────────────────────
console.log('\n--- Running Phase 14 Session Integration Tests ---');

// 1. Session creation
test('Session creation: creates controller with READY state and defaults', () => {
  const ctrl = createSessionController();
  assertEqual(ctrl.status, SESSION_STATES.READY, 'Initial status must be READY');
  assertEqual(ctrl.completedReps, 0, 'Initial completedReps must be 0');
  assertEqual(ctrl.movementScore, 0, 'Initial movementScore must be 0');
  assertEqual(ctrl.config.targetReps, 12, 'Default targetReps must be 12');
  assertEqual(ctrl.config.exerciseName, 'Seated Knee Extension', 'Default exerciseName mismatch');
});

// 2. Session state transitions
test('Session state transitions: READY → ACTIVE, invalid transition rejected', () => {
  const ctrl = new SessionController();
  assertEqual(ctrl.status, SESSION_STATES.READY);

  const started = ctrl.start(now());
  assertTrue(started, 'start() must return true from READY');
  assertEqual(ctrl.status, SESSION_STATES.ACTIVE);

  // Cannot start again while ACTIVE
  const startedAgain = ctrl.start(now());
  assertFalse(startedAgain, 'start() must return false when already ACTIVE');
  assertEqual(ctrl.status, SESSION_STATES.ACTIVE);
});

// 3. Session start
test('Session start: transitions READY → ACTIVE, records startTime', () => {
  mockNow(1000);
  const ctrl = new SessionController();
  ctrl.start(now());
  assertEqual(ctrl.status, SESSION_STATES.ACTIVE);
  assertEqual(ctrl.startTime, 1000, 'startTime must match the provided now()');
  assertEqual(ctrl.lastResumeTime, 1000, 'lastResumeTime must be set on start');
});

// 4. Active session timer
test('Active session: elapsed active duration accumulates correctly', () => {
  mockNow(0);
  const ctrl = new SessionController();
  ctrl.start(now());

  mockNow(5000); // 5 seconds later
  const elapsed = ctrl.getActiveDurationSec(now());
  assertEqual(elapsed, 5, 'Elapsed duration must be 5s after 5000ms');
});

// 5. Pause / Resume
test('Pause/Resume: pausing stops timer, resuming restarts it accurately', () => {
  mockNow(0);
  const ctrl = new SessionController();
  ctrl.start(now());

  mockNow(3000); // 3s active
  const paused = ctrl.pause(now());
  assertTrue(paused, 'pause() must succeed from ACTIVE');
  assertEqual(ctrl.status, SESSION_STATES.PAUSED);
  assertEqual(ctrl.activeDurationMs, 3000, 'activeDurationMs must capture 3000ms on pause');

  mockNow(10000); // 7 more seconds pass while paused (should NOT count)
  const resumed = ctrl.resume(now());
  assertTrue(resumed, 'resume() must succeed from PAUSED');
  assertEqual(ctrl.status, SESSION_STATES.ACTIVE);

  mockNow(12000); // 2 more seconds active after resume
  const elapsed = ctrl.getActiveDurationSec(now());
  assertEqual(elapsed, 5, 'Elapsed must be 5s (3 pre-pause + 2 post-resume)');
});

// 6. Cancellation
test('Cancellation: transitions to CANCELLED safely from ACTIVE', () => {
  mockNow(0);
  const ctrl = new SessionController();
  ctrl.start(now());

  mockNow(2000);
  const cancelled = ctrl.cancel(now());
  assertTrue(cancelled, 'cancel() must return true from ACTIVE');
  assertEqual(ctrl.status, SESSION_STATES.CANCELLED);
  assertTrue(ctrl.sessionResults !== null, 'sessionResults must be built on cancel');
  assertEqual(ctrl.sessionResults.completion_status, SESSION_STATES.CANCELLED);
});

// 7. Repetition integration
test('Repetition integration: repCount updated via updateTelemetry()', () => {
  const ctrl = new SessionController();
  ctrl.start(now());

  ctrl.updateTelemetry({ repCount: 3 });
  assertEqual(ctrl.completedReps, 3, 'completedReps must update from telemetry');

  ctrl.updateTelemetry({ repCount: 7 });
  assertEqual(ctrl.completedReps, 7, 'completedReps must update incrementally');
});

// 8. Movement score integration
test('Movement score integration: score updated via updateTelemetry()', () => {
  const ctrl = new SessionController();
  ctrl.start(now());

  ctrl.updateTelemetry({ qualityData: { score: 82 } });
  assertEqual(ctrl.movementScore, 82, 'movementScore must update from qualityData');

  ctrl.updateTelemetry({ sessionQuality: { score: 91 } });
  assertEqual(ctrl.movementScore, 91, 'movementScore must update from sessionQuality');
});

// 9. Feedback integration
test('Feedback integration: feedback messages collected in feedbackEvents set', () => {
  const ctrl = new SessionController();
  ctrl.start(now());

  ctrl.updateTelemetry({ feedbackData: { message: 'Keep your posture steady' } });
  ctrl.updateTelemetry({ feedbackData: { message: 'Good range of motion' } });
  ctrl.updateTelemetry({ feedbackData: { message: 'Keep your posture steady' } }); // duplicate

  assertEqual(ctrl.feedbackEvents.size, 2, 'Duplicate feedback must be deduplicated by Set');
  assertTrue(ctrl.feedbackEvents.has('Keep your posture steady'));
  assertTrue(ctrl.feedbackEvents.has('Good range of motion'));
});

// 10. Session completion
testAsync('Session completion: transitions ACTIVE → COMPLETING → COMPLETED', async () => {
  const ctrl = new SessionController({
    onResultsReady: () => {},
  });
  ctrl.start(now());
  ctrl.updateTelemetry({ repCount: 12, qualityData: { score: 88 } });

  const results = await ctrl.complete({ isAuthenticated: false });

  assertEqual(ctrl.status, SESSION_STATES.COMPLETED, 'Status must be COMPLETED');
  assertTrue(results !== null, 'Results must be returned');
  assertEqual(results.completion_status, SESSION_STATES.COMPLETED, 'Result status mismatch');
  assertEqual(results.completed_reps, 12, 'Completed reps mismatch');
});

// 11. Duplicate completion prevention
testAsync('Duplicate completion prevention: second complete() call returns existing results', async () => {
  const ctrl = new SessionController();
  ctrl.start(now());

  const results1 = await ctrl.complete({ isAuthenticated: false });
  assertEqual(ctrl.status, SESSION_STATES.COMPLETED);

  // Second call must NOT re-enter COMPLETING; returns cached results
  const results2 = await ctrl.complete({ isAuthenticated: false });
  assertEqual(results1, results2, 'Second complete() must return same results object');
  assertEqual(ctrl.status, SESSION_STATES.COMPLETED, 'Status must remain COMPLETED');
});

// 12. Session persistence: builds correct payload schema
testAsync('Session persistence: buildSessionResults returns compliant schema', async () => {
  const ctrl = new SessionController({
    exerciseId: 'knee-flexion',
    exerciseName: 'Seated Knee Extension',
    targetReps: 12,
  });
  ctrl.start(now());
  ctrl.updateTelemetry({ repCount: 10, qualityData: { score: 76 } });

  const results = await ctrl.complete({ isAuthenticated: false });

  assertTrue('exercise_name' in results, 'Missing exercise_name');
  assertTrue('exercise_id' in results, 'Missing exercise_id');
  assertTrue('completed_reps' in results, 'Missing completed_reps');
  assertTrue('target_reps' in results, 'Missing target_reps');
  assertTrue('duration' in results, 'Missing duration');
  assertTrue('duration_sec' in results, 'Missing duration_sec');
  assertTrue('movement_score' in results, 'Missing movement_score');
  assertTrue('key_feedback' in results, 'Missing key_feedback');
  assertTrue('completion_status' in results, 'Missing completion_status');
  assertTrue('timestamp' in results, 'Missing timestamp');
  assertTrue('disclaimer' in results, 'Missing disclaimer');
  assertTrue(Array.isArray(results.key_feedback), 'key_feedback must be an array');
});

// 13. Results data accuracy
testAsync('Results response: completed_reps and movement_score propagated to results', async () => {
  const ctrl = new SessionController({ targetReps: 15 });
  ctrl.start(now());
  ctrl.updateTelemetry({ repCount: 14, qualityData: { score: 93 } });

  const results = await ctrl.complete({ isAuthenticated: false });
  assertEqual(results.completed_reps, 14, 'completed_reps must match telemetry');
  assertEqual(results.movement_score, 93, 'movement_score must match telemetry');
  assertEqual(results.target_reps, 15, 'target_reps must match config');
});

// 14. Telemetry ignored when not ACTIVE
test('Telemetry guard: updateTelemetry() is a no-op when session is not ACTIVE', () => {
  const ctrl = new SessionController();
  // READY state — telemetry should not update
  ctrl.updateTelemetry({ repCount: 99, qualityData: { score: 50 } });
  assertEqual(ctrl.completedReps, 0, 'completedReps must remain 0 when not ACTIVE');
  assertEqual(ctrl.movementScore, 0, 'movementScore must remain 0 when not ACTIVE');
});

// 15. API failure handling: graceful offline fallback
testAsync('API failure handling: complete() resolves successfully even if logSession throws', async () => {
  const throwingLogger = async () => { throw new Error('Network error — no connection'); };

  const ctrl = new SessionController({ onResultsReady: () => {} });
  ctrl.start(now());
  ctrl.updateTelemetry({ repCount: 8, qualityData: { score: 79 } });

  let results;
  let threw = false;
  try {
    results = await ctrl.complete({ isAuthenticated: true, customLogger: throwingLogger });
  } catch (err) {
    threw = true;
  }

  assertFalse(threw, 'complete() must NOT throw on network error');
  assertEqual(ctrl.status, SESSION_STATES.COMPLETED, 'Status must be COMPLETED despite network error');
  assertTrue(results !== null && results !== undefined, 'Results must be returned even after failure');
  assertEqual(results.completion_status, SESSION_STATES.COMPLETED);
});

// ── Summary ──────────────────────────────────────────────────────────────────
if (failed > 0) {
  console.error(`\nFAILED: ${failed} test(s) failed.\n`);
  process.exit(1);
} else {
  console.log(`\nAll Phase 14 Session Integration Tests PASSED successfully! (${passed}/${passed + failed})\n`);
}
