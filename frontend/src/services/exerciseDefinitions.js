/**
 * Exercise Definitions & Clinical Configuration Registry.
 *
 * Phase 10: Reusable biomechanical specifications for therapeutic exercises.
 * Completely decoupled from React UI components.
 *
 * Each exercise specifies:
 * - required landmarks
 * - primary joints & side selection
 * - start, target, and return angle thresholds with tolerance
 * - movement direction (increasing or decreasing angle)
 * - clinical alignment / posture rules
 * - rule-based real-time coaching feedback
 */

/**
 * Standard movement state enumerations.
 */
export const MOVEMENT_STATES = {
  START: 'START',
  MOVING: 'MOVING',
  TARGET: 'TARGET',
  RETURNING: 'RETURNING',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  INVALID: 'INVALID',
};

/**
 * Built-in Rehabilitation Exercise Configurations.
 */
export const EXERCISE_DEFINITIONS = {
  'knee-flexion': {
    id: 'knee-flexion',
    name: 'Knee Flexion',
    description:
      'Bend the knee from an extended position toward 90 degrees under smooth control.',
    requiredLandmarks: ['leftHip', 'leftKnee', 'leftAnkle'],
    primaryJoints: ['leftKnee', 'rightKnee'],
    defaultSide: 'left',
    minConfidence: 0.5,
    // Angles for Knee Flexion: Hip -> Knee -> Ankle
    // Fully extended leg is ~170°-180°. As knee flexes, angle decreases toward 90°.
    movementDirection: 'decreasing',
    startingPosition: {
      angle: 170,
      tolerance: 15, // 155° to 180°
    },
    targetPosition: {
      angle: 90,
      tolerance: 15, // 75° to 105°
    },
    returnPosition: {
      angle: 165,
      tolerance: 15, // 150° to 180°
    },
    feedbackRules: {
      start: 'Extend leg comfortably into starting position.',
      moving: 'Smoothly bend your knee toward 90 degrees.',
      target: 'Target angle reached. Hold briefly, then return.',
      returning: 'Extend your knee steadily back to the start.',
      incomplete: 'Return detected before reaching target angle.',
      lowConfidence: 'Reposition so your knee and ankle are fully visible.',
      invalid: 'Cannot detect leg landmarks. Please step into frame.',
    },
  },

  'shoulder-raise': {
    id: 'shoulder-raise',
    name: 'Shoulder Raise',
    description:
      'Raise your arm forward or lateral from your side up to shoulder level (90 degrees).',
    requiredLandmarks: ['leftElbow', 'leftShoulder', 'leftHip'],
    primaryJoints: ['leftShoulder', 'rightShoulder'],
    defaultSide: 'left',
    minConfidence: 0.5,
    // Angles for Shoulder: Elbow -> Shoulder -> Hip
    // Arm resting at side is ~15°-30°. As arm raises, angle increases toward 90°.
    movementDirection: 'increasing',
    startingPosition: {
      angle: 25,
      tolerance: 15, // 10° to 40°
    },
    targetPosition: {
      angle: 90,
      tolerance: 15, // 75° to 105°
    },
    returnPosition: {
      angle: 30,
      tolerance: 15, // 15° to 45°
    },
    feedbackRules: {
      start: 'Rest your arm at your side to begin.',
      moving: 'Steadily raise your arm toward shoulder level.',
      target: 'Target elevation reached. Controlled pause before lowering.',
      returning: 'Smoothly lower your arm back to your side.',
      incomplete: 'Arm lowered before reaching target height.',
      lowConfidence: 'Ensure your shoulder and arm are in clear view.',
      invalid: 'Cannot detect shoulder landmarks. Adjust camera view.',
    },
  },

  squat: {
    id: 'squat',
    name: 'Squat',
    description:
      'Lower hips by bending knees and hips toward 90 degrees while keeping torso balanced.',
    requiredLandmarks: [
      'leftHip',
      'rightHip',
      'leftKnee',
      'rightKnee',
      'leftAnkle',
      'rightAnkle',
    ],
    primaryJoints: ['leftKnee', 'rightKnee'],
    defaultSide: 'both',
    minConfidence: 0.5,
    // Knee angle decreases from standing ~170° down toward ~90°
    movementDirection: 'decreasing',
    startingPosition: {
      angle: 170,
      tolerance: 12, // 158° to 180°
    },
    targetPosition: {
      angle: 95,
      tolerance: 15, // 80° to 110°
    },
    returnPosition: {
      angle: 165,
      tolerance: 12, // 153° to 180°
    },
    postureRules: {
      // Check torso tilt (Shoulder -> Hip -> Knee angle)
      minHipAngle: 60, // Hip flexion shouldn't collapse below 60° (excessive forward lean)
      excessiveLeanWarning: 'Keep chest lifted and avoid leaning too far forward.',
    },
    feedbackRules: {
      start: 'Stand tall with feet shoulder-width apart.',
      moving: 'Lower hips smoothly, keeping knees aligned over toes.',
      target: 'Depth reached. Drive through your heels to stand up.',
      returning: 'Rising back up to tall standing position.',
      incomplete: 'Return started before reaching target squat depth.',
      lowConfidence: 'Ensure hips, knees, and feet are visible in frame.',
      invalid: 'Full body landmarks not detected. Step back slightly.',
    },
  },
};

/**
 * Retrieve an exercise configuration by id with fallback.
 *
 * @param {string} exerciseId
 * @returns {object}
 */
export function getExerciseDefinition(exerciseId) {
  if (EXERCISE_DEFINITIONS[exerciseId]) {
    return EXERCISE_DEFINITIONS[exerciseId];
  }
  // Default fallback to knee-flexion
  return EXERCISE_DEFINITIONS['knee-flexion'];
}
