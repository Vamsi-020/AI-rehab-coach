/**
 * Repetition Counting Engine.
 *
 * Phase 11: Converts exercise movement states (START, MOVING, TARGET, RETURNING)
 * into verified, clinically sound exercise repetitions.
 *
 * State machine flow:
 *   START -> MOVING -> TARGET -> RETURNING -> START -> REP + 1
 *
 * Enforces:
 * - Duplicate target frame suppression (user staying in target position)
 * - Incomplete movement rejection (reverting to start before reaching target)
 * - Low-confidence landmark filtering
 * - Debounce & consecutive frame confirmation against angle jitter
 * - Configurable target/return thresholds, confidence, min rep duration, and cooldown
 * - Pure JavaScript architecture decoupled from React UI
 * - No medical or diagnostic claims
 * - No raw video footage storage
 */

import {
  MOVEMENT_STATES,
  EXERCISE_DEFINITIONS,
  getExerciseDefinition,
} from './exerciseDefinitions.js';

/**
 * Standard Repetition Counter States.
 */
export const REP_STATES = {
  START: 'START',
  MOVING: 'MOVING',
  TARGET: 'TARGET',
  RETURNING: 'RETURNING',
};

/**
 * RepCounter Class.
 */
export class RepCounter {
  /**
   * @param {string|object} [exercise='knee-flexion'] Exercise key or definition object
   * @param {object} [options]
   * @param {number} [options.confidenceThreshold] Minimum confidence to advance repetition state (default: 0.5)
   * @param {number} [options.minRepDurationMs=600] Minimum millisecond duration for a rep to be physically plausible
   * @param {number} [options.cooldownMs=400] Debounce cooldown in ms after completing a rep before starting next
   * @param {number} [options.consecutiveFramesToTransition=2] Frames required to confirm state changes against jitter
   * @param {object} [options.targetThreshold] Custom target angle & tolerance override
   * @param {object} [options.returnThreshold] Custom return angle & tolerance override
   */
  constructor(exercise = 'knee-flexion', options = {}) {
    this.definition =
      typeof exercise === 'string'
        ? getExerciseDefinition(exercise)
        : exercise || EXERCISE_DEFINITIONS['knee-flexion'];

    this.options = {
      confidenceThreshold: options.confidenceThreshold ?? this.definition.minConfidence ?? 0.5,
      minRepDurationMs: options.minRepDurationMs ?? 600,
      cooldownMs: options.cooldownMs ?? 400,
      consecutiveFramesToTransition: options.consecutiveFramesToTransition ?? 2,
      targetThreshold: options.targetThreshold ?? null,
      returnThreshold: options.returnThreshold ?? null,
      ...options,
    };

    // State machine properties
    this.state = REP_STATES.START;
    this.previousState = REP_STATES.START;
    this.repCount = 0;
    this.reachedTarget = false;
    this.repStartTime = null;
    this.lastRepCompletedTime = null;
    this.candidateState = null;
    this.candidateFrames = 0;
    this.repDurations = [];
  }

  /**
   * Switch the exercise definition and reset all repetition counters.
   *
   * @param {string|object} exercise
   */
  setExercise(exercise) {
    this.definition =
      typeof exercise === 'string'
        ? getExerciseDefinition(exercise)
        : exercise || EXERCISE_DEFINITIONS['knee-flexion'];

    if (!this.options.confidenceThreshold || this.options.confidenceThreshold === 0.5) {
      this.options.confidenceThreshold = this.definition.minConfidence ?? 0.5;
    }
    this.reset();
  }

  /**
   * Reset all repetition counters, states, and timing buffers.
   */
  reset() {
    this.state = REP_STATES.START;
    this.previousState = REP_STATES.START;
    this.repCount = 0;
    this.reachedTarget = false;
    this.repStartTime = null;
    this.lastRepCompletedTime = null;
    this.candidateState = null;
    this.candidateFrames = 0;
    this.repDurations = [];
  }

  /**
   * Process a single analysis frame from ExerciseAnalyzer.
   *
   * @param {object|null} analysis Result from ExerciseAnalyzer.analyze()
   * @param {number} [timestamp] Current frame timestamp (ms)
   * @returns {object} Structured repetition result
   */
  process(analysis, timestamp = performance.now()) {
    const exerciseName = this.definition?.name || 'Exercise';

    // 1. Guard against null or malformed analysis
    if (!analysis) {
      return this.formatResult({
        exercise: exerciseName,
        state: this.state,
        rep_count: this.repCount,
        rep_completed: false,
        confidence: 0.0,
        feedback: 'Position body to begin exercise.',
        timestamp,
      });
    }

    const confidence = typeof analysis.confidence === 'number' ? analysis.confidence : 0.0;
    const movementState = analysis.state;
    const feedback = analysis.feedback || '';

    // 2. Reject low-confidence frames
    const minConfidence = this.options.confidenceThreshold;
    if (
      movementState === MOVEMENT_STATES.LOW_CONFIDENCE ||
      movementState === MOVEMENT_STATES.INVALID ||
      confidence < minConfidence
    ) {
      // Do not transition state or count rep on low confidence
      this.candidateState = null;
      this.candidateFrames = 0;

      return this.formatResult({
        exercise: exerciseName,
        state: this.state,
        rep_count: this.repCount,
        rep_completed: false,
        confidence,
        feedback:
          movementState === MOVEMENT_STATES.LOW_CONFIDENCE
            ? this.definition.feedbackRules?.lowConfidence || 'Ensure full visibility of joints.'
            : this.definition.feedbackRules?.invalid || 'Cannot detect required landmarks.',
        timestamp,
      });
    }

    // 3. Map Phase 10 movement states to RepCounter target states
    let desiredState = this.state;

    if (movementState === MOVEMENT_STATES.START) {
      desiredState = REP_STATES.START;
    } else if (movementState === MOVEMENT_STATES.MOVING) {
      desiredState = REP_STATES.MOVING;
    } else if (movementState === MOVEMENT_STATES.TARGET) {
      desiredState = REP_STATES.TARGET;
    } else if (movementState === MOVEMENT_STATES.RETURNING) {
      desiredState = REP_STATES.RETURNING;
    }

    // 4. Debounce / Consecutive frame confirmation against rapid noise jitter
    const requiredFrames = this.options.consecutiveFramesToTransition;
    let confirmedState = this.state;

    if (desiredState === this.state) {
      this.candidateState = null;
      this.candidateFrames = 0;
      confirmedState = this.state;
    } else {
      if (this.candidateState === desiredState) {
        this.candidateFrames++;
      } else {
        this.candidateState = desiredState;
        this.candidateFrames = 1;
      }

      if (this.candidateFrames >= requiredFrames) {
        confirmedState = desiredState;
        this.candidateState = null;
        this.candidateFrames = 0;
      } else {
        confirmedState = this.state; // Hold current state until confirmed
      }
    }

    // 5. State Machine Transition & Repetition Logic
    let repCompleted = false;
    let repDuration = null;

    // Check if cooldown is active since last rep
    const inCooldown =
      this.lastRepCompletedTime !== null &&
      timestamp - this.lastRepCompletedTime < this.options.cooldownMs;

    if (confirmedState !== this.state) {
      const fromState = this.state;
      const toState = confirmedState;

      switch (fromState) {
        case REP_STATES.START:
          if (toState === REP_STATES.MOVING) {
            // Only start a new repetition if not in cooldown
            if (!inCooldown) {
              this.state = REP_STATES.MOVING;
              this.previousState = REP_STATES.START;
              this.repStartTime = timestamp;
              this.reachedTarget = false;
            }
          } else if (toState === REP_STATES.TARGET) {
            // Fast transition directly into target
            if (!inCooldown) {
              this.state = REP_STATES.TARGET;
              this.previousState = REP_STATES.START;
              this.repStartTime = timestamp;
              this.reachedTarget = true;
            }
          }
          break;

        case REP_STATES.MOVING:
          if (toState === REP_STATES.TARGET) {
            this.state = REP_STATES.TARGET;
            this.previousState = REP_STATES.MOVING;
            this.reachedTarget = true;
          } else if (toState === REP_STATES.START) {
            // INCOMPLETE MOVEMENT: returned to start without hitting target!
            this.state = REP_STATES.START;
            this.previousState = REP_STATES.MOVING;
            this.reachedTarget = false;
            this.repStartTime = null;
          } else if (toState === REP_STATES.RETURNING) {
            // Moving back without hitting target
            this.state = REP_STATES.RETURNING;
            this.previousState = REP_STATES.MOVING;
          }
          break;

        case REP_STATES.TARGET:
          if (toState === REP_STATES.RETURNING) {
            this.state = REP_STATES.RETURNING;
            this.previousState = REP_STATES.TARGET;
          } else if (toState === REP_STATES.START) {
            // Fast return directly to start
            if (this.reachedTarget && this.repStartTime !== null) {
              const duration = timestamp - this.repStartTime;
              if (duration >= this.options.minRepDurationMs && !inCooldown) {
                this.repCount++;
                repCompleted = true;
                repDuration = Math.round(duration) / 1000;
                this.repDurations.push(repDuration);
                this.lastRepCompletedTime = timestamp;
              }
            }
            this.state = REP_STATES.START;
            this.previousState = REP_STATES.TARGET;
            this.reachedTarget = false;
            this.repStartTime = null;
          }
          break;

        case REP_STATES.RETURNING:
          if (toState === REP_STATES.START) {
            // Reached START: check if this completes a valid repetition
            if (this.reachedTarget && this.repStartTime !== null) {
              const duration = timestamp - this.repStartTime;
              if (duration >= this.options.minRepDurationMs && !inCooldown) {
                this.repCount++;
                repCompleted = true;
                repDuration = Math.round(duration) / 1000;
                this.repDurations.push(repDuration);
                this.lastRepCompletedTime = timestamp;
              }
            }
            this.state = REP_STATES.START;
            this.previousState = REP_STATES.RETURNING;
            this.reachedTarget = false;
            this.repStartTime = null;
          } else if (toState === REP_STATES.TARGET) {
            // Reverse back to target
            this.state = REP_STATES.TARGET;
            this.previousState = REP_STATES.RETURNING;
          }
          break;

        default:
          this.state = REP_STATES.START;
      }
    }

    return this.formatResult({
      exercise: exerciseName,
      state: this.state,
      rep_count: this.repCount,
      rep_completed: repCompleted,
      confidence,
      feedback: repCompleted ? 'Repetition complete!' : feedback,
      rep_duration: repDuration,
      timestamp,
    });
  }

  /**
   * Format structured output adhering to Requirement 11.
   *
   * @param {object} params
   * @returns {object}
   */
  formatResult(params) {
    return {
      exercise: params.exercise,
      state: params.state,
      rep_count: params.rep_count,
      rep_completed: params.rep_completed,
      confidence: Math.round((params.confidence ?? 0) * 100) / 100,
      feedback: params.feedback || '',
      rep_duration: params.rep_duration ?? null,
      timestamp: params.timestamp || performance.now(),
    };
  }

  /**
   * Summary metrics for session reporting.
   */
  getStats() {
    return {
      repCount: this.repCount,
      totalCompleted: this.repDurations.length,
      averageRepDurationSec:
        this.repDurations.length > 0
          ? Math.round(
              (this.repDurations.reduce((a, b) => a + b, 0) / this.repDurations.length) * 10
            ) / 10
          : 0,
    };
  }
}

/**
 * Factory function to create a RepCounter instance.
 *
 * @param {string|object} [exercise='knee-flexion']
 * @param {object} [options]
 * @returns {RepCounter}
 */
export function createRepCounter(exercise = 'knee-flexion', options = {}) {
  return new RepCounter(exercise, options);
}
