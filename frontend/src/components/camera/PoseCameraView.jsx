import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  VideoCameraIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  PlayIcon,
  PauseIcon,
  SparklesIcon,
  RefreshIcon,
} from '../common/Icons';
import Button from '../common/Button';
import {
  CAMERA_STATUS,
  startCamera,
  stopCamera,
  isCameraSupported,
} from '../../services/cameraService';
import {
  getPoseLandmarker,
  detectPose,
  closePoseLandmarker,
} from '../../services/poseDetectionService';
import { drawPoseOverlay } from '../../utils/poseDrawing';
import { createPoseProcessor } from '../../services/landmarkProcessor';
import { createAngleEngine } from '../../services/jointAngleService';
import { createExerciseAnalyzer } from '../../services/exerciseAnalyzer';
import { createRepCounter } from '../../services/repCounter';
import { createMovementQualityAnalyzer } from '../../services/movementQualityAnalyzer';
import { createFeedbackEngine } from '../../services/feedbackEngine';

/**
 * PoseCameraView Component.
 *
 * Renders the webcam video feed and an overlaid Canvas with real-time
 * MediaPipe Pose skeleton and landmark tracking.
 *
 * Handles:
 * - Camera starting / active / permission_denied / unavailable / stopped states.
 * - Responsive desktop and mobile layout.
 * - Full cleanup on unmount.
 * - No video recording or backend frame streaming.
 */
const PoseCameraView = ({
  onPoseDetected,
  onStatusChange,
  isPaused = false,
  className = '',
  processorConfig = null,
  angleConfig = null,
  primaryJointKey = null,
  exerciseId = 'knee-flexion',
  repCounterConfig = null,
  qualityConfig = null,
  feedbackConfig = null,
  resetKey = 0,
  selectedSide = null,
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const processorRef = useRef(null);
  const angleEngineRef = useRef(null);
  const analyzerRef = useRef(null);
  const repCounterRef = useRef(null);
  const qualityAnalyzerRef = useRef(null);
  const feedbackEngineRef = useRef(null);

  // DEV DEBUG: diagnostic tracking refs & state
  const debugLastUpdateRef = useRef(0);
  const debugLastLoggedRef = useRef({ analyzerState: null, repCount: -1, repState: null });
  const [debugData, setDebugData] = useState(null);

  const [cameraStatus, setCameraStatus] = useState(CAMERA_STATUS.STARTING);
  const [errorMessage, setErrorMessage] = useState('');
  const [trackingScore, setTrackingScore] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [activeAngleData, setActiveAngleData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [repData, setRepData] = useState(null);
  const [qualityData, setQualityData] = useState(null);
  const [sessionQuality, setSessionQuality] = useState(null);
  const [feedbackData, setFeedbackData] = useState(null);

  // Initialize Landmark Processor
  useEffect(() => {
    processorRef.current = createPoseProcessor(processorConfig || {});
  }, [processorConfig]);

  // Initialize Joint Angle Engine
  useEffect(() => {
    angleEngineRef.current = createAngleEngine(angleConfig || {});
  }, [angleConfig]);

  // Initialize Exercise Analyzer
  useEffect(() => {
    analyzerRef.current = createExerciseAnalyzer(exerciseId, {
      preferredSide: selectedSide || 'auto',
    });
  }, [exerciseId, selectedSide]);

  // Dynamically update side on existing analyzer instance
  useEffect(() => {
    if (analyzerRef.current && selectedSide) {
      analyzerRef.current.setSelectedSide?.(selectedSide);
    }
  }, [selectedSide]);

  // Initialize Repetition Counter
  useEffect(() => {
    repCounterRef.current = createRepCounter(exerciseId, repCounterConfig || {});
    setRepData(null);
  }, [exerciseId, repCounterConfig]);

  // Initialize Movement Quality Analyzer
  useEffect(() => {
    qualityAnalyzerRef.current = createMovementQualityAnalyzer(exerciseId, qualityConfig || {});
    setQualityData(null);
    setSessionQuality(null);
  }, [exerciseId, qualityConfig]);

  // Initialize Real-Time Feedback Engine
  useEffect(() => {
    feedbackEngineRef.current = createFeedbackEngine(feedbackConfig || {});
    setFeedbackData(null);
  }, [feedbackConfig]);

  // Handle external reset triggers (e.g. session restart or reset button)
  useEffect(() => {
    if (resetKey > 0) {
      repCounterRef.current?.reset();
      qualityAnalyzerRef.current?.reset();
      feedbackEngineRef.current?.reset();
      setRepData(null);
      setQualityData(null);
      setSessionQuality(null);
      setFeedbackData(null);
    }
  }, [resetKey]);

  // Notify parent of status changes
  const updateStatus = useCallback(
    (status) => {
      setCameraStatus(status);
      if (onStatusChange) onStatusChange(status);
    },
    [onStatusChange]
  );

  // Initialize MediaPipe PoseLandmarker
  useEffect(() => {
    let isMounted = true;
    setModelLoading(true);

    getPoseLandmarker()
      .then((landmarker) => {
        if (isMounted) {
          landmarkerRef.current = landmarker;
          setModelLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          landmarkerRef.current = null;
          setModelLoading(false);
        }
      });

    return () => {
      isMounted = false;
      closePoseLandmarker();
    };
  }, []);

  // Frame processing loop
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    if (
      video.readyState >= 2 &&
      !video.paused &&
      !video.ended &&
      !isPaused
    ) {
      // Keep canvas display dimensions in sync with video
      if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
      ) {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
      }

      const ctx = canvas.getContext('2d');

      if (landmarkerRef.current && canvas.width > 0) {
        const timestamp = performance.now();
        const { landmarks, score } = detectPose(
          landmarkerRef.current,
          video,
          timestamp
        );

        if (landmarks && landmarks.length > 0) {
          const processedPose = processorRef.current
            ? processorRef.current.process(landmarks, timestamp)
            : null;
          const displayScore = processedPose ? processedPose.trackingQuality : score;

          // Calculate joint angles from processed pose
          let angles = null;
          if (processedPose && angleEngineRef.current) {
            angles = angleEngineRef.current.calculateAll(processedPose);

            // Select primary angle to display derived from active exercise definition
            const primaryJoints = analyzerRef.current?.definition?.primaryJoints || [];
            const defaultSideTarget = selectedSide === 'right'
              ? primaryJoints.find((j) => j.toLowerCase().startsWith('right'))
              : selectedSide === 'left'
              ? primaryJoints.find((j) => j.toLowerCase().startsWith('left'))
              : primaryJoints[0];
            const targetJoint = primaryJointKey || defaultSideTarget || primaryJoints[0] || 'leftShoulder';

            let active = angles[targetJoint];
            // If the designated primary joint is invalid, try the alternate side from primaryJoints
            if (!active?.isValid && primaryJoints.length > 0) {
              for (const jKey of primaryJoints) {
                if (angles[jKey]?.isValid) {
                  active = angles[jKey];
                  break;
                }
              }
            }
            if (!active?.isValid) {
              active = Object.values(angles).find((a) => a.isValid) || null;
            }
            setActiveAngleData(active?.isValid ? active : null);
          } else {
            setActiveAngleData(null);
          }

          // Evaluate exercise movement state
          let analysis = null;
          let repResult = null;
          let latestQ = qualityData;
          let currentSessionQ = sessionQuality;

          if (processedPose && angles && analyzerRef.current) {
            analysis = analyzerRef.current.analyze(processedPose, angles, timestamp);
            setAnalysisData(analysis);

            // Keep displayed angle synchronized with analyzer's resolved active joint
            if (analysis?.primaryJoint && angles[analysis.primaryJoint]?.isValid) {
              setActiveAngleData(angles[analysis.primaryJoint]);
            }

            // Record frame telemetry for movement quality analysis
            qualityAnalyzerRef.current?.recordFrame(analysis, angles, processedPose, timestamp);

            if (repCounterRef.current) {
              repResult = repCounterRef.current.process(analysis, timestamp);
              setRepData(repResult);

              // When a repetition completes, evaluate its movement quality
              if (repResult && repResult.rep_completed && qualityAnalyzerRef.current) {
                latestQ = qualityAnalyzerRef.current.evaluateRepetition(repResult);
                currentSessionQ = qualityAnalyzerRef.current.getSessionQuality();
                setQualityData(latestQ);
                setSessionQuality(currentSessionQ);
              }
            }
          } else {
            setAnalysisData(null);
          }

          // Evaluate real-time feedback
          let feedbackObj = null;
          if (feedbackEngineRef.current) {
            feedbackObj = feedbackEngineRef.current.evaluate({
              cameraStatus,
              pose: processedPose || { landmarks },
              angles,
              analysis,
              repData: repResult,
              qualityData: latestQ,
            }, timestamp);
            setFeedbackData(feedbackObj);
          }

          setIsTracking(true);
          setTrackingScore(displayScore);
          drawPoseOverlay(ctx, landmarks, canvas.width, canvas.height, true, 0.5);

          if (onPoseDetected) {
            onPoseDetected({
              landmarks,
              processedPose,
              angles,
              activeAngle: activeAngleData,
              analysis,
              repData: repResult,
              repCount: repResult?.rep_count ?? 0,
              qualityData: latestQ,
              sessionQuality: currentSessionQ,
              feedbackData: feedbackObj,
              score: displayScore,
              isTracking: true,
            });
          }

          // DEV DEBUG: Capture live shoulder abduction telemetry & log state transitions
          const currentSide = selectedSide || analyzerRef.current?.options?.preferredSide || 'auto';
          const currentJoint = analysis?.primaryJoint || analyzerRef.current?.activeJointKey || 'none';
          const lShoulderAng = angles?.leftShoulder?.angle;
          const rShoulderAng = angles?.rightShoulder?.angle;
          const actAngleVal = (currentJoint && angles?.[currentJoint]?.angle != null)
            ? angles[currentJoint].angle
            : (analyzerRef.current?.smoothedAngle != null
                ? Math.round(analyzerRef.current.smoothedAngle * 10) / 10
                : null);

          const curAnalyzerState = analysis?.state || analyzerRef.current?.currentState || 'N/A';
          const curRepState = repResult?.state || repCounterRef.current?.state || 'N/A';
          const curRepCount = repResult?.rep_count ?? repCounterRef.current?.repCount ?? 0;
          const curPrevRepState = repCounterRef.current?.previousState || 'N/A';
          const curReachedTarget = repCounterRef.current?.reachedTarget ?? false;
          const curRepStartTime = repCounterRef.current?.repStartTime;

          const lsConf = processedPose?.byName?.leftShoulder?.visibility;
          const leConf = processedPose?.byName?.leftElbow?.visibility;
          const lhConf = processedPose?.byName?.leftHip?.visibility;
          const rsConf = processedPose?.byName?.rightShoulder?.visibility;
          const reConf = processedPose?.byName?.rightElbow?.visibility;
          const rhConf = processedPose?.byName?.rightHip?.visibility;

          // Log state transitions and rep-count changes to console
          if (
            curAnalyzerState !== debugLastLoggedRef.current.analyzerState ||
            curRepState !== debugLastLoggedRef.current.repState ||
            curRepCount !== debugLastLoggedRef.current.repCount
          ) {
            debugLastLoggedRef.current = {
              analyzerState: curAnalyzerState,
              repState: curRepState,
              repCount: curRepCount,
            };
            console.log(
              `[REHAB DEBUG] ` +
              `side=${currentSide} ` +
              `joint=${currentJoint} ` +
              `angle=${actAngleVal != null ? actAngleVal + '°' : 'N/A'} ` +
              `state=${curAnalyzerState} ` +
              `repState=${curRepState} ` +
              `repCount=${curRepCount} ` +
              `leftShoulderConf=${lsConf != null ? (lsConf * 100).toFixed(1) + '%' : 'N/A'} ` +
              `leftElbowConf=${leConf != null ? (leConf * 100).toFixed(1) + '%' : 'N/A'} ` +
              `rightShoulderConf=${rsConf != null ? (rsConf * 100).toFixed(1) + '%' : 'N/A'} ` +
              `rightElbowConf=${reConf != null ? (reConf * 100).toFixed(1) + '%' : 'N/A'} ` +
              `leftHipConf=${lhConf != null ? (lhConf * 100).toFixed(1) + '%' : 'N/A'} ` +
              `rightHipConf=${rhConf != null ? (rhConf * 100).toFixed(1) + '%' : 'N/A'}`
            );
          }

          // Throttle overlay re-render to ~10fps or state changes
          if (timestamp - debugLastUpdateRef.current > 100 || curAnalyzerState !== debugData?.analyzerState) {
            debugLastUpdateRef.current = timestamp;
            setDebugData({
              activeSide: currentSide,
              activeJoint: currentJoint,
              leftShoulderAngle: lShoulderAng,
              rightShoulderAngle: rShoulderAng,
              activeAngle: actAngleVal,
              analyzerState: curAnalyzerState,
              analyzerProgress: analysis?.progress ?? 0,
              repState: curRepState,
              repCount: curRepCount,
              previousState: curPrevRepState,
              reachedTarget: curReachedTarget,
              repStartTime: curRepStartTime,
              leftShoulderConf: lsConf,
              leftElbowConf: leConf,
              leftHipConf: lhConf,
              rightShoulderConf: rsConf,
              rightElbowConf: reConf,
              rightHipConf: rhConf,
            });
          }
        } else {
          processorRef.current?.reset();
          analyzerRef.current?.reset();
          setActiveAngleData(null);
          setAnalysisData(null);
          setIsTracking(false);
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          let feedbackObj = null;
          if (feedbackEngineRef.current) {
            feedbackObj = feedbackEngineRef.current.evaluate({
              cameraStatus,
              pose: null,
              angles: null,
              analysis: null,
              repData,
              qualityData,
            }, performance.now());
            setFeedbackData(feedbackObj);
          }

          if (onPoseDetected) {
            onPoseDetected({
              landmarks: null,
              processedPose: null,
              angles: null,
              activeAngle: null,
              analysis: null,
              repData: repData,
              repCount: repData?.rep_count ?? 0,
              qualityData: qualityData,
              sessionQuality: sessionQuality,
              feedbackData: feedbackObj,
              score: 0,
              isTracking: false,
            });
          }
        }
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    animFrameIdRef.current = requestAnimationFrame(processFrame);
  }, [isPaused, onPoseDetected, primaryJointKey]);

  // Start Camera Stream
  const initCamera = useCallback(async () => {
    updateStatus(CAMERA_STATUS.STARTING);
    setErrorMessage('');

    if (!isCameraSupported()) {
      updateStatus(CAMERA_STATUS.UNAVAILABLE);
      setErrorMessage('Camera API is not supported in this browser or environment.');
      return;
    }

    const { stream, status, error } = await startCamera(videoRef.current);
    streamRef.current = stream;
    updateStatus(status);

    if (error) {
      if (status === CAMERA_STATUS.PERMISSION_DENIED) {
        setErrorMessage(
          'Camera permission was denied. Please allow camera access in your browser settings to track exercise movements.'
        );
      } else {
        setErrorMessage(
          'Camera is currently unavailable, disconnected, or being used by another application.'
        );
      }
    } else {
      // Start detection animation loop
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = requestAnimationFrame(processFrame);
    }
  }, [processFrame, updateStatus]);

  // Stop Camera Stream
  const handleStopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    stopCamera(streamRef.current, videoRef.current);
    streamRef.current = null;

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    processorRef.current?.reset();
    analyzerRef.current?.reset();
    repCounterRef.current?.reset();
    qualityAnalyzerRef.current?.reset();
    feedbackEngineRef.current?.reset();
    setActiveAngleData(null);
    setAnalysisData(null);
    setRepData(null);
    setQualityData(null);
    setSessionQuality(null);
    setFeedbackData(null);
    setIsTracking(false);
    updateStatus(CAMERA_STATUS.STOPPED);
  }, [updateStatus]);

  // Lifecycle: Auto-start on mount, cleanup on unmount
  useEffect(() => {
    initCamera();

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      stopCamera(streamRef.current, videoRef.current);
      streamRef.current = null;
    };
  }, [initCamera]);

  return (
    <div className={`pose-camera-wrapper ${className}`}>
      <div className="camera-preview-frame">
        {/* Real Video Element */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)', // Mirror for intuitive selfie camera
            display:
              cameraStatus === CAMERA_STATUS.ACTIVE ? 'block' : 'none',
          }}
        />

        {/* Skeleton Canvas Overlay */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            display:
              cameraStatus === CAMERA_STATUS.ACTIVE ? 'block' : 'none',
          }}
        />

        {/* Status HUD Pill Top Bar */}
        <div className="camera-pose-hud">
          {/* Status Indicator */}
          <div className="hud-pill">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background:
                  cameraStatus === CAMERA_STATUS.ACTIVE
                    ? '#22c55e'
                    : cameraStatus === CAMERA_STATUS.STARTING
                    ? '#eab308'
                    : '#ef4444',
                display: 'inline-block',
                boxShadow:
                  cameraStatus === CAMERA_STATUS.ACTIVE
                    ? '0 0 8px #22c55e'
                    : 'none',
              }}
            />
            <span>
              {cameraStatus === CAMERA_STATUS.ACTIVE
                ? 'Camera Active'
                : cameraStatus === CAMERA_STATUS.STARTING
                ? 'Camera Starting...'
                : cameraStatus === CAMERA_STATUS.PERMISSION_DENIED
                ? 'Camera Permission Denied'
                : cameraStatus === CAMERA_STATUS.STOPPED
                ? 'Camera Paused'
                : 'Camera Unavailable'}
            </span>
          </div>

          {/* AI Tracking Status Indicator */}
          {cameraStatus === CAMERA_STATUS.ACTIVE && (
            <div className="hud-pill">
              <SparklesIcon size={14} />
              <span>
                {modelLoading
                  ? 'Loading AI Model...'
                  : isTracking
                  ? `AI Tracking: ${trackingScore}%`
                  : 'Position Body in View'}
              </span>
            </div>
          )}

          {/* Live Rep Counter HUD */}
          {cameraStatus === CAMERA_STATUS.ACTIVE && isTracking && (
            <div
              className="hud-pill"
              style={{
                background: repData?.rep_completed ? 'rgba(34, 197, 94, 0.35)' : undefined,
                color: repData?.rep_completed ? '#4ade80' : undefined,
                fontWeight: 600,
              }}
            >
              <CheckCircleIcon size={14} />
              <span>Reps: {repData?.rep_count ?? 0}</span>
            </div>
          )}
        </div>

        {/* Live Joint Angle & Exercise Movement State Indicator Overlay */}
        {cameraStatus === CAMERA_STATUS.ACTIVE && isTracking && activeAngleData && activeAngleData.isValid && (
          <div className="camera-angle-indicator">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 2 }}>
              <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {activeAngleData.name}
              </span>
              {analysisData?.state && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background:
                      analysisData.state === 'TARGET'
                        ? 'rgba(34, 197, 94, 0.25)'
                        : analysisData.state === 'MOVING'
                        ? 'rgba(56, 189, 248, 0.25)'
                        : analysisData.state === 'RETURNING'
                        ? 'rgba(234, 179, 8, 0.25)'
                        : 'rgba(148, 163, 184, 0.25)',
                    color:
                      analysisData.state === 'TARGET'
                        ? '#4ade80'
                        : analysisData.state === 'MOVING'
                        ? '#38bdf8'
                        : analysisData.state === 'RETURNING'
                        ? '#fde047'
                        : '#cbd5e1',
                  }}
                >
                  {analysisData.state}
                </span>
              )}
            </div>
            <div className="angle-number">{activeAngleData.angle}°</div>
            {analysisData && analysisData.progressPct > 0 && (
              <div style={{ width: '100%', height: 4, background: 'rgba(255, 255, 255, 0.15)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${analysisData.progressPct}%`,
                    height: '100%',
                    background: analysisData.state === 'TARGET' ? '#22c55e' : '#38bdf8',
                    transition: 'width 0.15s ease',
                  }}
                />
              </div>
            )}
            {analysisData?.postureAlert && (
              <div style={{ fontSize: '0.7rem', color: '#f87171', marginTop: 4, fontWeight: 500 }}>
                {analysisData.postureAlert}
              </div>
            )}
          </div>
        )}

        {/* TEMPORARY DEV DEBUG OVERLAY — SHOULDER ABDUCTION */}
        {exerciseId?.includes('shoulder') && debugData && cameraStatus === CAMERA_STATUS.ACTIVE && (
          <div
            style={{
              position: 'absolute',
              top: 48,
              left: 12,
              zIndex: 35,
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#f8fafc',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '0.72rem',
              lineHeight: 1.45,
              maxWidth: '320px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              pointerEvents: 'none',
              textAlign: 'left',
            }}
          >
            <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.05em', marginBottom: 6, borderBottom: '1px solid rgba(56, 189, 248, 0.25)', paddingBottom: 4 }}>
              DEV DEBUG: LIVE SHOULDER ABDUCTION DEBUG
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 8, rowGap: 2 }}>
              <span style={{ color: '#94a3b8' }}>Active side:</span>
              <span style={{ fontWeight: 700, color: '#f8fafc' }}>{debugData.activeSide}</span>

              <span style={{ color: '#94a3b8' }}>Active joint:</span>
              <span style={{ fontWeight: 700, color: '#f8fafc' }}>{debugData.activeJoint}</span>

              <span style={{ color: '#94a3b8' }}>Left shoulder angle:</span>
              <span style={{ color: '#fbbf24' }}>{debugData.leftShoulderAngle != null ? `${debugData.leftShoulderAngle}°` : 'N/A'}</span>

              <span style={{ color: '#94a3b8' }}>Right shoulder angle:</span>
              <span style={{ color: '#fbbf24' }}>{debugData.rightShoulderAngle != null ? `${debugData.rightShoulderAngle}°` : 'N/A'}</span>

              <span style={{ color: '#94a3b8' }}>Active angle:</span>
              <span style={{ fontWeight: 800, color: '#4ade80', fontSize: '0.8rem' }}>{debugData.activeAngle != null ? `${debugData.activeAngle}°` : 'N/A'}</span>

              <div style={{ gridColumn: '1 / -1', height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

              <span style={{ color: '#94a3b8' }}>Analyzer state:</span>
              <span style={{ fontWeight: 800, color: debugData.analyzerState === 'TARGET' ? '#4ade80' : debugData.analyzerState === 'MOVING' ? '#38bdf8' : '#e2e8f0' }}>{debugData.analyzerState}</span>

              <span style={{ color: '#94a3b8' }}>Analyzer progress:</span>
              <span>{debugData.analyzerProgress}%</span>

              <div style={{ gridColumn: '1 / -1', height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

              <span style={{ color: '#94a3b8' }}>RepCounter state:</span>
              <span style={{ fontWeight: 800, color: debugData.repState === 'TARGET' ? '#4ade80' : debugData.repState === 'MOVING' ? '#38bdf8' : '#e2e8f0' }}>{debugData.repState}</span>

              <span style={{ color: '#94a3b8' }}>Rep count:</span>
              <span style={{ fontWeight: 800, color: '#4ade80', fontSize: '0.82rem' }}>{debugData.repCount}</span>

              <span style={{ color: '#94a3b8' }}>Previous state:</span>
              <span>{debugData.previousState}</span>

              <span style={{ color: '#94a3b8' }}>Reached target:</span>
              <span style={{ color: debugData.reachedTarget ? '#4ade80' : '#ef4444' }}>{String(debugData.reachedTarget)}</span>

              <span style={{ color: '#94a3b8' }}>Rep start time:</span>
              <span>{debugData.repStartTime ? `${Math.round(debugData.repStartTime)} ms` : 'none'}</span>

              <div style={{ gridColumn: '1 / -1', height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

              <span style={{ color: '#38bdf8', gridColumn: '1 / -1', fontWeight: 700 }}>Landmark confidence:</span>
              <span style={{ color: '#94a3b8', paddingLeft: 6 }}>Left shoulder:</span>
              <span>{debugData.leftShoulderConf != null ? `${(debugData.leftShoulderConf * 100).toFixed(1)}%` : 'N/A'}</span>

              <span style={{ color: '#94a3b8', paddingLeft: 6 }}>Left elbow:</span>
              <span>{debugData.leftElbowConf != null ? `${(debugData.leftElbowConf * 100).toFixed(1)}%` : 'N/A'}</span>

              <span style={{ color: '#94a3b8', paddingLeft: 6 }}>Left hip:</span>
              <span>{debugData.leftHipConf != null ? `${(debugData.leftHipConf * 100).toFixed(1)}%` : 'N/A'}</span>

              <span style={{ color: '#94a3b8', paddingLeft: 6 }}>Right shoulder:</span>
              <span>{debugData.rightShoulderConf != null ? `${(debugData.rightShoulderConf * 100).toFixed(1)}%` : 'N/A'}</span>

              <span style={{ color: '#94a3b8', paddingLeft: 6 }}>Right elbow:</span>
              <span>{debugData.rightElbowConf != null ? `${(debugData.rightElbowConf * 100).toFixed(1)}%` : 'N/A'}</span>

              <span style={{ color: '#94a3b8', paddingLeft: 6 }}>Right hip:</span>
              <span>{debugData.rightHipConf != null ? `${(debugData.rightHipConf * 100).toFixed(1)}%` : 'N/A'}</span>

              <div style={{ gridColumn: '1 / -1', height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

              <span style={{ color: '#94a3b8', gridColumn: '1 / -1', fontSize: '0.68rem' }}>
                Target zone: 75°+ • Start zone: &le;40° • Return zone: &le;45°
              </span>
            </div>
          </div>
        )}

        {/* State: Starting Camera */}
        {cameraStatus === CAMERA_STATUS.STARTING && (
          <div className="camera-skeleton-placeholder">
            <div
              style={{
                width: 48,
                height: 48,
                border: '3px solid rgba(56, 189, 248, 0.2)',
                borderTopColor: '#38bdf8',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <div style={{ fontSize: '0.92rem', color: '#e2e8f0', fontWeight: 600 }}>
              Starting Camera & AI Pose Tracking...
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Please allow camera permissions if prompted
            </div>
          </div>
        )}

        {/* State: Permission Denied */}
        {cameraStatus === CAMERA_STATUS.PERMISSION_DENIED && (
          <div className="camera-skeleton-placeholder" style={{ padding: '0 24px', textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircleIcon size={32} />
            </div>
            <div style={{ fontSize: '1.05rem', color: '#f87171', fontWeight: 700 }}>
              Camera Permission Denied
            </div>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', maxWidth: 360, margin: 0, lineHeight: 1.5 }}>
              {errorMessage}
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={RefreshIcon}
              onClick={initCamera}
              style={{ marginTop: 8 }}
            >
              Retry Camera Permission
            </Button>
          </div>
        )}

        {/* State: Unavailable */}
        {cameraStatus === CAMERA_STATUS.UNAVAILABLE && (
          <div className="camera-skeleton-placeholder" style={{ padding: '0 24px', textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(234, 179, 8, 0.15)',
                color: '#eab308',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <VideoCameraIcon size={32} />
            </div>
            <div style={{ fontSize: '1.05rem', color: '#fde047', fontWeight: 700 }}>
              Camera Unavailable
            </div>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', maxWidth: 360, margin: 0, lineHeight: 1.5 }}>
              {errorMessage}
            </p>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshIcon}
              onClick={initCamera}
              style={{ marginTop: 8 }}
            >
              Check Camera
            </Button>
          </div>
        )}

        {/* State: Stopped by User */}
        {cameraStatus === CAMERA_STATUS.STOPPED && (
          <div className="camera-skeleton-placeholder" style={{ textAlign: 'center' }}>
            <VideoCameraIcon size={36} style={{ color: '#94a3b8' }} />
            <div style={{ fontSize: '1rem', color: '#e2e8f0', fontWeight: 600 }}>
              Camera Feed Paused
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={PlayIcon}
              onClick={initCamera}
              style={{ marginTop: 8 }}
            >
              Start Camera
            </Button>
          </div>
        )}
      </div>

      {/* Camera Toggle Dock */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          marginTop: 10,
          fontSize: '0.84rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
          <VideoCameraIcon size={16} />
          <span>
            {cameraStatus === CAMERA_STATUS.ACTIVE
              ? 'Local Camera Stream • Privacy Protected'
              : 'Webcam offline'}
          </span>
        </div>

        {cameraStatus === CAMERA_STATUS.ACTIVE ? (
          <Button
            variant="ghost"
            size="sm"
            icon={PauseIcon}
            onClick={handleStopCamera}
          >
            Turn Camera Off
          </Button>
        ) : cameraStatus === CAMERA_STATUS.STOPPED ? (
          <Button
            variant="primary"
            size="sm"
            icon={PlayIcon}
            onClick={initCamera}
          >
            Turn Camera On
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default PoseCameraView;
