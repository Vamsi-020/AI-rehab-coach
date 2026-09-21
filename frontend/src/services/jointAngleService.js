/**
 * Joint Angle Calculation Engine.
 *
 * Phase 9: Reusable, mathematically stable biomechanical joint angle computation.
 * Calculates planar (2D) or spatial (3D) angles between anatomical segments:
 * Angle at joint vertex B between ray B->A and ray B->C.
 *
 * Designed to be completely independent from React UI, purely deterministic,
 * with comprehensive validation, confidence handling, and numerical clamping.
 */

import { LANDMARK_INDEX } from './landmarkProcessor.js';

/**
 * Standard Rehabilitation Joint Definitions.
 * Maps clinically monitored joints to their 3-point anatomical kinematic chain (A -> B -> C).
 * Point B is the vertex / joint center of rotation.
 */
export const REHAB_JOINT_DEFINITIONS = {
  leftShoulder: {
    name: 'Left Shoulder',
    joint: 'leftShoulder',
    side: 'left',
    type: 'shoulder',
    points: ['leftElbow', 'leftShoulder', 'leftHip'],
    landmarkIndices: [
      LANDMARK_INDEX.LEFT_ELBOW,
      LANDMARK_INDEX.LEFT_SHOULDER,
      LANDMARK_INDEX.LEFT_HIP,
    ],
    normalRange: { min: 0, max: 180 },
  },
  rightShoulder: {
    name: 'Right Shoulder',
    joint: 'rightShoulder',
    side: 'right',
    type: 'shoulder',
    points: ['rightElbow', 'rightShoulder', 'rightHip'],
    landmarkIndices: [
      LANDMARK_INDEX.RIGHT_ELBOW,
      LANDMARK_INDEX.RIGHT_SHOULDER,
      LANDMARK_INDEX.RIGHT_HIP,
    ],
    normalRange: { min: 0, max: 180 },
  },
  leftElbow: {
    name: 'Left Elbow',
    joint: 'leftElbow',
    side: 'left',
    type: 'elbow',
    points: ['leftShoulder', 'leftElbow', 'leftWrist'],
    landmarkIndices: [
      LANDMARK_INDEX.LEFT_SHOULDER,
      LANDMARK_INDEX.LEFT_ELBOW,
      LANDMARK_INDEX.LEFT_WRIST,
    ],
    normalRange: { min: 30, max: 180 },
  },
  rightElbow: {
    name: 'Right Elbow',
    joint: 'rightElbow',
    side: 'right',
    type: 'elbow',
    points: ['rightShoulder', 'rightElbow', 'rightWrist'],
    landmarkIndices: [
      LANDMARK_INDEX.RIGHT_SHOULDER,
      LANDMARK_INDEX.RIGHT_ELBOW,
      LANDMARK_INDEX.RIGHT_WRIST,
    ],
    normalRange: { min: 30, max: 180 },
  },
  leftHip: {
    name: 'Left Hip',
    joint: 'leftHip',
    side: 'left',
    type: 'hip',
    points: ['leftShoulder', 'leftHip', 'leftKnee'],
    landmarkIndices: [
      LANDMARK_INDEX.LEFT_SHOULDER,
      LANDMARK_INDEX.LEFT_HIP,
      LANDMARK_INDEX.LEFT_KNEE,
    ],
    normalRange: { min: 45, max: 180 },
  },
  rightHip: {
    name: 'Right Hip',
    joint: 'rightHip',
    side: 'right',
    type: 'hip',
    points: ['rightShoulder', 'rightHip', 'rightKnee'],
    landmarkIndices: [
      LANDMARK_INDEX.RIGHT_SHOULDER,
      LANDMARK_INDEX.RIGHT_HIP,
      LANDMARK_INDEX.RIGHT_KNEE,
    ],
    normalRange: { min: 45, max: 180 },
  },
  leftKnee: {
    name: 'Left Knee',
    joint: 'leftKnee',
    side: 'left',
    type: 'knee',
    points: ['leftHip', 'leftKnee', 'leftAnkle'],
    landmarkIndices: [
      LANDMARK_INDEX.LEFT_HIP,
      LANDMARK_INDEX.LEFT_KNEE,
      LANDMARK_INDEX.LEFT_ANKLE,
    ],
    normalRange: { min: 0, max: 180 },
  },
  rightKnee: {
    name: 'Right Knee',
    joint: 'rightKnee',
    side: 'right',
    type: 'knee',
    points: ['rightHip', 'rightKnee', 'rightAnkle'],
    landmarkIndices: [
      LANDMARK_INDEX.RIGHT_HIP,
      LANDMARK_INDEX.RIGHT_KNEE,
      LANDMARK_INDEX.RIGHT_ANKLE,
    ],
    normalRange: { min: 0, max: 180 },
  },
  leftAnkle: {
    name: 'Left Ankle',
    joint: 'leftAnkle',
    side: 'left',
    type: 'ankle',
    points: ['leftKnee', 'leftAnkle', 'leftFootIndex'],
    landmarkIndices: [
      LANDMARK_INDEX.LEFT_KNEE,
      LANDMARK_INDEX.LEFT_ANKLE,
      LANDMARK_INDEX.LEFT_FOOT_INDEX,
    ],
    normalRange: { min: 50, max: 140 },
  },
  rightAnkle: {
    name: 'Right Ankle',
    joint: 'rightAnkle',
    side: 'right',
    type: 'ankle',
    points: ['rightKnee', 'rightAnkle', 'rightFootIndex'],
    landmarkIndices: [
      LANDMARK_INDEX.RIGHT_KNEE,
      LANDMARK_INDEX.RIGHT_ANKLE,
      LANDMARK_INDEX.RIGHT_FOOT_INDEX,
    ],
    normalRange: { min: 50, max: 140 },
  },
};

/**
 * Default engine configuration options.
 */
export const DEFAULT_ANGLE_CONFIG = {
  minConfidence: 0.5,
  use3D: false,
  decimals: 1,
};

/**
 * Generic mathematical function to calculate the angle between vector BA and vector BC.
 *
 * Vertex is Point B. The computed angle is enclosed between:
 * Vector BA (B -> A) and Vector BC (B -> C).
 *
 * @param {{x: number, y: number, z?: number, visibility?: number, isValid?: boolean} | null} pointA Proximal point A
 * @param {{x: number, y: number, z?: number, visibility?: number, isValid?: boolean} | null} pointB Vertex joint B
 * @param {{x: number, y: number, z?: number, visibility?: number, isValid?: boolean} | null} pointC Distal point C
 * @param {object} [options]
 * @param {number} [options.minConfidence=0.5] Minimum visibility threshold
 * @param {boolean} [options.use3D=false] Whether to compute in 3D (x, y, z) or 2D (x, y)
 * @param {number} [options.decimals=1] Decimal precision for angle in degrees
 * @returns {{
 *   angle: number | null,
 *   angleRad: number | null,
 *   confidence: number,
 *   isValid: boolean,
 *   reason?: string
 * }}
 */
export function calculateAngle(pointA, pointB, pointC, options = {}) {
  const minConfidence = options.minConfidence ?? DEFAULT_ANGLE_CONFIG.minConfidence;
  const use3D = Boolean(options.use3D);
  const decimals = options.decimals ?? DEFAULT_ANGLE_CONFIG.decimals;

  // 1. Check for missing/null points
  if (!pointA || !pointB || !pointC) {
    return {
      angle: null,
      angleRad: null,
      confidence: 0,
      isValid: false,
      reason: 'missing_landmarks',
    };
  }

  // 2. Check coordinate validity (reject NaN or infinite values)
  const coords = [pointA.x, pointA.y, pointB.x, pointB.y, pointC.x, pointC.y];
  if (use3D) {
    coords.push(pointA.z ?? 0, pointB.z ?? 0, pointC.z ?? 0);
  }
  const hasInvalidCoord = coords.some((v) => typeof v !== 'number' || Number.isNaN(v) || !Number.isFinite(v));
  if (hasInvalidCoord) {
    return {
      angle: null,
      angleRad: null,
      confidence: 0,
      isValid: false,
      reason: 'invalid_coordinates',
    };
  }

  // 3. Evaluate visibility and confidence
  const visA = typeof pointA.visibility === 'number' ? pointA.visibility : 1.0;
  const visB = typeof pointB.visibility === 'number' ? pointB.visibility : 1.0;
  const visC = typeof pointC.visibility === 'number' ? pointC.visibility : 1.0;

  const minJointConfidence = Math.min(visA, visB, visC);
  const isMarkedValid =
    (pointA.isValid ?? true) &&
    (pointB.isValid ?? true) &&
    (pointC.isValid ?? true);

  if (minJointConfidence < minConfidence || !isMarkedValid) {
    return {
      angle: null,
      angleRad: null,
      confidence: minJointConfidence,
      isValid: false,
      reason: 'low_confidence',
    };
  }

  // 4. Form vectors BA (B -> A) and BC (B -> C)
  const vBA_x = pointA.x - pointB.x;
  const vBA_y = pointA.y - pointB.y;
  const vBA_z = use3D ? (pointA.z ?? 0) - (pointB.z ?? 0) : 0;

  const vBC_x = pointC.x - pointB.x;
  const vBC_y = pointC.y - pointB.y;
  const vBC_z = use3D ? (pointC.z ?? 0) - (pointB.z ?? 0) : 0;

  // 5. Calculate vector magnitudes
  const magBA = Math.sqrt(vBA_x * vBA_x + vBA_y * vBA_y + vBA_z * vBA_z);
  const magBC = Math.sqrt(vBC_x * vBC_x + vBC_y * vBC_y + vBC_z * vBC_z);

  // Guard against zero-length vectors (e.g., duplicate identical points A=B or C=B)
  const EPSILON = 1e-7;
  if (magBA < EPSILON || magBC < EPSILON) {
    return {
      angle: null,
      angleRad: null,
      confidence: minJointConfidence,
      isValid: false,
      reason: 'zero_magnitude_vector',
    };
  }

  // 6. Dot product and cosine calculation
  const dotProduct = vBA_x * vBC_x + vBA_y * vBC_y + vBA_z * vBC_z;
  const rawCos = dotProduct / (magBA * magBC);

  // 7. Clamp cosine to [-1.0, 1.0] to prevent floating-point acos(1.0000000000000002) NaN
  const clampedCos = Math.max(-1.0, Math.min(1.0, rawCos));

  // 8. Convert to angle in radians and degrees
  const angleRad = Math.acos(clampedCos);
  const rawDegrees = (angleRad * 180.0) / Math.PI;

  const factor = Math.pow(10, decimals);
  const angleDegrees = Math.round(rawDegrees * factor) / factor;

  return {
    angle: angleDegrees,
    angleRad,
    confidence: minJointConfidence,
    isValid: true,
  };
}

/**
 * Joint Angle Calculation Engine.
 * Provides configurable computation across multiple anatomical joints from processed pose frames.
 */
export class JointAngleEngine {
  /**
   * @param {object} [options]
   * @param {number} [options.minConfidence=0.5]
   * @param {boolean} [options.use3D=false]
   * @param {number} [options.decimals=1]
   * @param {Record<string, object>} [options.jointDefinitions]
   */
  constructor(options = {}) {
    this.config = {
      ...DEFAULT_ANGLE_CONFIG,
      ...options,
    };
    this.definitions = {
      ...REHAB_JOINT_DEFINITIONS,
      ...(options.jointDefinitions || {}),
    };
  }

  /**
   * Register or override a joint definition dynamically.
   *
   * @param {string} key Joint key e.g. 'leftKnee'
   * @param {{
   *   name: string,
   *   joint: string,
   *   side: 'left' | 'right',
   *   points: [string, string, string],
   *   normalRange?: {min: number, max: number}
   * }} definition
   */
  registerJoint(key, definition) {
    this.definitions[key] = definition;
  }

  /**
   * Update engine configuration dynamically.
   * @param {Partial<typeof DEFAULT_ANGLE_CONFIG>} newConfig
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Helper to resolve landmark object from processed pose or landmark list.
   *
   * @param {object} pose Processed pose frame from Phase 8
   * @param {string|number} identifier Named landmark or index
   * @returns {object|null}
   */
  resolveLandmark(pose, identifier) {
    if (!pose) return null;

    if (pose.byName && typeof identifier === 'string' && pose.byName[identifier]) {
      return pose.byName[identifier];
    }

    if (Array.isArray(pose.landmarks)) {
      if (typeof identifier === 'number') {
        return pose.landmarks[identifier] || null;
      }
      if (typeof identifier === 'string' && LANDMARK_INDEX[identifier.toUpperCase()] !== undefined) {
        return pose.landmarks[LANDMARK_INDEX[identifier.toUpperCase()]] || null;
      }
    }

    if (Array.isArray(pose)) {
      if (typeof identifier === 'number') return pose[identifier] || null;
    }

    return null;
  }

  /**
   * Calculate angle for a specific registered joint.
   *
   * @param {string} jointKey Registered joint key (e.g. 'leftKnee', 'rightShoulder')
   * @param {object} pose Processed pose data from Phase 8
   * @returns {{
   *   joint: string,
   *   name: string,
   *   side: 'left' | 'right',
   *   angle: number | null,
   *   confidence: number,
   *   isValid: boolean,
   *   reason?: string
   * }}
   */
  calculateJoint(jointKey, pose) {
    const def = this.definitions[jointKey];
    if (!def) {
      return {
        joint: jointKey,
        name: jointKey,
        side: 'unknown',
        angle: null,
        confidence: 0,
        isValid: false,
        reason: 'unregistered_joint',
      };
    }

    const [ptAName, ptBName, ptCName] = def.points;
    const ptA = this.resolveLandmark(pose, ptAName);
    const ptB = this.resolveLandmark(pose, ptBName);
    const ptC = this.resolveLandmark(pose, ptCName);

    const result = calculateAngle(ptA, ptB, ptC, this.config);

    return {
      joint: def.joint,
      name: def.name,
      side: def.side,
      type: def.type,
      normalRange: def.normalRange,
      ...result,
    };
  }

  /**
   * Calculate angles for all registered joints for the given pose frame.
   *
   * @param {object} pose Processed pose frame
   * @returns {Record<string, object>}
   */
  calculateAll(pose) {
    const results = {};
    for (const key of Object.keys(this.definitions)) {
      results[key] = this.calculateJoint(key, pose);
    }
    return results;
  }

  /**
   * Calculate angles for a specific subset of joints (e.g. for an exercise routine).
   *
   * @param {object} pose Processed pose frame
   * @param {string[]} jointKeys Array of joint keys to calculate
   * @returns {Record<string, object>}
   */
  calculateExerciseJoints(pose, jointKeys = []) {
    const results = {};
    for (const key of jointKeys) {
      results[key] = this.calculateJoint(key, pose);
    }
    return results;
  }
}

/**
 * Factory function to create a JointAngleEngine instance.
 *
 * @param {object} [options]
 * @returns {JointAngleEngine}
 */
export function createAngleEngine(options = {}) {
  return new JointAngleEngine(options);
}
