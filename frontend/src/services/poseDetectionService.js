/**
 * MediaPipe Pose Detection Service.
 *
 * Wraps @mediapipe/tasks-vision PoseLandmarker.
 * Safely handles initialization, WebAssembly resolution, video frame processing,
 * and offline/model loading fallbacks.
 */

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

let landmarkerInstance = null;
let isInitializing = false;
let initializationPromise = null;

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/**
 * Initialize MediaPipe PoseLandmarker.
 * Returns the landmarker instance or null if unavailable.
 */
export async function getPoseLandmarker() {
  if (landmarkerInstance) {
    return landmarkerInstance;
  }

  if (isInitializing && initializationPromise) {
    return initializationPromise;
  }

  isInitializing = true;
  initializationPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);

      // Try GPU delegate first, fallback to CPU if WebGL/GPU is constrained
      try {
        landmarkerInstance = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (gpuError) {
        console.warn('GPU delegate unavailable, falling back to CPU for MediaPipe Pose:', gpuError);
        landmarkerInstance = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      return landmarkerInstance;
    } catch (err) {
      console.warn('MediaPipe Pose Landmarker initialization failed (offline or CDN blocked):', err);
      landmarkerInstance = null;
      return null;
    } finally {
      isInitializing = false;
    }
  })();

  return initializationPromise;
}

/**
 * Detect pose landmarks from a video element at the given timestamp.
 *
 * @param {PoseLandmarker} landmarker
 * @param {HTMLVideoElement} videoElement
 * @param {number} timestamp
 * @returns {{ landmarks: Array<{x: number, y: number, z: number, visibility?: number}> | null, score: number }}
 */
export function detectPose(landmarker, videoElement, timestamp) {
  if (!landmarker || !videoElement || videoElement.readyState < 2) {
    return { landmarks: null, score: 0 };
  }

  try {
    const result = landmarker.detectForVideo(videoElement, timestamp);
    if (result && result.landmarks && result.landmarks.length > 0) {
      const landmarks = result.landmarks[0];
      // Compute average visibility of key body landmarks
      const validPoints = landmarks.filter((lm) => (lm.visibility ?? 1) >= 0.5);
      const score = Math.min(100, Math.round((validPoints.length / 33) * 100));

      return { landmarks, score };
    }
    return { landmarks: null, score: 0 };
  } catch (err) {
    console.debug('Pose detection frame skipped:', err);
    return { landmarks: null, score: 0 };
  }
}

/**
 * Clean up and close the active landmarker instance.
 */
export function closePoseLandmarker() {
  if (landmarkerInstance) {
    try {
      landmarkerInstance.close();
    } catch (e) {
      console.warn('Error closing PoseLandmarker:', e);
    }
    landmarkerInstance = null;
  }
  isInitializing = false;
  initializationPromise = null;
}
