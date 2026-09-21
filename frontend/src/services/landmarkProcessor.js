/**
 * Pose Landmark Processing & Movement Data Foundation.
 *
 * Phase 8: Implements structured landmark extraction, configurable confidence
 * filtering, Exponential Moving Average (EMA) smoothing for jitter reduction,
 * and body-relative coordinate normalization (scale and origin invariance).
 *
 * This module is pure JavaScript with zero React/DOM dependencies, designed
 * for reuse across camera views, offline analysis, and test suites.
 *
 * Privacy guarantee: Only numerical coordinates (x, y, z, visibility) are processed.
 * No raw camera frames or pixel data are retained.
 */

// Total standard landmarks in MediaPipe Pose
export const LANDMARK_COUNT = 33;

/**
 * Official MediaPipe Pose Landmark Named Index Mapping.
 */
export const LANDMARK_INDEX = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

/**
 * Standard camelCase landmark names array indexed 0..32.
 */
export const LANDMARK_NAMES = [
  'nose',
  'leftEyeInner',
  'leftEye',
  'leftEyeOuter',
  'rightEyeInner',
  'rightEye',
  'rightEyeOuter',
  'leftEar',
  'rightEar',
  'mouthLeft',
  'mouthRight',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftPinky',
  'rightPinky',
  'leftIndex',
  'rightIndex',
  'leftThumb',
  'rightThumb',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
  'leftHeel',
  'rightHeel',
  'leftFootIndex',
  'rightFootIndex',
];

/**
 * Default configuration options for landmark processing.
 */
export const DEFAULT_PROCESSOR_CONFIG = {
  // Visibility/confidence cutoff (0.0 to 1.0)
  minConfidence: 0.5,
  // Whether to apply Exponential Moving Average smoothing
  enableSmoothing: true,
  // Smoothing alpha: 1.0 = raw (no smoothing), 0.0 = completely frozen
  // 0.65 balances responsiveness with tremor/jitter reduction
  smoothingAlpha: 0.65,
  // Frames a landmark can be missing before re-initializing smoother without interpolation
  maxMissingFramesBeforeReset: 5,
  // Whether to compute body-relative normalized coordinates
  enableNormalization: true,
  // Primary reference system for normalization: 'torso' (pelvis root) or 'shoulders'
  normalizationReference: 'torso',
};

/**
 * Compute 3D Euclidean distance between two points.
 *
 * @param {{x: number, y: number, z?: number}} p1
 * @param {{x: number, y: number, z?: number}} p2
 * @returns {number}
 */
export function calculateDistance(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = (p1.x ?? 0) - (p2.x ?? 0);
  const dy = (p1.y ?? 0) - (p2.y ?? 0);
  const dz = (p1.z ?? 0) - (p2.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Compute 3D midpoint between two points.
 *
 * @param {{x: number, y: number, z?: number}} p1
 * @param {{x: number, y: number, z?: number}} p2
 * @returns {{x: number, y: number, z: number}}
 */
export function calculateMidpoint(p1, p2) {
  if (!p1 && !p2) return { x: 0, y: 0, z: 0 };
  if (!p1) return { x: p2.x ?? 0, y: p2.y ?? 0, z: p2.z ?? 0 };
  if (!p2) return { x: p1.x ?? 0, y: p1.y ?? 0, z: p1.z ?? 0 };

  return {
    x: ((p1.x ?? 0) + (p2.x ?? 0)) / 2,
    y: ((p1.y ?? 0) + (p2.y ?? 0)) / 2,
    z: ((p1.z ?? 0) + (p2.z ?? 0)) / 2,
  };
}

/**
 * Extract and validate a single landmark from raw MediaPipe data.
 *
 * @param {object} raw
 * @param {number} index
 * @param {number} minConfidence
 * @returns {object} Standardized landmark object
 */
export function extractLandmark(raw, index, minConfidence = 0.5) {
  const name = LANDMARK_NAMES[index] || `landmark_${index}`;

  if (!raw || typeof raw !== 'object') {
    return {
      id: index,
      name,
      x: 0,
      y: 0,
      z: 0,
      visibility: 0,
      isValid: false,
      nx: null,
      ny: null,
      nz: null,
    };
  }

  const x = Number(raw.x);
  const y = Number(raw.y);
  const z = typeof raw.z !== 'undefined' ? Number(raw.z) : 0;
  const visibility = typeof raw.visibility === 'number' ? raw.visibility : 1.0;

  const hasValidCoords = !Number.isNaN(x) && !Number.isNaN(y) && !Number.isNaN(z);
  const meetsConfidence = visibility >= minConfidence;
  const isValid = hasValidCoords && meetsConfidence;

  return {
    id: index,
    name,
    x: hasValidCoords ? x : 0,
    y: hasValidCoords ? y : 0,
    z: hasValidCoords ? z : 0,
    visibility,
    isValid,
    nx: null,
    ny: null,
    nz: null,
  };
}

/**
 * Extract all 33 landmarks from raw MediaPipe array.
 *
 * @param {Array<object>} rawLandmarks
 * @param {number} minConfidence
 * @returns {Array<object>}
 */
export function extractLandmarks(rawLandmarks, minConfidence = 0.5) {
  const landmarks = [];
  const rawList = Array.isArray(rawLandmarks) ? rawLandmarks : [];

  for (let i = 0; i < LANDMARK_COUNT; i++) {
    landmarks.push(extractLandmark(rawList[i], i, minConfidence));
  }

  return landmarks;
}

/**
 * Landmark Smoother using Exponential Moving Average (EMA).
 * Maintains internal state per landmark to filter out frame-to-frame jitter.
 */
export class LandmarkSmoother {
  /**
   * @param {number} alpha Smoothing factor [0.0, 1.0]
   * @param {number} maxMissingFrames Threshold to reset smoothed point if track is lost
   */
  constructor(alpha = 0.65, maxMissingFrames = 5) {
    this.alpha = Math.max(0.01, Math.min(1.0, alpha));
    this.maxMissingFrames = maxMissingFrames;
    this.history = new Map(); // id -> { x, y, z, missingCount }
  }

  /**
   * Update smoothing factor.
   * @param {number} alpha
   */
  setAlpha(alpha) {
    this.alpha = Math.max(0.01, Math.min(1.0, alpha));
  }

  /**
   * Reset smoother history (e.g. on session restart or pause).
   */
  reset() {
    this.history.clear();
  }

  /**
   * Apply EMA smoothing to an array of extracted landmarks.
   *
   * @param {Array<object>} landmarks
   * @returns {Array<object>} Smoothed landmarks array
   */
  smooth(landmarks) {
    if (!Array.isArray(landmarks)) return [];

    return landmarks.map((lm) => {
      // If landmark is invalid, increment missing count and pass through
      if (!lm.isValid) {
        const prev = this.history.get(lm.id);
        if (prev) {
          prev.missingCount += 1;
          if (prev.missingCount > this.maxMissingFrames) {
            this.history.delete(lm.id);
          }
        }
        return { ...lm };
      }

      const prev = this.history.get(lm.id);

      // First sighting or recovered after prolonged track loss: initialize directly
      if (!prev || prev.missingCount > this.maxMissingFrames) {
        this.history.set(lm.id, {
          x: lm.x,
          y: lm.y,
          z: lm.z,
          missingCount: 0,
        });
        return { ...lm };
      }

      // Compute EMA: S_t = alpha * X_t + (1 - alpha) * S_prev
      const smoothedX = this.alpha * lm.x + (1 - this.alpha) * prev.x;
      const smoothedY = this.alpha * lm.y + (1 - this.alpha) * prev.y;
      const smoothedZ = this.alpha * lm.z + (1 - this.alpha) * prev.z;

      // Update history
      prev.x = smoothedX;
      prev.y = smoothedY;
      prev.z = smoothedZ;
      prev.missingCount = 0;

      return {
        ...lm,
        x: smoothedX,
        y: smoothedY,
        z: smoothedZ,
      };
    });
  }
}

/**
 * Normalize coordinates relative to body frame and scale.
 *
 * Translates coordinates so the pelvic root (midpoint between hips) is (0, 0, 0)
 * and scales by the anatomical torso length (mid-shoulder to mid-hip distance).
 * This makes body angles and relative limb positions invariant to distance from camera.
 *
 * @param {Array<object>} landmarks
 * @param {object} options
 * @returns {{
 *   landmarks: Array<object>,
 *   torsoCenter: {x: number, y: number, z: number} | null,
 *   bodyScale: number | null,
 *   isTorsoValid: boolean
 * }}
 */
export function normalizePoseCoordinates(landmarks, options = {}) {
  const reference = options.reference || 'torso';

  if (!Array.isArray(landmarks) || landmarks.length < LANDMARK_COUNT) {
    return {
      landmarks: landmarks || [],
      torsoCenter: null,
      bodyScale: null,
      isTorsoValid: false,
    };
  }

  const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
  const leftHip = landmarks[LANDMARK_INDEX.LEFT_HIP];
  const rightHip = landmarks[LANDMARK_INDEX.RIGHT_HIP];

  const shouldersValid = leftShoulder?.isValid && rightShoulder?.isValid;
  const hipsValid = leftHip?.isValid && rightHip?.isValid;

  let origin = null;
  let scale = null;
  let isTorsoValid = false;

  if (shouldersValid && hipsValid) {
    const midShoulder = calculateMidpoint(leftShoulder, rightShoulder);
    const midHip = calculateMidpoint(leftHip, rightHip);

    // Torso length (3D Euclidean distance from mid-shoulder to mid-hip)
    const torsoLength = calculateDistance(midShoulder, midHip);

    if (torsoLength > 0.02) {
      origin = midHip; // Pelvic center origin
      scale = torsoLength;
      isTorsoValid = true;
    }
  } else if (shouldersValid) {
    // Fallback to shoulder midpoint and shoulder width
    const midShoulder = calculateMidpoint(leftShoulder, rightShoulder);
    const shoulderWidth = calculateDistance(leftShoulder, rightShoulder);

    if (shoulderWidth > 0.02) {
      origin = midShoulder;
      scale = shoulderWidth;
      isTorsoValid = false; // Partial
    }
  } else if (hipsValid) {
    // Fallback to hip midpoint
    const midHip = calculateMidpoint(leftHip, rightHip);
    const hipWidth = calculateDistance(leftHip, rightHip);

    if (hipWidth > 0.02) {
      origin = midHip;
      scale = hipWidth;
      isTorsoValid = false;
    }
  }

  const normalizedLandmarks = landmarks.map((lm) => {
    if (!lm.isValid || !origin || !scale || scale <= 0) {
      return {
        ...lm,
        nx: null,
        ny: null,
        nz: null,
      };
    }

    return {
      ...lm,
      nx: (lm.x - origin.x) / scale,
      ny: (lm.y - origin.y) / scale,
      nz: (lm.z - origin.z) / scale,
    };
  });

  return {
    landmarks: normalizedLandmarks,
    torsoCenter: origin,
    bodyScale: scale,
    isTorsoValid,
  };
}

/**
 * Reusable Pose Landmark Processor.
 *
 * Coordinates extraction, confidence filtering, smoothing, and normalization.
 */
export class LandmarkProcessor {
  /**
   * @param {Partial<typeof DEFAULT_PROCESSOR_CONFIG>} config
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
    this.smoother = new LandmarkSmoother(
      this.config.smoothingAlpha,
      this.config.maxMissingFramesBeforeReset
    );
  }

  /**
   * Update processor configuration dynamically.
   * @param {Partial<typeof DEFAULT_PROCESSOR_CONFIG>} newConfig
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    if (typeof newConfig.smoothingAlpha === 'number') {
      this.smoother.setAlpha(this.config.smoothingAlpha);
    }
  }

  /**
   * Reset processor state (e.g. smoother buffers on pause/stop).
   */
  reset() {
    this.smoother.reset();
  }

  /**
   * Process a single video frame of MediaPipe landmarks.
   *
   * @param {Array<object>|null} rawLandmarks Raw landmarks from PoseLandmarker
   * @param {number} [timestamp] Frame timestamp in ms
   * @returns {object} Clean, structured pose frame
   */
  process(rawLandmarks, timestamp = performance.now()) {
    // 1. Extract and validate landmarks
    let landmarks = extractLandmarks(rawLandmarks, this.config.minConfidence);

    // 2. Apply smoothing if enabled
    if (this.config.enableSmoothing) {
      landmarks = this.smoother.smooth(landmarks);
    }

    // 3. Apply normalization if enabled
    let torsoCenter = null;
    let bodyScale = null;
    let isTorsoValid = false;

    if (this.config.enableNormalization) {
      const normResult = normalizePoseCoordinates(landmarks, {
        reference: this.config.normalizationReference,
      });
      landmarks = normResult.landmarks;
      torsoCenter = normResult.torsoCenter;
      bodyScale = normResult.bodyScale;
      isTorsoValid = normResult.isTorsoValid;
    }

    // 4. Compute metrics and named dictionary
    let validCount = 0;
    const byName = {};

    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (lm.isValid) validCount++;
      byName[lm.name] = lm;
    }

    const trackingQuality = Math.round((validCount / LANDMARK_COUNT) * 100);

    return {
      timestamp,
      rawCount: LANDMARK_COUNT,
      validCount,
      trackingQuality,
      landmarks,
      byName,
      torsoCenter,
      bodyScale,
      isTorsoValid,
      isSmoothed: this.config.enableSmoothing,
      isNormalized: this.config.enableNormalization && isTorsoValid,
    };
  }
}

/**
 * Convenient factory function to create a LandmarkProcessor instance.
 *
 * @param {Partial<typeof DEFAULT_PROCESSOR_CONFIG>} config
 * @returns {LandmarkProcessor}
 */
export function createPoseProcessor(config = {}) {
  return new LandmarkProcessor(config);
}
