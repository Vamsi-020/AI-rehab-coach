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
      preferredSide: options.preferredSide || options.selectedSide || 'auto',
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
    this.activeJointKey = null;
  }

  /**
   * Dynamically update preferred/selected side.
   *
   * @param {'left'|'right'|'auto'} side
   */
  setSelectedSide(side) {
    if (side === 'left' || side === 'right' || side === 'auto') {
      this.options.preferredSide = side;
      this.activeJointKey = null;
    }
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
    this.activeJointKey = null;
  }

  /**
   * Select the primary active joint based on preferred side, movement activity, and confidence.
   *
   * @param {Record<string, object>} angles
   * @returns {{ jointKey: string, angleObj: object | null }}
   */
  resolveActiveJoint(angles) {
    if (!angles) return { jointKey: '', angleObj: null };

    const { primaryJoints, defaultSide, startingPosition, movementDirection } = this.definition;
    const pref = this.options.preferredSide;

    // 1. If explicit side preferred ('left' or 'right')
    if (pref === 'left' || pref === 'right') {
      const match = primaryJoints.find((j) => j.toLowerCase().startsWith(pref));
      if (match && angles[match]?.isValid) {
        this.activeJointKey = match;
        return { jointKey: match, angleObj: angles[match] };
      }
    }

    // 2. If a repetition is currently active (MOVING, TARGET, RETURNING), lock to the active joint
    if (
      this.activeJointKey &&
      this.currentState !== MOVEMENT_STATES.START &&
      this.currentState !== MOVEMENT_STATES.IDLE &&
      angles[this.activeJointKey]?.isValid
    ) {
      return { jointKey: this.activeJointKey, angleObj: angles[this.activeJointKey] };
    }

    // 3. Dynamically choose the shoulder/joint that is actually moving
    const validCandidates = primaryJoints
      .map((k) => ({ key: k, angleObj: angles[k] }))
      .filter((c) => c.angleObj && c.angleObj.isValid);

    if (validCandidates.length === 1) {
      this.activeJointKey = validCandidates[0].key;
      return { jointKey: validCandidates[0].key, angleObj: validCandidates[0].angleObj };
    }

    if (validCandidates.length > 1) {
      const isDecreasing = movementDirection === 'decreasing';
      const startAngle = startingPosition?.angle ?? 25;
      const startTol = startingPosition?.tolerance ?? 15;

      const candidatesWithMovement = validCandidates.map((c) => {
        const ang = c.angleObj.angle;
        const displacement = isDecreasing ? startAngle - ang : ang - startAngle;
        const isMovedPastStart = isDecreasing
          ? ang < startAngle - startTol
          : ang > startAngle + startTol;
        return { ...c, displacement, isMovedPastStart };
      });

      // Prioritize candidate actively moving past the starting threshold
      const moving = candidatesWithMovement.filter((c) => c.isMovedPastStart);
      if (moving.length > 0) {
        moving.sort((a, b) => b.displacement - a.displacement);
        this.activeJointKey = moving[0].key;
        return { jointKey: moving[0].key, angleObj: moving[0].angleObj };
      }

      // Prioritize candidate with significantly larger movement displacement (> 8 degrees)
      candidatesWithMovement.sort((a, b) => b.displacement - a.displacement);
      if (candidatesWithMovement[0].displacement - candidatesWithMovement[1].displacement > 8) {
        this.activeJointKey = candidatesWithMovement[0].key;
        return { jointKey: candidatesWithMovement[0].key, angleObj: candidatesWithMovement[0].angleObj };
      }

      // If confidences differ significantly (> 0.15 difference), pick higher confidence
      const confA = candidatesWithMovement[0].angleObj.confidence;
      const confB = candidatesWithMovement[1].angleObj.confidence;
      if (Math.abs(confA - confB) > 0.15) {
        const higherConf = confA >= confB ? candidatesWithMovement[0] : candidatesWithMovement[1];
        this.activeJointKey = higherConf.key;
        return { jointKey: higherConf.key, angleObj: higherConf.angleObj };
      }

      // Maintain current active joint if previously selected
      if (this.activeJointKey && angles[this.activeJointKey]?.isValid) {
        return { jointKey: this.activeJointKey, angleObj: angles[this.activeJointKey] };
      }

      // Fallback to default side match
      const defaultMatch =
        validCandidates.find((c) => c.key.toLowerCase().startsWith(defaultSide)) ||
        validCandidates[0];
      this.activeJointKey = defaultMatch.key;
      return { jointKey: defaultMatch.key, angleObj: defaultMatch.angleObj };
    }

    // Fallback to default
    const defaultKey =
      primaryJoints.find((j) => j.toLowerCase().startsWith(defaultSide)) ||
      primaryJoints[0] ||
      '';
    return { jointKey: defaultKey, angleObj: angles[defaultKey] || null };
  }

  /**
   * Determine required landmarks based on active side.
   *
   * @param {'left'|'right'|null} [side]
   * @returns {string[]}
   */
  getRequiredLandmarks(side = null) {
    const def = this.definition;
    const targetSide = side || (this.options.preferredSide !== 'auto' ? this.options.preferredSide : null);

    if (def.sideRequiredLandmarks && targetSide && def.sideRequiredLandmarks[targetSide]) {
      return def.sideRequiredLandmarks[targetSide];
    }

    if (def.id?.includes('shoulder-abduction')) {
      if (targetSide === 'right') return ['rightShoulder', 'rightElbow'];
      if (targetSide === 'left') return ['leftShoulder', 'leftElbow'];
    }

    return def.requiredLandmarks || [];
  }

  /**
   * Check whether all required landmarks exist and meet confidence.
   *
   * @param {object} pose Processed pose frame
   * @returns {{ ok: boolean, missingCount: number, minConfidence: number, hasLowConfidence: boolean }}
   */
  verifyRequiredLandmarks(pose) {
    if (!pose || !pose.byName) {
      return { ok: false, missingCount: 999, minConfidence: 0, hasLowConfidence: false };
    }

    const { minConfidence } = this.definition;
    const threshold = this.options.minConfidence ?? minConfidence;
    const pref = this.options.preferredSide;
    const isShoulderAbduction = Boolean(this.definition.id?.includes('shoulder-abduction'));

    // For shoulder abduction when side is auto: either left or right arm should be valid
    if (isShoulderAbduction && (pref === 'auto' || !pref)) {
      const checkSide = (landmarks) => {
        let missing = 0;
        let lowest = 1.0;
        let hasLow = false;
        for (const name of landmarks) {
          const lm = pose.byName[name];
          if (
            !lm ||
            typeof lm.x !== 'number' ||
            Number.isNaN(lm.x) ||
            typeof lm.y !== 'number' ||
            Number.isNaN(lm.y)
          ) {
            missing++;
          } else {
            const vis = typeof lm.visibility === 'number' ? lm.visibility : (lm.isValid ? 1.0 : 0);
            lowest = Math.min(lowest, vis);
            if (vis < threshold) hasLow = true;
          }
        }
        return { ok: missing === 0 && !hasLow, missing, lowest, hasLow };
      };

      const leftCheck = checkSide(['leftShoulder', 'leftElbow']);
      const rightCheck = checkSide(['rightShoulder', 'rightElbow']);

      if (leftCheck.ok || rightCheck.ok) {
        const bestConf = Math.max(leftCheck.ok ? leftCheck.lowest : 0, rightCheck.ok ? rightCheck.lowest : 0);
        return { ok: true, missingCount: 0, minConfidence: bestConf, hasLowConfidence: false };
      }

      return {
        ok: false,
        missingCount: Math.min(leftCheck.missing, rightCheck.missing),
        minConfidence: Math.max(leftCheck.lowest, rightCheck.lowest),
        hasLowConfidence: true,
      };
    }

    // Explicit side preference or standard exercise: determine required landmarks for this side
    const requiredLandmarks = this.getRequiredLandmarks(pref === 'right' || pref === 'left' ? pref : null);
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
