import React, { useState, useEffect } from 'react';
import {
  CloseIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  DumbbellIcon,
} from '../common/Icons';

import Button from '../common/Button';
import { createPrescription } from '../../api/client';

const PrescriptionModal = ({
  isOpen,
  onClose,
  patients = [],
  exercises = [],
  initialPatientId = null,
  onPrescriptionCreated,
}) => {
  const [patientId, setPatientId] = useState(initialPatientId || '');
  const [exerciseId, setExerciseId] = useState('');
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [frequency, setFrequency] = useState(5);
  const [targetRom, setTargetRom] = useState('');
  const [instructions, setInstructions] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPatientId(initialPatientId || (patients.length > 0 ? patients[0].id : ''));
      setExerciseId(exercises.length > 0 ? (exercises[0].slug || exercises[0].id) : '');
      setSets(3);
      setReps(10);
      setFrequency(5);
      setTargetRom('');
      setInstructions('');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, initialPatientId, patients, exercises]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!patientId) {
      setError('Please select a patient from your roster.');
      return;
    }
    if (!exerciseId) {
      setError('Please select a therapeutic exercise from the catalog.');
      return;
    }
    if (sets < 1 || sets > 20) {
      setError('Prescribed sets must be between 1 and 20.');
      return;
    }
    if (reps < 1 || reps > 100) {
      setError('Prescribed repetitions must be between 1 and 100.');
      return;
    }

    const payload = {
      patient_id: patientId,
      exercise_id: exerciseId,
      prescribed_sets: Number(sets),
      prescribed_reps: Number(reps),
      frequency_per_week: Number(frequency),
      target_rom_degrees: targetRom ? Number(targetRom) : null,
      custom_instructions: instructions.trim() || null,
    };

    setLoading(true);
    try {
      const res = await createPrescription(payload);
      setSuccess(true);
      if (onPrescriptionCreated) {
        onPrescriptionCreated(res);
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err?.message || 'Failed to prescribe routine. Please verify connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    }}>
      <div className="modal-container" style={{
        background: 'var(--bg-card, #ffffff)',
        borderRadius: 'var(--radius-lg, 12px)',
        border: '1px solid var(--border-color, #e2e8f0)',
        boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1))',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              backgroundColor: 'rgba(13, 148, 136, 0.1)',
              color: 'var(--primary-color, #0d9488)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <DumbbellIcon size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>
                Prescribe Exercise Routine
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                Assign evidence-based protocol to patient
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #64748b)',
              padding: '0.25rem',
              display: 'flex',
            }}
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--danger-color, #ef4444)',
              fontSize: '0.875rem',
            }}>
              <AlertCircleIcon size={18} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#059669',
              fontSize: '0.875rem',
            }}>
              <CheckCircleIcon size={18} />
              <span>Prescription assigned successfully!</span>
            </div>
          )}

          {/* Patient Selection */}
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>
              Target Patient <span style={{ color: 'var(--danger-color, #ef4444)' }}>*</span>
            </label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="form-control"
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--bg-main, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '0.9rem',
              }}
            >
              {patients.length === 0 ? (
                <option value="">No patients available in roster</option>
              ) : (
                patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.condition} ({p.stage})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Exercise Selection */}
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>
              Catalog Exercise <span style={{ color: 'var(--danger-color, #ef4444)' }}>*</span>
            </label>
            <select
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              className="form-control"
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--bg-main, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '0.9rem',
              }}
            >
              {exercises.length === 0 ? (
                <option value="knee-flexion">Knee Flexion Extension (Default)</option>
              ) : (
                exercises.map((ex) => (
                  <option key={ex.slug || ex.id} value={ex.slug || ex.id}>
                    {ex.name} ({ex.target_joint || 'Joint'} • {ex.difficulty || 'Moderate'})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Sets, Reps & Frequency Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.825rem', fontWeight: 500, color: 'var(--text-main)' }}>
                Sets / Session
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--bg-main, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.825rem', fontWeight: 500, color: 'var(--text-main)' }}>
                Reps / Set
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--bg-main, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.825rem', fontWeight: 500, color: 'var(--text-main)' }}>
                Days / Week
              </label>
              <input
                type="number"
                min="1"
                max="7"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--bg-main, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>

          {/* Target ROM */}
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>
              Target ROM Degrees <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional biomechanical goal)</span>
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="360"
              placeholder="e.g. 120.0"
              value={targetRom}
              onChange={(e) => setTargetRom(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--bg-main, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '0.9rem',
              }}
            />
          </div>

          {/* Clinical Instructions / Notes */}
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>
              Clinical Guidance Notes <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Patient instructions)</span>
            </label>
            <textarea
              rows="3"
              placeholder="e.g. Maintain smooth cadence, avoid lumbar hyperextension, stop immediately if pain exceeds 3/10."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--bg-main, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '0.875rem',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Modal Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            marginTop: '0.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color, #e2e8f0)',
          }}>
            <Button
              variant="outline"
              size="md"
              type="button"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              icon={DumbbellIcon}
              disabled={loading || success || patients.length === 0}
            >
              {loading ? 'Assigning Routine...' : 'Assign Routine'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PrescriptionModal;
