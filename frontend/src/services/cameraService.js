/**
 * Camera Service for AI Rehabilitation Coach.
 *
 * Handles getUserMedia requests, camera hardware availability checks,
 * stream track lifecycle, and graceful error categorization.
 *
 * Privacy guarantee: Video streams are processed strictly in-memory
 * via WebGL/Canvas and are NEVER recorded, stored, or transmitted.
 */

export const CAMERA_STATUS = {
  IDLE: 'idle',
  STARTING: 'starting',
  ACTIVE: 'active',
  PERMISSION_DENIED: 'permission_denied',
  UNAVAILABLE: 'unavailable',
  STOPPED: 'stopped',
};

/**
 * Check if the browser supports mediaDevices and getUserMedia.
 */
export function isCameraSupported() {
  return Boolean(
    typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/**
 * Request camera access and attach to video element.
 *
 * @param {HTMLVideoElement} videoElement
 * @param {object} options
 * @returns {Promise<{ stream: MediaStream, status: string, error?: Error }>}
 */
export async function startCamera(videoElement, options = {}) {
  if (!isCameraSupported()) {
    return {
      stream: null,
      status: CAMERA_STATUS.UNAVAILABLE,
      error: new Error('MediaDevices API is not supported in this browser environment.'),
    };
  }

  const constraints = {
    audio: false,
    video: {
      facingMode: options.facingMode || 'user',
      width: { ideal: options.width || 640 },
      height: { ideal: options.height || 480 },
      frameRate: { ideal: 30, max: 30 },
    },
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    if (videoElement) {
      videoElement.srcObject = stream;
      // Wait until video can play
      await new Promise((resolve) => {
        if (videoElement.readyState >= 2) {
          resolve();
        } else {
          videoElement.onloadedmetadata = () => resolve();
        }
      });
      await videoElement.play().catch(() => {});
    }

    return { stream, status: CAMERA_STATUS.ACTIVE };
  } catch (err) {
    let status = CAMERA_STATUS.UNAVAILABLE;
    if (
      err.name === 'NotAllowedError' ||
      err.name === 'PermissionDeniedError' ||
      err.name === 'SecurityError'
    ) {
      status = CAMERA_STATUS.PERMISSION_DENIED;
    } else if (
      err.name === 'NotFoundError' ||
      err.name === 'DevicesNotFoundError' ||
      err.name === 'OverconstrainedError'
    ) {
      status = CAMERA_STATUS.UNAVAILABLE;
    }

    return { stream: null, status, error: err };
  }
}

/**
 * Stop all active media tracks on a stream and detach from video element.
 *
 * @param {MediaStream|null} stream
 * @param {HTMLVideoElement|null} videoElement
 */
export function stopCamera(stream, videoElement) {
  if (stream) {
    try {
      const tracks = stream.getTracks();
      tracks.forEach((track) => {
        track.stop();
      });
    } catch (e) {
      console.warn('Error stopping media tracks:', e);
    }
  }

  if (videoElement) {
    try {
      videoElement.pause();
      videoElement.srcObject = null;
    } catch (e) {
      console.warn('Error detaching video stream:', e);
    }
  }
}
