/**
 * Phase 7: Camera & MediaPipe Pose Foundation Unit Tests.
 *
 * Validates:
 * 1. Camera service status constants and support checks.
 * 2. Pose landmark indices and essential rehabilitation connections.
 * 3. Confidence filtering logic for low-visibility/missing landmarks.
 * 4. Coordinate normalization and canvas drawing safety.
 */

import { CAMERA_STATUS, isCameraSupported } from '../services/cameraService.js';
import {
  POSE_LANDMARKS,
  POSE_CONNECTIONS,
  REHAB_KEY_JOINTS,
  filterLandmarks,
  drawPoseOverlay,
} from '../utils/poseDrawing.js';

function runTests() {
  console.log('--- Running Phase 7 Pose & Camera Tests ---');

  // Test 1: Camera Status Definitions
  console.log('1. Checking CAMERA_STATUS constants...');
  if (
    CAMERA_STATUS.STARTING === 'starting' &&
    CAMERA_STATUS.ACTIVE === 'active' &&
    CAMERA_STATUS.PERMISSION_DENIED === 'permission_denied' &&
    CAMERA_STATUS.UNAVAILABLE === 'unavailable' &&
    CAMERA_STATUS.STOPPED === 'stopped'
  ) {
    console.log('  [PASS] All required camera statuses defined.');
  } else {
    throw new Error('CAMERA_STATUS missing required status values');
  }

  // Test 2: Camera Support Guard
  console.log('2. Testing isCameraSupported in Node/headless environment...');
  const supportedInNode = isCameraSupported();
  // In Node.js, navigator.mediaDevices is undefined, should return false safely
  if (supportedInNode === false) {
    console.log('  [PASS] isCameraSupported returned false safely without throwing.');
  } else {
    throw new Error('isCameraSupported did not handle non-browser environment properly');
  }

  // Test 3: Essential Knee and Hip Landmarks
  console.log('3. Checking MediaPipe 33 standard landmark mappings...');
  if (
    POSE_LANDMARKS.NOSE === 0 &&
    POSE_LANDMARKS.LEFT_SHOULDER === 11 &&
    POSE_LANDMARKS.RIGHT_SHOULDER === 12 &&
    POSE_LANDMARKS.LEFT_HIP === 23 &&
    POSE_LANDMARKS.RIGHT_HIP === 24 &&
    POSE_LANDMARKS.LEFT_KNEE === 25 &&
    POSE_LANDMARKS.RIGHT_KNEE === 26 &&
    POSE_LANDMARKS.LEFT_ANKLE === 27 &&
    POSE_LANDMARKS.RIGHT_ANKLE === 28
  ) {
    console.log('  [PASS] Landmark indices correspond to official MediaPipe Pose model.');
  } else {
    throw new Error('Landmark indices mismatch');
  }

  // Test 4: Key Rehabilitation Joints
  console.log('4. Verifying clinical rehabilitation key joints set...');
  if (
    REHAB_KEY_JOINTS.has(POSE_LANDMARKS.LEFT_KNEE) &&
    REHAB_KEY_JOINTS.has(POSE_LANDMARKS.RIGHT_KNEE) &&
    REHAB_KEY_JOINTS.has(POSE_LANDMARKS.LEFT_HIP) &&
    REHAB_KEY_JOINTS.has(POSE_LANDMARKS.RIGHT_HIP)
  ) {
    console.log('  [PASS] Knee and hip therapeutic joints marked as key joints.');
  } else {
    throw new Error('Key rehabilitation joints missing knee/hip indices');
  }

  // Test 5: Low-Confidence Landmark Filtering
  console.log('5. Testing filterLandmarks with varying confidence levels...');
  const mockLandmarks = [
    { x: 0.5, y: 0.5, z: 0.0, visibility: 0.95 }, // High confidence -> valid
    { x: 0.3, y: 0.8, z: 0.0, visibility: 0.3 },  // Low confidence -> invalid
    { x: NaN, y: 0.4, z: 0.0, visibility: 0.9 },  // Invalid NaN coord -> invalid
    { x: 0.6, y: 0.7, z: 0.0 },                   // Default visibility (1.0) -> valid
  ];

  const filtered = filterLandmarks(mockLandmarks, 0.5);
  if (
    filtered[0].isValid === true &&
    filtered[1].isValid === false &&
    filtered[2].isValid === false &&
    filtered[3].isValid === true
  ) {
    console.log('  [PASS] Low-confidence and NaN landmarks filtered correctly.');
  } else {
    throw new Error('filterLandmarks failed to filter properly');
  }

  // Test 6: Safety when drawing overlay with null/empty inputs
  console.log('6. Testing drawPoseOverlay robustness on empty context or landmarks...');
  drawPoseOverlay(null, null, 640, 480);
  drawPoseOverlay(null, [], 640, 480);

  // Mock canvas context
  const mockCtx = {
    save: () => {},
    restore: () => {},
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    arc: () => {},
    fill: () => {},
  };
  drawPoseOverlay(mockCtx, [], 640, 480);
  drawPoseOverlay(mockCtx, mockLandmarks, 640, 480, true, 0.5);
  console.log('  [PASS] drawPoseOverlay runs safely with null, empty, and mock inputs.');

  console.log('\nAll Phase 7 Pose & Camera Tests PASSED successfully!');
}

runTests();
