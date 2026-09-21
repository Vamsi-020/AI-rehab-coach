/**
 * Real-Time Rehabilitation Feedback Engine.
 *
 * Phase 13: Converts real-time movement analysis, joint angles, posture checks,
 * repetition events, and quality metrics into prioritized, clear, and actionable feedback.
 *
 * Feedback Priority Order:
 * 1. Safety / invalid movement (Priority 1, CRITICAL)
 * 2. Missing or low-confidence landmarks (Priority 2, WARNING)
 * 3. Posture / alignment (Priority 3, WARNING)
 * 4. Range of motion (Priority 4, INFO)
 * 5. Movement speed (Priority 5, WARNING / INFO)
 * 6. Repetition completion (Priority 6, POSITIVE / WARNING)
 * 7. Positive reinforcement (Priority 7, POSITIVE)
 *
 * Anti-Spam Controls:
 * - Minimum display duration (~2000ms) to ensure readability
 * - Priority pre-emption (higher priority overrides immediately)
 * - Duplicate suppression within cooldown (~2500ms)
 * - No conflicting simultaneous messages
 *
 * Deterministic and explainable.
 * No diagnostic or recovery claims.
 * No raw video footage storage.
 */

import { MOVEMENT_STATES } from './exerciseDefinitions.js';

/**
 * Standard Feedback Types.
 */
export const FEEDBACK_TYPES = {
  SAFETY: 'SAFETY',
  POSITION: 'POSITION',
  POSTURE: 'POSTURE',
  RANGE_OF_MOTION: 'RANGE_OF_MOTION',
  SPEED: 'SPEED',
  REPETITION: 'REPETITION',
  POSITIVE: 'POSITIVE',
};

/**
 * Severity Levels.
 */
export const SEVERITY_LEVELS = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFO: 'INFO',
};

/**
 * Priority Values (1 = Highest, 7 = Lowest).
 */
export const PRIORITY_LEVELS = {
  SAFETY: 1,
  POSITION: 2,
  POSTURE: 3,
  RANGE_OF_MOTION: 4,
  SPEED: 5,
  REPETITION: 6,
  POSITIVE: 7,
};

/**
 * RealTimeFeedbackEngine Class.
 */
export class RealTimeFeedbackEngine {
  /**
   * @param {object} [options]
   * @param {number} [options.minDisplayDurationMs=2000] Minimum time a message remains displayed before equal/lower priority can replace it
   * @param {number} [options.cooldownMs=2500] Suppression window for repeating the exact same message
   */
  constructor(options = {}) {
    this.options = {
      minDisplayDurationMs: options.minDisplayDurationMs ?? 2000,
      cooldownMs: options.cooldownMs ?? 2500,
      ...options,
    };

    // Active displayed feedback state
    this.currentFeedback = null;
    this.currentFeedbackStartTime = 0;

    // History tracking for cooldown and duplicate suppression
    this.lastMessageTimestamps = new Map();

    // Streak of good repetitions/frames for positive reinforcement
    this.steadyFramesCount = 0;
  }

  /**
   * Reset engine buffers and active feedback.
   */
  reset() {
    this.currentFeedback = null;
    this.currentFeedbackStartTime = 0;
    this.lastMessageTimestamps.clear();
    this.steadyFramesCount = 0;
  }

  /**
   * Evaluates incoming frame data and produces prioritized feedback.
   *
   * @param {object} input
   * @param {string} [input.cameraStatus]
   * @param {object|null} [input.pose]
   * @param {Record<string, object>|null} [input.angles]
   * @param {object|null} [input.analysis]
   * @param {object|null} [input.repData]
   * @param {object|null} [input.qualityData]
   * @param {number} [timestamp]
   * @returns {object} Structured feedback object
   */
  evaluate(input = {}, timestamp = performance.now()) {
    const candidate = this.generateCandidate(input, timestamp);

    // If no active feedback, adopt candidate immediately
    if (!this.currentFeedback) {
      this.currentFeedback = candidate;
      this.currentFeedbackStartTime = timestamp;
      this.lastMessageTimestamps.set(candidate.message, timestamp);
      return this.currentFeedback;
    }

    const currentPriority = this.currentFeedback.priority;
    const candidatePriority = candidate.priority;
    const timeSinceDisplay = timestamp - this.currentFeedbackStartTime;
    const isHigherPriority = candidatePriority < currentPriority;
    const displayDurationPassed = timeSinceDisplay >= this.options.minDisplayDurationMs;

    // 1. Higher-priority message immediately pre-empts lower-priority
    if (isHigherPriority) {
      this.currentFeedback = candidate;
      this.currentFeedbackStartTime = timestamp;
      this.lastMessageTimestamps.set(candidate.message, timestamp);
      return this.currentFeedback;
    }

    // 2. If same message, keep active
    if (candidate.message === this.currentFeedback.message) {
      return this.currentFeedback;
    }

    // 3. If candidate is equal or lower priority, only allow transition after minDisplayDurationMs
    if (displayDurationPassed) {
      // Check duplicate suppression cooldown
      const lastSeen = this.lastMessageTimestamps.get(candidate.message) || 0;
      const cooldownPassed = timestamp - lastSeen >= this.options.cooldownMs;

      if (cooldownPassed || candidatePriority < currentPriority) {
        this.currentFeedback = candidate;
        this.currentFeedbackStartTime = timestamp;
        this.lastMessageTimestamps.set(candidate.message, timestamp);
        return this.currentFeedback;
      }
    }

    // Otherwise maintain current feedback until minDisplayDuration passes
    return this.currentFeedback;
  }

  /**
   * Deterministically evaluates analysis inputs and identifies the highest priority candidate.
   *
   * @param {object} input
   * @param {number} timestamp
   * @returns {object}
   */
  generateCandidate(input, timestamp) {
    const { cameraStatus, pose, analysis, repData, qualityData } = input;
    const repNumber = repData?.rep_count ?? qualityData?.rep_number ?? null;

    // --- PRIORITY 1: SAFETY / INVALID MOVEMENT (CRITICAL) ---
    if (cameraStatus === 'permission_denied') {
      return this.formatFeedback(
        'Camera permission was denied. Please allow camera access in browser settings.',
        FEEDBACK_TYPES.SAFETY,
        SEVERITY_LEVELS.CRITICAL,
        PRIORITY_LEVELS.SAFETY,
        timestamp
      );
    }

    if (cameraStatus === 'unavailable') {
      return this.formatFeedback(
        'Camera is unavailable or disconnected. Please check device connection.',
        FEEDBACK_TYPES.SAFETY,
        SEVERITY_LEVELS.CRITICAL,
        PRIORITY_LEVELS.SAFETY,
        timestamp
      );
    }

    if (analysis?.state === MOVEMENT_STATES.INVALID) {
      return this.formatFeedback(
        'Please adjust your position. Joint points cannot be resolved safely.',
        FEEDBACK_TYPES.SAFETY,
        SEVERITY_LEVELS.CRITICAL,
        PRIORITY_LEVELS.SAFETY,
        timestamp,
        repNumber
      );
    }

    // --- PRIORITY 2: POSITION / MISSING OR LOW-CONFIDENCE LANDMARKS (WARNING) ---
    if (!pose || !pose.landmarks || pose.landmarks.length === 0) {
      this.steadyFramesCount = 0;
      return this.formatFeedback(
        'Make sure your whole body is visible in camera view.',
        FEEDBACK_TYPES.POSITION,
        SEVERITY_LEVELS.WARNING,
        PRIORITY_LEVELS.POSITION,
        timestamp
      );
    }

    if (analysis?.state === MOVEMENT_STATES.LOW_CONFIDENCE || (analysis?.confidence && analysis.confidence < 0.5)) {
      this.steadyFramesCount = 0;
      return this.formatFeedback(
        'Make sure your whole body is visible and well-lit.',
        FEEDBACK_TYPES.POSITION,
        SEVERITY_LEVELS.WARNING,
        PRIORITY_LEVELS.POSITION,
        timestamp
      );
    }

    // --- PRIORITY 3: POSTURE & ALIGNMENT (WARNING) ---
    if (analysis?.postureAlert) {
      this.steadyFramesCount = 0;
      return this.formatFeedback(
        analysis.postureAlert,
        FEEDBACK_TYPES.POSTURE,
        SEVERITY_LEVELS.WARNING,
        PRIORITY_LEVELS.POSTURE,
        timestamp,
        repNumber
      );
    }

    if (qualityData && qualityData.posture_score < 75) {
      this.steadyFramesCount = 0;
      return this.formatFeedback(
        'Keep your posture steady throughout the movement.',
        FEEDBACK_TYPES.POSTURE,
        SEVERITY_LEVELS.WARNING,
        PRIORITY_LEVELS.POSTURE,
        timestamp,
        repNumber
      );
    }

    // --- PRIORITY 4: RANGE OF MOTION (INFO / WARNING) ---
    if (analysis?.state === MOVEMENT_STATES.TARGET) {
      return this.formatFeedback(
        'Target position reached. Hold briefly, then return.',
        FEEDBACK_TYPES.RANGE_OF_MOTION,
        SEVERITY_LEVELS.INFO,
        PRIORITY_LEVELS.RANGE_OF_MOTION,
        timestamp,
        repNumber
      );
    }

    if (qualityData && qualityData.range_of_motion_score < 70) {
      return this.formatFeedback(
        'Try to reach the target position on the next repetition.',
        FEEDBACK_TYPES.RANGE_OF_MOTION,
        SEVERITY_LEVELS.INFO,
        PRIORITY_LEVELS.RANGE_OF_MOTION,
        timestamp,
        repNumber
      );
    }

    if (analysis?.state === MOVEMENT_STATES.RETURNING) {
      return this.formatFeedback(
        'Return to the starting position with smooth control.',
        FEEDBACK_TYPES.RANGE_OF_MOTION,
        SEVERITY_LEVELS.INFO,
        PRIORITY_LEVELS.RANGE_OF_MOTION,
        timestamp,
        repNumber
      );
    }

    // --- PRIORITY 5: MOVEMENT SPEED (WARNING / INFO) ---
    if (qualityData && qualityData.speed_score < 70 && qualityData.speed_score > 0) {
      return this.formatFeedback(
        'Slow down slightly for better muscle control.',
        FEEDBACK_TYPES.SPEED,
        SEVERITY_LEVELS.WARNING,
        PRIORITY_LEVELS.SPEED,
        timestamp,
        repNumber
      );
    }

    // --- PRIORITY 6: REPETITION COMPLETION (POSITIVE / WARNING) ---
    if (repData?.rep_completed) {
      this.steadyFramesCount += 5;
      return this.formatFeedback(
        `Repetition completed ✓ (${repData.rep_count} completed)`,
        FEEDBACK_TYPES.REPETITION,
        SEVERITY_LEVELS.INFO,
        PRIORITY_LEVELS.REPETITION,
        timestamp,
        repData.rep_count
      );
    }

    if (qualityData && qualityData.completion_score < 50) {
      return this.formatFeedback(
        'Repetition was incomplete. Complete full return to count rep.',
        FEEDBACK_TYPES.REPETITION,
        SEVERITY_LEVELS.WARNING,
        PRIORITY_LEVELS.REPETITION,
        timestamp,
        repNumber
      );
    }

    // --- PRIORITY 7: POSITIVE REINFORCEMENT (POSITIVE) ---
    this.steadyFramesCount++;
    if (this.steadyFramesCount > 60) {
      return this.formatFeedback(
        'Great job! Movement was consistent.',
        FEEDBACK_TYPES.POSITIVE,
        SEVERITY_LEVELS.INFO,
        PRIORITY_LEVELS.POSITIVE,
        timestamp,
        repNumber
      );
    }

    if (analysis?.state === MOVEMENT_STATES.MOVING) {
      return this.formatFeedback(
        'Good movement ✓ Continue steady tempo.',
        FEEDBACK_TYPES.POSITIVE,
        SEVERITY_LEVELS.INFO,
        PRIORITY_LEVELS.POSITIVE,
        timestamp,
        repNumber
      );
    }

    // Default resting baseline
    return this.formatFeedback(
      analysis?.feedback || 'Ready. Begin your movement steadily.',
      FEEDBACK_TYPES.POSITIVE,
      SEVERITY_LEVELS.INFO,
      PRIORITY_LEVELS.POSITIVE,
      timestamp,
      repNumber
    );
  }

  /**
   * Format structured output adhering to Requirement 3.
   *
   * @param {string} message
   * @param {string} feedbackType
   * @param {string} severity
   * @param {number} priority
   * @param {number} timestamp
   * @param {number|null} [repNumber]
   * @returns {object}
   */
  formatFeedback(message, feedbackType, severity, priority, timestamp, repNumber = null) {
    return {
      message,
      feedback_type: feedbackType,
      severity,
      priority,
      timestamp: timestamp || performance.now(),
      rep_number: repNumber ?? null,
    };
  }
}

/**
 * Factory function to create a RealTimeFeedbackEngine instance.
 *
 * @param {object} [options]
 * @returns {RealTimeFeedbackEngine}
 */
export function createFeedbackEngine(options = {}) {
  return new RealTimeFeedbackEngine(options);
}
