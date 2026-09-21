/**
 * Movement Quality Analysis & Scoring Engine.
 *
 * Phase 12: Evaluates completed therapeutic exercise repetitions and produces
 * transparent, application-defined scores from 0 to 100 across 5 biomechanical dimensions:
 * - Range of Motion (30%)
 * - Posture & Alignment (25%)
 * - Movement Consistency (20%)
 * - Movement Speed (15%)
 * - Completion (10%)
 *
 * Application-defined movement-quality metric.
 * Not a medical diagnosis or clinical recovery score.
 *
 * Pure JavaScript architecture, completely decoupled from React UI.
 * Does NOT store raw video footage.
 * Does NOT make recovery or diagnosis claims.
 */

import {
  MOVEMENT_STATES,
  EXERCISE_DEFINITIONS,
  getExerciseDefinition,
} from './exerciseDefinitions.js';

/**
 * Standard Scoring Model Weights.
 */
export const SCORING_WEIGHTS = {
  RANGE_OF_MOTION: 0.30,
  POSTURE: 0.25,
  CONSISTENCY: 0.20,
  SPEED: 0.15,
  COMPLETION: 0.10,
};

/**
 * Movement Quality Analyzer Class.
 */
export class MovementQualityAnalyzer {
  /**
   * @param {string|object} [exercise='knee-flexion']
   * @param {object} [options]
   * @param {number} [options.minConfidence=0.5]
   * @param {number} [options.idealSpeedMinSec=1.8]
   * @param {number} [options.idealSpeedMaxSec=4.5]
   * @param {number} [options.tooFastThresholdSec=1.2]
   * @param {number} [options.tooSlowThresholdSec=6.5]
   */
  constructor(exercise = 'knee-flexion', options = {}) {
    this.definition =
      typeof exercise === 'string'
        ? getExerciseDefinition(exercise)
        : exercise || EXERCISE_DEFINITIONS['knee-flexion'];

    this.options = {
      minConfidence: options.minConfidence ?? this.definition.minConfidence ?? 0.5,
      idealSpeedMinSec: options.idealSpeedMinSec ?? 1.8,
      idealSpeedMaxSec: options.idealSpeedMaxSec ?? 4.5,
      tooFastThresholdSec: options.tooFastThresholdSec ?? 1.2,
      tooSlowThresholdSec: options.tooSlowThresholdSec ?? 6.5,
      ...options,
    };

    // Telemetry buffer for active repetition
    this.currentRepFrames = [];
    this.repHistory = [];
    this.currentRepNumber = 0;
  }

  /**
   * Switch exercise and reset buffers.
   *
   * @param {string|object} exercise
   */
  setExercise(exercise) {
    this.definition =
      typeof exercise === 'string'
        ? getExerciseDefinition(exercise)
        : exercise || EXERCISE_DEFINITIONS['knee-flexion'];
    this.reset();
  }

  /**
   * Reset active rep frames and session history.
   */
  reset() {
    this.currentRepFrames = [];
    this.repHistory = [];
    this.currentRepNumber = 0;
  }

  /**
   * Clear active telemetry frames (called at the beginning of a rep).
   */
  clearActiveRepFrames() {
    this.currentRepFrames = [];
  }

  /**
   * Record a single video frame telemetry during an ongoing repetition.
   *
   * @param {object|null} analysis Result from ExerciseAnalyzer.analyze()
   * @param {Record<string, object>|null} [angles] Joint angles object
   * @param {object|null} [pose] Processed pose object
   * @param {number} [timestamp] Frame timestamp
   */
  recordFrame(analysis, angles = null, pose = null, timestamp = performance.now()) {
    if (!analysis) return;

    this.currentRepFrames.push({
      state: analysis.state,
      angle: typeof analysis.angle === 'number' && !Number.isNaN(analysis.angle) ? analysis.angle : null,
      confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0,
      postureAlert: analysis.postureAlert || null,
      angles: angles || analysis.angles || null,
      timestamp,
    });

    // Prevent unbounded memory growth if user stays active without completing reps
    if (this.currentRepFrames.length > 600) {
      this.currentRepFrames.shift();
    }
  }

  /**
   * Evaluates Range of Motion (0–100).
   * Weight: 30%
   *
   * @param {Array<object>} frames
   * @param {object} def Exercise definition
   * @returns {{ score: number, feedback: string|null, peakAngle: number|null }}
   */
  calculateRangeOfMotionScore(frames, def) {
    const validAngleFrames = frames.filter(
      (f) => typeof f.angle === 'number' && !Number.isNaN(f.angle) && f.confidence >= this.options.minConfidence
    );

    if (validAngleFrames.length === 0) {
      return {
        score: 0,
        feedback: 'Insufficient valid angle data to evaluate range of motion.',
        peakAngle: null,
      };
    }

    const isDecreasing = def.movementDirection === 'decreasing';
    const targetAngle = def.targetPosition.angle;
    const startAngle = def.startingPosition.angle;
    const targetTolerance = def.targetPosition.tolerance || 15;

    // Best angle reached towards the target
    const angles = validAngleFrames.map((f) => f.angle);
    const peakAngle = isDecreasing ? Math.min(...angles) : Math.max(...angles);

    const totalRequiredSpan = Math.abs(startAngle - targetAngle);
    if (totalRequiredSpan === 0) {
      return { score: 100, feedback: 'Good range of motion', peakAngle };
    }

    // Measure how close to the target the user reached
    const achievedSpan = isDecreasing ? startAngle - peakAngle : peakAngle - startAngle;
    const romFraction = achievedSpan / totalRequiredSpan;

    // Check if target was cleanly reached within tolerance
    const targetReached = isDecreasing
      ? peakAngle <= targetAngle + targetTolerance
      : peakAngle >= targetAngle - targetTolerance;

    let score = 0;
    let feedback = null;

    if (targetReached) {
      // Reached or surpassed target position
      score = 90 + Math.min(10, Math.max(0, (romFraction - 1.0) * 20));
      score = Math.min(100, Math.max(90, score));
      feedback = 'Good range of motion';
    } else {
      // Stopped short of target
      score = Math.round(Math.max(0, Math.min(88, romFraction * 90)));
      feedback = 'Try to reach the target position';
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      feedback,
      peakAngle: Math.round(peakAngle * 10) / 10,
    };
  }

  /**
   * Evaluates Posture & Alignment (0–100).
   * Weight: 25%
   *
   * @param {Array<object>} frames
   * @param {object} def Exercise definition
   * @returns {{ score: number, feedback: string|null }}
   */
  calculatePostureScore(frames, def) {
    if (frames.length === 0) {
      return { score: 0, feedback: 'Cannot evaluate posture without landmark frames.' };
    }

    let postureAlertFrames = 0;
    let lowConfidenceFrames = 0;
    let symmetryViolations = 0;

    for (const f of frames) {
      if (f.postureAlert) {
        postureAlertFrames++;
      }
      if (f.confidence < this.options.minConfidence) {
        lowConfidenceFrames++;
      }

      // Bilateral symmetry check for squat or bilateral exercises
      if (def.id === 'squat' && f.angles) {
        const leftKnee = f.angles.leftKnee?.angle;
        const rightKnee = f.angles.rightKnee?.angle;
        if (typeof leftKnee === 'number' && typeof rightKnee === 'number') {
          if (Math.abs(leftKnee - rightKnee) > 20) {
            symmetryViolations++;
          }
        }
      }
    }

    const totalFrames = frames.length;
    const alertRatio = postureAlertFrames / totalFrames;
    const lowConfRatio = lowConfidenceFrames / totalFrames;
    const symmetryRatio = symmetryViolations / totalFrames;

    let score = 100;

    // Deductions
    score -= alertRatio * 50;
    score -= lowConfRatio * 30;
    score -= symmetryRatio * 20;

    score = Math.max(0, Math.min(100, Math.round(score)));

    let feedback = 'Keep your posture steady';
    if (score >= 85) {
      feedback = 'Good posture and alignment';
    } else if (alertRatio > 0.2 && def.postureRules?.excessiveLeanWarning) {
      feedback = def.postureRules.excessiveLeanWarning;
    } else if (lowConfRatio > 0.4) {
      feedback = 'Keep your body clearly in frame';
    }

    return { score, feedback };
  }

  /**
   * Evaluates Movement Consistency & Smoothness (0–100).
   * Weight: 20%
   *
   * @param {Array<object>} frames
   * @returns {{ score: number, feedback: string|null }}
   */
  calculateConsistencyScore(frames) {
    const validFrames = frames.filter(
      (f) => typeof f.angle === 'number' && !Number.isNaN(f.angle) && f.confidence >= this.options.minConfidence
    );

    if (validFrames.length < 4) {
      return { score: 0, feedback: 'Insufficient data to evaluate movement consistency.' };
    }

    // Compute instantaneous frame-to-frame angular velocity (deg/sec)
    const velocities = [];
    for (let i = 1; i < validFrames.length; i++) {
      const dt = (validFrames[i].timestamp - validFrames[i - 1].timestamp) / 1000;
      if (dt > 0.005 && dt < 0.5) {
        const dAngle = validFrames[i].angle - validFrames[i - 1].angle;
        velocities.push(dAngle / dt);
      }
    }

    if (velocities.length < 3) {
      return { score: 50, feedback: 'Focus on smooth, controlled movement' };
    }

    // Calculate velocity jerk / acceleration variance
    const accelerations = [];
    for (let i = 1; i < velocities.length; i++) {
      accelerations.push(Math.abs(velocities[i] - velocities[i - 1]));
    }

    const avgJerk =
      accelerations.length > 0
        ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length
        : 0;

    // Smooth movement typically has avgJerk under 60 deg/s^2
    // Severe erratic jitter gives avgJerk > 200 deg/s^2
    let score = 100 - avgJerk * 0.4;
    score = Math.max(0, Math.min(100, Math.round(score)));

    let feedback = 'Focus on smooth, controlled movement';
    if (score >= 80) {
      feedback = 'Movement was consistent';
    }

    return { score, feedback };
  }

  /**
   * Evaluates Movement Speed & Tempo (0–100).
   * Weight: 15%
   *
   * @param {number} durationSec
   * @returns {{ score: number, feedback: string|null }}
   */
  calculateSpeedScore(durationSec) {
    if (typeof durationSec !== 'number' || durationSec <= 0 || Number.isNaN(durationSec)) {
      return { score: 0, feedback: 'Invalid duration.' };
    }

    const {
      idealSpeedMinSec,
      idealSpeedMaxSec,
      tooFastThresholdSec,
      tooSlowThresholdSec,
    } = this.options;

    let score = 100;
    let feedback = 'Good movement tempo';

    if (durationSec < tooFastThresholdSec) {
      // Excessively fast / rushed movement
      const deficit = tooFastThresholdSec - durationSec;
      score = Math.max(10, Math.round(70 - deficit * 60));
      feedback = 'Slow down slightly';
    } else if (durationSec < idealSpeedMinSec) {
      // Slightly fast
      const ratio = (durationSec - tooFastThresholdSec) / (idealSpeedMinSec - tooFastThresholdSec);
      score = Math.round(75 + ratio * 20);
      feedback = 'Slow down slightly';
    } else if (durationSec <= idealSpeedMaxSec) {
      // Ideal therapeutic pace
      score = 95 + Math.round(Math.random() * 5); // 95-100
      score = Math.min(100, score);
      feedback = 'Good movement tempo';
    } else if (durationSec <= tooSlowThresholdSec) {
      // Slightly slow
      const excess = durationSec - idealSpeedMaxSec;
      score = Math.round(90 - excess * 15);
      feedback = 'Try to maintain a steady tempo';
    } else {
      // Excessively slow / stalled
      const excess = durationSec - tooSlowThresholdSec;
      score = Math.max(15, Math.round(55 - excess * 10));
      feedback = 'Try to maintain a steady tempo';
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      feedback,
    };
  }

  /**
   * Evaluates Completion (0–100).
   * Weight: 10%
   *
   * @param {boolean} isCompleted
   * @param {Array<object>} frames
   * @returns {{ score: number, feedback: string|null }}
   */
  calculateCompletionScore(isCompleted, frames) {
    if (isCompleted) {
      return { score: 100, feedback: null };
    }

    // Incomplete movement
    // Estimate progress achieved based on states visited
    const statesVisited = new Set(frames.map((f) => f.state));
    let score = 10;
    if (statesVisited.has(MOVEMENT_STATES.TARGET)) {
      score = 50; // reached target but failed return
    } else if (statesVisited.has(MOVEMENT_STATES.MOVING)) {
      score = 25; // moved but failed to reach target
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      feedback: 'Repetition was incomplete',
    };
  }

  /**
   * Evaluate a repetition once completed or aborted.
   *
   * @param {object} repInfo Repetition result or metadata
   * @param {boolean} [repInfo.isCompleted=true]
   * @param {number} [repInfo.durationSec]
   * @param {Array<object>} [customFrames] Optional custom frames (uses internal buffer by default)
   * @returns {object} Structured Movement Quality Result
   */
  evaluateRepetition(repInfo = {}, customFrames = null) {
    const isCompleted = repInfo.isCompleted ?? repInfo.rep_completed ?? true;
    const durationSec =
      typeof repInfo.durationSec === 'number'
        ? repInfo.durationSec
        : typeof repInfo.rep_duration === 'number'
        ? repInfo.rep_duration
        : 2.5;

    const frames = customFrames || [...this.currentRepFrames];
    const def = this.definition;

    this.currentRepNumber++;
    const repNumber = repInfo.rep_number ?? repInfo.rep_count ?? this.currentRepNumber;

    // 1. Calculate sub-scores
    const romResult = this.calculateRangeOfMotionScore(frames, def);
    const postureResult = this.calculatePostureScore(frames, def);
    const consistencyResult = this.calculateConsistencyScore(frames);
    const speedResult = this.calculateSpeedScore(durationSec);
    const completionResult = this.calculateCompletionScore(isCompleted, frames);

    // 2. Compute composite weighted score
    // Range of Motion 30%, Posture 25%, Consistency 20%, Speed 15%, Completion 10%
    const weightedSum =
      romResult.score * SCORING_WEIGHTS.RANGE_OF_MOTION +
      postureResult.score * SCORING_WEIGHTS.POSTURE +
      consistencyResult.score * SCORING_WEIGHTS.CONSISTENCY +
      speedResult.score * SCORING_WEIGHTS.SPEED +
      completionResult.score * SCORING_WEIGHTS.COMPLETION;

    const overallScore = Math.max(0, Math.min(100, Math.round(weightedSum)));

    // 3. Aggregate feedback messages
    const feedbackSet = new Set();

    if (romResult.feedback) feedbackSet.add(romResult.feedback);
    if (postureResult.feedback && postureResult.score < 85) feedbackSet.add(postureResult.feedback);
    if (consistencyResult.feedback) feedbackSet.add(consistencyResult.feedback);
    if (speedResult.feedback && speedResult.score < 90) feedbackSet.add(speedResult.feedback);
    if (completionResult.feedback) feedbackSet.add(completionResult.feedback);

    // Fallback if empty
    if (feedbackSet.size === 0) {
      feedbackSet.add('Good movement execution');
    }

    const structuredResult = {
      exercise: def.name,
      rep_number: repNumber,
      score: overallScore,
      range_of_motion_score: romResult.score,
      posture_score: postureResult.score,
      consistency_score: consistencyResult.score,
      speed_score: speedResult.score,
      completion_score: completionResult.score,
      feedback: Array.from(feedbackSet),
      timestamp: performance.now(),
      disclaimer: 'Application-defined movement-quality metric. Not a medical diagnosis or clinical recovery score.',
    };

    if (isCompleted) {
      this.repHistory.push(structuredResult);
    }

    // Reset buffer for next rep
    this.clearActiveRepFrames();

    return structuredResult;
  }

  /**
   * Session-level aggregated quality evaluation.
   *
   * @returns {object} Aggregated session score and insights
   */
  getSessionQuality() {
    if (this.repHistory.length === 0) {
      return {
        exercise: this.definition.name,
        total_valid_reps: 0,
        score: 0,
        average_rom: 0,
        average_posture: 0,
        average_consistency: 0,
        average_speed: 0,
        average_completion: 0,
        feedback: ['Complete repetitions to evaluate session quality.'],
        disclaimer: 'Application-defined movement-quality metric. Not a medical diagnosis or clinical recovery score.',
      };
    }

    const n = this.repHistory.length;
    const avg = (key) => Math.round(this.repHistory.reduce((acc, r) => acc + r[key], 0) / n);

    const score = avg('score');
    const average_rom = avg('range_of_motion_score');
    const average_posture = avg('posture_score');
    const average_consistency = avg('consistency_score');
    const average_speed = avg('speed_score');
    const average_completion = avg('completion_score');

    // Aggregate key feedback across session
    const feedbackList = [];
    if (average_rom >= 85) feedbackList.push('Good range of motion');
    else feedbackList.push('Try to reach the target position');

    if (average_consistency >= 80) feedbackList.push('Movement was consistent');
    if (average_posture < 80) feedbackList.push('Keep your posture steady');
    if (average_speed < 75) feedbackList.push('Slow down slightly');

    return {
      exercise: this.definition.name,
      total_valid_reps: n,
      score: Math.max(0, Math.min(100, score)),
      average_rom: Math.max(0, Math.min(100, average_rom)),
      average_posture: Math.max(0, Math.min(100, average_posture)),
      average_consistency: Math.max(0, Math.min(100, average_consistency)),
      average_speed: Math.max(0, Math.min(100, average_speed)),
      average_completion: Math.max(0, Math.min(100, average_completion)),
      feedback: feedbackList.length > 0 ? feedbackList : ['Movement was consistent'],
      disclaimer: 'Application-defined movement-quality metric. Not a medical diagnosis or clinical recovery score.',
    };
  }
}

/**
 * Factory function to create a MovementQualityAnalyzer instance.
 *
 * @param {string|object} [exercise='knee-flexion']
 * @param {object} [options]
 * @returns {MovementQualityAnalyzer}
 */
export function createMovementQualityAnalyzer(exercise = 'knee-flexion', options = {}) {
  return new MovementQualityAnalyzer(exercise, options);
}
