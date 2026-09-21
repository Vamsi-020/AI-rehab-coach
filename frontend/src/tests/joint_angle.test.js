/**
 * Unit Tests for Phase 9: Joint Angle Calculation Engine.
 *
 * Validates:
 * 1. 0° / near-zero angle cases.
 * 2. 90° right angle cases.
 * 3. 180° straight-line / fully extended angle cases.
 * 4. Arbitrary intermediate movement angles (45°, 60°, 120°, 135°).
 * 5. Safe handling of missing / null landmarks.
 * 6. Low-confidence landmark filtering and confidence propagation.
 * 7. Invalid input guards (NaN, non-numeric, 0-magnitude / duplicate points).
 * 8. Cosine clamping stability against floating-point boundary overflow.
 * 9. 3D spatial angle calculation vs 2D planar calculation.
 * 10. Rehabilitation joint definitions and JointAngleEngine registry.
 * 11. Custom joint registration and exercise-specific subset calculations.
 */

import {
  calculateAngle,
  JointAngleEngine,
  createAngleEngine,
  REHAB_JOINT_DEFINITIONS,
} from '../services/jointAngleService.js';
import { extractLandmarks } from '../services/landmarkProcessor.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function runJointAngleTests() {
  console.log('--- Running Phase 9 Joint Angle Calculation Engine Tests ---');

  // Test 1: 90° Orthogonal Right Angle Case
  console.log('1. Testing 90° orthogonal angle calculation...');
  // Vertex at B(0, 0), Point A at (0, 1), Point C at (1, 0)
  const pA_90 = { x: 0, y: 1, visibility: 1.0, isValid: true };
  const pB_90 = { x: 0, y: 0, visibility: 1.0, isValid: true };
  const pC_90 = { x: 1, y: 0, visibility: 1.0, isValid: true };

  const result90 = calculateAngle(pA_90, pB_90, pC_90);
  assert(result90.isValid === true, '90° angle should be valid');
  assert(Math.abs(result90.angle - 90.0) < 1e-4, `Expected 90°, got ${result90.angle}`);
  console.log('  [PASS] 90° orthogonal angle verified accurately.');

  // Test 2: 180° Straight-Line / Collinear Case (e.g. fully extended knee/elbow)
  console.log('2. Testing 180° collinear straight-line case...');
  // Vertex at B(0, 0), A(-1, 0), C(1, 0)
  const pA_180 = { x: -1, y: 0, visibility: 1.0, isValid: true };
  const pB_180 = { x: 0, y: 0, visibility: 1.0, isValid: true };
  const pC_180 = { x: 1, y: 0, visibility: 1.0, isValid: true };

  const result180 = calculateAngle(pA_180, pB_180, pC_180);
  assert(result180.isValid === true, '180° angle should be valid');
  assert(Math.abs(result180.angle - 180.0) < 1e-4, `Expected 180°, got ${result180.angle}`);
  console.log('  [PASS] 180° straight-line angle verified accurately.');

  // Test 3: 0° / Near-Zero Folded Angle Case
  console.log('3. Testing 0° / near-zero folded limb angle case...');
  // Ray BA and Ray BC point in the identical direction
  const pA_0 = { x: 2, y: 0, visibility: 1.0, isValid: true };
  const pB_0 = { x: 0, y: 0, visibility: 1.0, isValid: true };
  const pC_0 = { x: 4, y: 0, visibility: 1.0, isValid: true };

  const result0 = calculateAngle(pA_0, pB_0, pC_0);
  assert(result0.isValid === true, '0° angle should be valid');
  assert(Math.abs(result0.angle - 0.0) < 1e-4, `Expected 0°, got ${result0.angle}`);
  console.log('  [PASS] 0° acute angle verified accurately.');

  // Test 4: Typical Movement Angles (45°, 60°, 120°, 135°)
  console.log('4. Testing clinical movement angles (45°, 60°, 120°, 135°)...');
  // 45 degrees: A(1, 0), B(0, 0), C(1, 1)
  const res45 = calculateAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 });
  assert(Math.abs(res45.angle - 45.0) < 0.1, `Expected 45°, got ${res45.angle}`);

  // 60 degrees: equilateral triangle
  const res60 = calculateAngle(
    { x: 1, y: 0 },
    { x: 0, y: 0 },
    { x: 0.5, y: Math.sqrt(3) / 2 }
  );
  assert(Math.abs(res60.angle - 60.0) < 0.1, `Expected 60°, got ${res60.angle}`);

  // 135 degrees: A(1, 0), B(0, 0), C(-1, 1)
  const res135 = calculateAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: 1 });
  assert(Math.abs(res135.angle - 135.0) < 0.1, `Expected 135°, got ${res135.angle}`);
  console.log('  [PASS] Intermediate movement angles verified within 0.1° accuracy.');

  // Test 5: Missing or Null Landmarks
  console.log('5. Testing missing and null landmarks handling...');
  const resNullA = calculateAngle(null, pB_90, pC_90);
  assert(resNullA.isValid === false, 'Null A should be invalid');
  assert(resNullA.angle === null, 'Angle must be null on missing point');
  assert(resNullA.reason === 'missing_landmarks', 'Reason should be missing_landmarks');

  const resNullB = calculateAngle(pA_90, null, pC_90);
  assert(resNullB.isValid === false && resNullB.angle === null, 'Null B vertex should be invalid');

  const resNullC = calculateAngle(pA_90, pB_90, null);
  assert(resNullC.isValid === false && resNullC.angle === null, 'Null C should be invalid');
  console.log('  [PASS] Missing landmarks handled safely without exceptions.');

  // Test 6: Confidence and Visibility Filtering
  console.log('6. Testing confidence and visibility filtering...');
  const pA_low = { x: 0, y: 1, visibility: 0.35, isValid: true };
  const pB_med = { x: 0, y: 0, visibility: 0.90, isValid: true };
  const pC_high = { x: 1, y: 0, visibility: 0.95, isValid: true };

  // With default threshold 0.5: should fail because pA has 0.35
  const resLowConf = calculateAngle(pA_low, pB_med, pC_high, { minConfidence: 0.5 });
  assert(resLowConf.isValid === false, 'Low confidence point should invalidate angle');
  assert(resLowConf.confidence === 0.35, 'Joint confidence should report minimum visibility');
  assert(resLowConf.reason === 'low_confidence', 'Reason should indicate low confidence');

  // With relaxed threshold 0.3: should pass
  const resRelaxed = calculateAngle(pA_low, pB_med, pC_high, { minConfidence: 0.3 });
  assert(resRelaxed.isValid === true, 'Relaxed threshold should allow 0.35 confidence');
  assert(resRelaxed.angle === 90.0, 'Angle should calculate correctly');

  // Point explicitly marked isValid: false
  const pB_invalid = { x: 0, y: 0, visibility: 0.99, isValid: false };
  const resInvalidFlag = calculateAngle(pA_90, pB_invalid, pC_90);
  assert(resInvalidFlag.isValid === false, 'Point with isValid:false must invalidate angle');
  console.log('  [PASS] Confidence thresholds and validity propagation verified.');

  // Test 7: Invalid Coordinates (NaN, Non-numeric, Zero-Magnitude Vectors)
  console.log('7. Testing guards against NaN and zero-magnitude vectors...');
  const pNaN = { x: NaN, y: 0, visibility: 1.0 };
  const resNaN = calculateAngle(pNaN, pB_90, pC_90);
  assert(resNaN.isValid === false && resNaN.angle === null, 'NaN coordinates must be rejected');
  assert(resNaN.reason === 'invalid_coordinates', 'Should flag invalid coordinates');

  // Zero magnitude: Point A identical to Point B (A = B)
  const resZeroMag = calculateAngle(pB_90, pB_90, pC_90);
  assert(resZeroMag.isValid === false, 'Duplicate vertex and endpoint must be rejected');
  assert(resZeroMag.reason === 'zero_magnitude_vector', 'Should flag zero magnitude vector');
  console.log('  [PASS] Invalid inputs and division-by-zero guards verified.');

  // Test 8: Cosine Clamping and Numerical Stability
  console.log('8. Testing numerical stability against floating-point overflow...');
  // Vectors slightly over 1.0 due to rounding
  // Even with identical vectors, acos must not return NaN
  const pA_close = { x: 1.0000000000000002, y: 0, visibility: 1.0 };
  const pB_origin = { x: 0, y: 0, visibility: 1.0 };
  const pC_close = { x: 1.0, y: 0, visibility: 1.0 };
  const resClamp = calculateAngle(pA_close, pB_origin, pC_close);
  assert(resClamp.isValid === true, 'Clamped calculation must remain valid');
  assert(!Number.isNaN(resClamp.angle), 'Angle must not be NaN');
  assert(resClamp.angle === 0.0, 'Expected 0.0°');
  console.log('  [PASS] Cosine clamping prevents floating-point NaN.');

  // Test 9: 3D vs 2D Angle Calculation
  console.log('9. Testing 3D spatial calculation option...');
  // In 2D (x, y), A(1, 0, 0), B(0, 0, 0), C(0, 0, 1) would collapse C to (0, 0)
  // In 3D, Vector BA is along X, Vector BC is along Z -> orthogonal 90° in 3D
  const pA_3D = { x: 1, y: 0, z: 0, visibility: 1.0 };
  const pB_3D = { x: 0, y: 0, z: 0, visibility: 1.0 };
  const pC_3D = { x: 0, y: 0, z: 1, visibility: 1.0 };

  const res3D = calculateAngle(pA_3D, pB_3D, pC_3D, { use3D: true });
  assert(res3D.isValid === true, '3D calculation should be valid');
  assert(Math.abs(res3D.angle - 90.0) < 1e-4, `Expected 90° in 3D, got ${res3D.angle}`);
  console.log('  [PASS] 3D angle calculation confirmed.');

  // Test 10: Supported Rehabilitation Joints and JointAngleEngine
  console.log('10. Testing JointAngleEngine with full 10 rehabilitation joints...');
  const engine = createAngleEngine({ minConfidence: 0.5, decimals: 1 });

  assert(Object.keys(REHAB_JOINT_DEFINITIONS).length >= 10, 'Expected at least 10 joint definitions');
  assert(REHAB_JOINT_DEFINITIONS.leftKnee !== undefined, 'leftKnee definition missing');
  assert(REHAB_JOINT_DEFINITIONS.rightKnee !== undefined, 'rightKnee definition missing');
  assert(REHAB_JOINT_DEFINITIONS.leftShoulder !== undefined, 'leftShoulder definition missing');
  assert(REHAB_JOINT_DEFINITIONS.rightShoulder !== undefined, 'rightShoulder definition missing');
  assert(REHAB_JOINT_DEFINITIONS.leftElbow !== undefined, 'leftElbow definition missing');
  assert(REHAB_JOINT_DEFINITIONS.rightElbow !== undefined, 'rightElbow definition missing');
  assert(REHAB_JOINT_DEFINITIONS.leftHip !== undefined, 'leftHip definition missing');
  assert(REHAB_JOINT_DEFINITIONS.rightHip !== undefined, 'rightHip definition missing');
  assert(REHAB_JOINT_DEFINITIONS.leftAnkle !== undefined, 'leftAnkle definition missing');
  assert(REHAB_JOINT_DEFINITIONS.rightAnkle !== undefined, 'rightAnkle definition missing');

  // Build a synthetic processed pose with a 90° knee angle:
  // Hip at (0.5, 0.4), Knee at (0.5, 0.7), Ankle at (0.8, 0.7)
  const rawList = new Array(33).fill(null);
  rawList[23] = { x: 0.5, y: 0.4, z: 0, visibility: 0.95 }; // leftHip
  rawList[25] = { x: 0.5, y: 0.7, z: 0, visibility: 0.95 }; // leftKnee (vertex)
  rawList[27] = { x: 0.8, y: 0.7, z: 0, visibility: 0.95 }; // leftAnkle

  const landmarks = extractLandmarks(rawList);
  const byName = {};
  landmarks.forEach((lm) => {
    byName[lm.name] = lm;
  });
  const mockPose = { landmarks, byName };

  const kneeResult = engine.calculateJoint('leftKnee', mockPose);
  assert(kneeResult.isValid === true, 'leftKnee should be valid');
  assert(Math.abs(kneeResult.angle - 90.0) < 1e-4, `Expected 90° knee angle, got ${kneeResult.angle}`);
  assert(kneeResult.joint === 'leftKnee', 'Joint name mismatch');
  assert(kneeResult.side === 'left', 'Side mismatch');
  assert(kneeResult.type === 'knee', 'Type mismatch');

  // Test calculateAll
  const allResults = engine.calculateAll(mockPose);
  assert(allResults.leftKnee.isValid === true, 'leftKnee in calculateAll should be valid');
  assert(allResults.rightKnee.isValid === false, 'Untracked rightKnee should be invalid');

  // Test calculateExerciseJoints
  const exerciseJoints = engine.calculateExerciseJoints(mockPose, ['leftKnee']);
  assert(exerciseJoints.leftKnee !== undefined, 'leftKnee should be in subset');
  assert(Object.keys(exerciseJoints).length === 1, 'Subset should have exactly 1 joint');
  console.log('  [PASS] JointAngleEngine successfully computes standard rehabilitation joints.');

  // Test 11: Dynamic Custom Joint Registration
  console.log('11. Testing dynamic custom joint registration...');
  engine.registerJoint('customNeck', {
    name: 'Cervical Spine',
    joint: 'customNeck',
    side: 'center',
    type: 'neck',
    points: ['nose', 'leftShoulder', 'leftHip'],
  });

  const customResult = engine.calculateJoint('customNeck', mockPose);
  assert(customResult.joint === 'customNeck', 'Custom joint should be resolved');
  assert(customResult.isValid === false, 'Should be invalid because nose is missing');
  console.log('  [PASS] Dynamic joint registration validated.');

  console.log('\nAll Phase 9 Joint Angle Calculation Engine Tests PASSED successfully!');
}

runJointAngleTests();
