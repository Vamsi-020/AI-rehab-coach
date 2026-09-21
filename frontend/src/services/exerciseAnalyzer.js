/**
 * Exercise Analysis Engine.
 *
 * Phase 10: Converts processed pose landmarks and joint angles into
 * clinical movement states (START, MOVING, TARGET, RETURNING, LOW_CONFIDENCE, INVALID).
 *
 * Pure JavaScript architecture, decoupled from React UI.
 * Does NOT perform repetition counting or movement quality scoring (deferred to future phases).
 * Does NOT make medical diagnoses or safety claims.
 */

import {
  MOVEMENT_STATES,
  EXERCISE_DEFINITIONS,
  getExerciseDefinition,
} from './exerciseDefinitions.js';
import { createAngleEngine } from './jointAngleService.js';

/**
 * Exercise Analyzer Class.
 * Tracks movement states with hysteresis, confidence evaluation, and posture checks.
 */
export class ExerciseAnalyzer {
  /**
   * @param {string|object} exercise Definition object or key
   * @param {object} [options]
   * @param {'left'|'right'|'auto'} [options.preferredSide='auto']
   * @param {number} [options.minConfidence]
   * @param {number} [options.consecutiveFramesToTransition=2]
   */
  constructor(exercise, options = {}) {
    this.definition =
      typeof exercise === 'string'
        ? getExerciseDefinition(exercise)
        : exercise || EXERCISE_DEFINITIONS['knee-flexion'];

    this.options = {
      preferredSide: options.preferredSide || 'auto',
      minConfidence: options.minConfidence ?? this.definition.minConfidence ?? 0.5,
      consecutiveFramesToTransition: options.consecutiveFramesToTransition ?? 2,
      ...options,
    };

    this.angleEngine = createAngleEngine({
      minConfidence: this.options.minConfidence,
    });

    this.currentState = MOVEMENT_STATES.START;
    this.previousState = MOVEMENT_STATES.START;
    this.stateHoldFrames = 0;
    this.hasReachedTargetInRep = false;
    this.smoothedAngle = null;
    this.recentAngles = [];
    this.maxHistorySize = 5;
  }

  /**
   * Switch the exercise definition and reset state.
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
   * Reset state machine buffers.
   */
  reset() {
    this.currentState = MOVEMENT_STATES.START;
    this.previousState = MOVEMENT_STATES.START;
    this.stateHoldFrames = 0;
    this.hasReachedTargetInRep = false;
    this.smoothedAngle = null;
    this.recentAngles = [];
  }

  /**
   * Select the primary active joint based on preferred side and confidence.
   *
   * @param {Record<string, object>} angles
   * @returns {{ jointKey: string, angleObj: object | null }}
   */
  resolveActiveJoint(angles) {
    if (!angles) return { jointKey: '', angleObj: null };

    const { primaryJoints, defaultSide } = this.definition;
    const pref = this.options.preferredSide;

    // 1. If explicit side preferred
    if (pref === 'left' || pref === 'right') {
      const match = primaryJoints.find((j) => j.toLowerCase().startsWith(pref));
      if (match && angles[match]?.isValid) {
        return { jointKey: match, angleObj: angles[match] };
      }
    }

    // 2. If 'auto', pick the primary joint with higher confidence / valid
    let bestKey = primaryJoints[0] || '';
    let bestAngle = null;
    let highestConf = -1;

    for (const key of primaryJoints) {
      const a = angles[key];
      if (a && a.isValid && a.confidence > highestConf) {
        highestConf = a.confidence;
        bestKey = key;
        bestAngle = a;
      }
    }

    if (bestAngle) {
      return { jointKey: bestKey, angleObj: bestAngle };
    }

    // Fallback to default
    const defaultKey =
      primaryJoints.find((j) => j.toLowerCase().startsWith(defaultSide)) ||
      primaryJoints[0] ||
      '';
    return { jointKey: defaultKey, angleObj: angles[defaultKey] || null };
  }

  /**
   * Check whether all required landmarks exist and meet confidence.
   *
   * @param {object} pose Processed pose frame
   * @returns {{ ok: boolean, missingCount: number, minConfidence: number }}
   */
  verifyRequiredLandmarks(pose) {
    if (!pose || !pose.byName) {
      return { ok: false, missingCount: 999, minConfidence: 0, hasLowConfidence: false };
    }

    const { requiredLandmarks, minConfidence } = this.definition;
    const threshold = this.options.minConfidence ?? minConfidence;
    let missingCount = 0;
    let lowestConf = 1.0;
    let hasLowConfidence = false;

    for (const name of requiredLandmarks) {
      const lm = pose.byName[name];
      if (
        !lm ||
        typeof lm.x !== 'number' ||
        Number.isNaN(lm.x) ||
        typeof lm.y !== 'number' ||
        Number.isNaN(lm.y)
      ) {
        missingCount++;
      } else {
        const vis = typeof lm.visibility === 'number' ? lm.visibility : (lm.isValid ? 1.0 : 0);
        lowestConf = Math.min(lowestConf, vis);
        if (vis < threshold) {
          hasLowConfidence = true;
        }
      }
    }

    return {
      ok: missingCount === 0 && !hasLowConfidence,
      missingCount,
      minConfidence: lowestConf,
      hasLowConfidence,
    };
  }

  /**
   * Main analysis execution on a single video frame.
   *
   * @param {object|null} pose Processed pose object from Phase 8
   * @param {Record<string, object>|null} [providedAngles] Pre-computed angles from Phase 9
   * @param {number} [timestamp]
   * @returns {object} Structured exercise analysis state
   */
  analyze(pose, providedAngles = null, timestamp = performance.now()) {
    const def = this.definition;

    // 1. Verify required landmark presence
    const lmCheck = this.verifyRequiredLandmarks(pose);
    if (lmCheck.missingCount > 0) {
      this.transitionTo(MOVEMENT_STATES.INVALID);
      return this.formatOutput({
        state: MOVEMENT_STATES.INVALID,
        valid: false,
        confidence: lmCheck.minConfidence,
        feedback: def.feedbackRules.invalid,
        timestamp,
      });
    }

    if (lmCheck.hasLowConfidence || !lmCheck.ok) {
      this.transitionTo(MOVEMENT_STATES.LOW_CONFIDENCE);
      return this.formatOutput({
        state: MOVEMENT_STATES.LOW_CONFIDENCE,
        valid: false,
        confidence: lmCheck.minConfidence,
        feedback: def.feedbackRules.lowConfidence,
        timestamp,
      });
    }

    // 2. Obtain angles (using provided or computing on the fly)
    const angles = providedAngles || this.angleEngine.calculateAll(pose);
    const { jointKey, angleObj } = this.resolveActiveJoint(angles);

    if (!angleObj || !angleObj.isValid || typeof angleObj.angle !== 'number') {
      this.transitionTo(MOVEMENT_STATES.INVALID);
      return this.formatOutput({
        state: MOVEMENT_STATES.INVALID,
        angles,
        valid: false,
        confidence: angleObj?.confidence ?? 0,
        feedback: def.feedbackRules.invalid,
        timestamp,
      });
    }

    const currentAngle = angleObj.angle;
    const confidence = angleObj.confidence;

    // 3. Smooth angle with EMA (default alpha = 0.65) to reject high-frequency jitter while preserving responsiveness
    const alpha = this.options.smoothingAlpha ?? 0.65;
    if (this.smoothedAngle === null) {
      this.smoothedAngle = currentAngle;
    } else {
      this.smoothedAngle = alpha * currentAngle + (1 - alpha) * this.smoothedAngle;
    }
    const smoothedAngle = this.smoothedAngle;

    this.recentAngles.push(smoothedAngle);
    if (this.recentAngles.length > this.maxHistorySize) {
      this.recentAngles.shift();
    }

    // 4. Calculate movement boundaries & progress
    const {
      movementDirection,
      startingPosition,
      targetPosition,
      returnPosition,
      postureRules,
      feedbackRules,
    } = def;

    const isDecreasing = movementDirection === 'decreasing';

    // Start zone check
    const inStartZone = isDecreasing
      ? smoothedAngle >= startingPosition.angle - startingPosition.tolerance
      : smoothedAngle <= startingPosition.angle + startingPosition.tolerance;

    // Target zone check
    const inTargetZone = isDecreasing
      ? smoothedAngle <= targetPosition.angle + targetPosition.tolerance
      : smoothedAngle >= targetPosition.angle - targetPosition.tolerance;

    // Return zone check
    const inReturnZone = isDecreasing
      ? smoothedAngle >= returnPosition.angle - returnPosition.tolerance
      : smoothedAngle <= returnPosition.angle + returnPosition.tolerance;

    // Progress percentage calculation
    const totalSpan = Math.abs(startingPosition.angle - targetPosition.angle);
    const travel = isDecreasing
      ? startingPosition.angle - smoothedAngle
      : smoothedAngle - startingPosition.angle;
    let progressPct = totalSpan > 0 ? (travel / totalSpan) * 100 : 0;
    if (inTargetZone) {
      progressPct = 100;
    } else if (inStartZone && !this.hasReachedTargetInRep) {
      progressPct = 0;
    }
    progressPct = Math.max(0, Math.min(100, Math.round(progressPct)));

    // 5. State Machine Transitions
    let nextState = this.currentState;
    let feedback = feedbackRules.start;

    switch (this.currentState) {
      case MOVEMENT_STATES.START:
      case MOVEMENT_STATES.INVALID:
      case MOVEMENT_STATES.LOW_CONFIDENCE:
        if (inStartZone) {
          nextState = MOVEMENT_STATES.START;
          feedback = feedbackRules.start;
          this.hasReachedTargetInRep = false;
        } else if (inTargetZone) {
          nextState = MOVEMENT_STATES.TARGET;
          feedback = feedbackRules.target;
          this.hasReachedTargetInRep = true;
        } else {
          // Began moving out of start zone
          nextState = MOVEMENT_STATES.MOVING;
          feedback = feedbackRules.moving;
        }
        break;

      case MOVEMENT_STATES.MOVING:
        if (inTargetZone) {
          nextState = MOVEMENT_STATES.TARGET;
          feedback = feedbackRules.target;
          this.hasReachedTargetInRep = true;
        } else if (inStartZone) {
          // Reverted back to start without hitting target
          nextState = MOVEMENT_STATES.START;
          feedback = feedbackRules.start;
          this.hasReachedTargetInRep = false;
        } else {
          // Check if moving backwards (reversing towards start)
          const isReversing =
            this.recentAngles.length >= 3 &&
            (isDecreasing
              ? this.recentAngles[this.recentAngles.length - 1] >
                this.recentAngles[0] + 5
              : this.recentAngles[this.recentAngles.length - 1] <
                this.recentAngles[0] - 5);

          if (isReversing && progressPct < 60) {
            nextState = MOVEMENT_STATES.RETURNING;
            feedback = feedbackRules.incomplete;
          } else {
            nextState = MOVEMENT_STATES.MOVING;
            feedback = feedbackRules.moving;
          }
        }
        break;

      case MOVEMENT_STATES.TARGET:
        if (inTargetZone) {
          nextState = MOVEMENT_STATES.TARGET;
          feedback = feedbackRules.target;
        } else {
          // Moving out of target zone -> beginning return phase
          nextState = MOVEMENT_STATES.RETURNING;
          feedback = feedbackRules.returning;
        }
        break;

      case MOVEMENT_STATES.RETURNING:
        if (inReturnZone || inStartZone) {
          nextState = MOVEMENT_STATES.START;
          feedback = feedbackRules.start;
          this.hasReachedTargetInRep = false;
        } else {
          nextState = MOVEMENT_STATES.RETURNING;
          feedback = this.hasReachedTargetInRep
            ? feedbackRules.returning
            : feedbackRules.incomplete;
        }
        break;

      default:
        nextState = MOVEMENT_STATES.START;
        feedback = feedbackRules.start;
    }

    this.transitionTo(nextState);

    // 6. Posture / Alignment checks (e.g. Squat torso lean)
    let postureAlert = null;
    if (postureRules && pose && angles) {
      if (postureRules.minHipAngle) {
        const leftHipAngle = angles.leftHip?.angle;
        const rightHipAngle = angles.rightHip?.angle;
        const activeHipAngle =
          typeof leftHipAngle === 'number' && typeof rightHipAngle === 'number'
            ? (leftHipAngle + rightHipAngle) / 2
            : leftHipAngle ?? rightHipAngle;

        if (
          typeof activeHipAngle === 'number' &&
          activeHipAngle < postureRules.minHipAngle
        ) {
          postureAlert = postureRules.excessiveLeanWarning;
        }
      }
    }

    return this.formatOutput({
      state: this.currentState,
      primaryJoint: jointKey,
      angle: Math.round(smoothedAngle * 10) / 10,
      targetAngle: targetPosition.angle,
      startAngle: startingPosition.angle,
      angles,
      confidence,
      valid: true,
      feedback,
      progressPct,
      postureAlert,
      timestamp,
    });
  }

  /**
   * Internal transition tracker.
   * @param {string} newState
   */
  transitionTo(newState) {
    if (this.currentState !== newState) {
      this.previousState = this.currentState;
      this.currentState = newState;
      this.stateHoldFrames = 0;
    } else {
      this.stateHoldFrames++;
    }
  }

  /**
   * Formats structured output.
   * @param {object} params
   * @returns {object}
   */
  formatOutput(params) {
    const def = this.definition;
    return {
      exercise: def.name,
      exerciseId: def.id,
      state: params.state,
      previousState: this.previousState,
      primaryJoint: params.primaryJoint || def.primaryJoints[0] || '',
      angle: params.angle ?? null,
      targetAngle: params.targetAngle ?? def.targetPosition.angle,
      startAngle: params.startAngle ?? def.startingPosition.angle,
      angles: params.angles || {},
      confidence: params.confidence ?? 0,
      valid: params.valid ?? false,
      feedback: params.feedback || '',
      progressPct: params.progressPct ?? 0,
      postureAlert: params.postureAlert || null,
      timestamp: params.timestamp || performance.now(),
    };
  }
}

/**
 * Factory function to create an ExerciseAnalyzer instance.
 *
 * @param {string|object} [exercise='knee-flexion']
 * @param {object} [options]
 * @returns {ExerciseAnalyzer}
 */
export function createExerciseAnalyzer(exercise = 'knee-flexion', options = {}) {
  return new ExerciseAnalyzer(exercise, options);
}
