/**
 * Pose Drawing Utilities for Canvas Overlay.
 *
 * Renders subtle, glowing skeleton lines and anatomical joint indicators
 * without cluttering the patient's camera view.
 */

export const POSE_LANDMARKS = {
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

// Standard therapeutic joint connection pairs
export const POSE_CONNECTIONS = [
  // Shoulders & Spine
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],

  // Left Arm
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
  [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST],

  // Right Arm
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
  [POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST],

  // Left Leg (Rehabilitation Focus)
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
  [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
  [POSE_LANDMARKS.LEFT_ANKLE, POSE_LANDMARKS.LEFT_HEEL],
  [POSE_LANDMARKS.LEFT_HEEL, POSE_LANDMARKS.LEFT_FOOT_INDEX],

  // Right Leg (Rehabilitation Focus)
  [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
  [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
  [POSE_LANDMARKS.RIGHT_ANKLE, POSE_LANDMARKS.RIGHT_HEEL],
  [POSE_LANDMARKS.RIGHT_HEEL, POSE_LANDMARKS.RIGHT_FOOT_INDEX],
];

// Key rehabilitation joints to accentuate with glowing halos
export const REHAB_KEY_JOINTS = new Set([
  POSE_LANDMARKS.LEFT_SHOULDER,
  POSE_LANDMARKS.RIGHT_SHOULDER,
  POSE_LANDMARKS.LEFT_HIP,
  POSE_LANDMARKS.RIGHT_HIP,
  POSE_LANDMARKS.LEFT_KNEE,
  POSE_LANDMARKS.RIGHT_KNEE,
  POSE_LANDMARKS.LEFT_ANKLE,
  POSE_LANDMARKS.RIGHT_ANKLE,
]);

/**
 * Filter landmarks by confidence threshold.
 *
 * @param {Array<{x: number, y: number, visibility?: number}>} landmarks
 * @param {number} minConfidence
 * @returns {Array<{x: number, y: number, visibility: number, isValid: boolean}>}
 */
export function filterLandmarks(landmarks, minConfidence = 0.5) {
  if (!landmarks || !Array.isArray(landmarks)) return [];
  return landmarks.map((lm) => {
    const visibility = typeof lm.visibility === 'number' ? lm.visibility : 1.0;
    const isValid = visibility >= minConfidence && !isNaN(lm.x) && !isNaN(lm.y);
    return { ...lm, visibility, isValid };
  });
}

/**
 * Draw skeleton overlay on a 2D HTML5 canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x: number, y: number, visibility?: number}>} rawLandmarks
 * @param {number} width Canvas width
 * @param {number} height Canvas height
 * @param {boolean} isMirrored Mirror horizontally for selfie view
 * @param {number} minConfidence Minimum visibility threshold (0.0 to 1.0)
 */
export function drawPoseOverlay(
  ctx,
  rawLandmarks,
  width,
  height,
  isMirrored = true,
  minConfidence = 0.5
) {
  if (!ctx || !rawLandmarks || rawLandmarks.length === 0) return;

  const landmarks = filterLandmarks(rawLandmarks, minConfidence);

  // Helper to convert normalized (0..1) coords to canvas pixel coordinates
  const toCanvasCoords = (lm) => {
    const x = isMirrored ? (1 - lm.x) * width : lm.x * width;
    const y = lm.y * height;
    return { x, y };
  };

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // 1. Draw connecting bones
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)'; // Soft cyan

  for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
    const p1 = landmarks[startIdx];
    const p2 = landmarks[endIdx];

    if (p1 && p1.isValid && p2 && p2.isValid) {
      const c1 = toCanvasCoords(p1);
      const c2 = toCanvasCoords(p2);

      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.stroke();
    }
  }

  // 2. Draw landmark joint points
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (!lm || !lm.isValid) continue;

    // Skip minor facial landmarks to reduce visual noise
    if (i > 0 && i < 11) continue;

    const { x, y } = toCanvasCoords(lm);
    const isKeyJoint = REHAB_KEY_JOINTS.has(i);

    // Outer glow ring for rehabilitation joints
    if (isKeyJoint) {
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(14, 165, 233, 0.35)';
      ctx.fill();
    }

    // Inner core point
    ctx.beginPath();
    ctx.arc(x, y, isKeyJoint ? 4 : 3, 0, 2 * Math.PI);
    ctx.fillStyle = isKeyJoint ? '#38bdf8' : '#22c55e'; // Cyan for key joints, green for peripheral
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}
