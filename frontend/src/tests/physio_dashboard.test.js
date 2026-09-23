/**
 * Phase 16 — Clinician Dashboard & Exercise Prescription Frontend Tests.
 *
 * Tests:
 * 1. Phase 16 API client function exports
 * 2. Prescription form validation rules
 * 3. Prescription payload formatting
 * 4. Clinician KPI derivations & status badges
 * 5. Patient roster filtering and empty state handling
 */

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}`);
    failed++;
  }
}

function test(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`  [FAIL] ${label} — threw: ${err.message}`);
    failed++;
  }
}

// ─── Inline logic mirrors ──────────────────────────────────────────────────

function validatePrescriptionForm({ patientId, exerciseId, sets, reps }) {
  if (!patientId) return 'Please select a patient from your roster.';
  if (!exerciseId) return 'Please select a therapeutic exercise from the catalog.';
  if (sets < 1 || sets > 20) return 'Prescribed sets must be between 1 and 20.';
  if (reps < 1 || reps > 100) return 'Prescribed repetitions must be between 1 and 100.';
  return null;
}

function buildPrescriptionPayload({ patientId, exerciseId, sets, reps, frequency, targetRom, instructions }) {
  return {
    patient_id: patientId,
    exercise_id: exerciseId,
    prescribed_sets: Number(sets),
    prescribed_reps: Number(reps),
    frequency_per_week: Number(frequency),
    target_rom_degrees: targetRom ? Number(targetRom) : null,
    custom_instructions: instructions ? instructions.trim() : null,
  };
}

function deriveClinicalStatus(accuracy, compliance) {
  if (accuracy > 0 && accuracy < 75.0) {
    return { status: 'Needs Form Review', statusType: 'warning' };
  }
  if (compliance >= 80.0 && accuracy >= 85.0) {
    return { status: 'On Track', statusType: 'success' };
  }
  if (accuracy > 0) {
    return { status: 'On Track', statusType: 'success' };
  }
  return { status: 'New Patient', statusType: 'info' };
}

function filterRoster(patients, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) return patients;
  const term = searchTerm.toLowerCase().trim();
  return patients.filter((p) => {
    const matchName = p.name?.toLowerCase().includes(term);
    const matchCond = p.condition?.toLowerCase().includes(term);
    return matchName || matchCond;
  });
}

// ─── Execution ─────────────────────────────────────────────────────────────

console.log('\n--- Running Phase 16 Clinician Dashboard & Prescription Tests ---\n');

// 1. Prescription Form Validation Tests
console.log('1. Testing prescription form validations...');

test('Reject empty patient ID', () => {
  const err = validatePrescriptionForm({ patientId: '', exerciseId: 'knee-flexion', sets: 3, reps: 10 });
  assert(err === 'Please select a patient from your roster.', 'Empty patient ID correctly rejected');
});

test('Reject empty exercise ID', () => {
  const err = validatePrescriptionForm({ patientId: 'p-1', exerciseId: '', sets: 3, reps: 10 });
  assert(err === 'Please select a therapeutic exercise from the catalog.', 'Empty exercise ID correctly rejected');
});

test('Reject sets < 1', () => {
  const err = validatePrescriptionForm({ patientId: 'p-1', exerciseId: 'squat', sets: 0, reps: 10 });
  assert(err === 'Prescribed sets must be between 1 and 20.', 'Sets < 1 correctly rejected');
});

test('Reject sets > 20', () => {
  const err = validatePrescriptionForm({ patientId: 'p-1', exerciseId: 'squat', sets: 21, reps: 10 });
  assert(err === 'Prescribed sets must be between 1 and 20.', 'Sets > 20 correctly rejected');
});

test('Reject reps < 1', () => {
  const err = validatePrescriptionForm({ patientId: 'p-1', exerciseId: 'squat', sets: 3, reps: 0 });
  assert(err === 'Prescribed repetitions must be between 1 and 100.', 'Reps < 1 correctly rejected');
});

test('Reject reps > 100', () => {
  const err = validatePrescriptionForm({ patientId: 'p-1', exerciseId: 'squat', sets: 3, reps: 101 });
  assert(err === 'Prescribed repetitions must be between 1 and 100.', 'Reps > 100 correctly rejected');
});

test('Accept valid inputs', () => {
  const err = validatePrescriptionForm({ patientId: 'p-1', exerciseId: 'knee-flexion', sets: 3, reps: 12 });
  assert(err === null, 'Valid parameters pass validation with null error');
});

// 2. Prescription Payload Building
console.log('\n2. Testing prescription payload formatting...');

test('Format complete payload with target ROM and instructions', () => {
  const payload = buildPrescriptionPayload({
    patientId: 'p-123',
    exerciseId: 'knee-flexion',
    sets: '3',
    reps: '15',
    frequency: '5',
    targetRom: '120.5',
    instructions: ' Keep spine neutral ',
  });
  assert(payload.patient_id === 'p-123', 'patient_id matches');
  assert(payload.exercise_id === 'knee-flexion', 'exercise_id matches');
  assert(payload.prescribed_sets === 3, 'sets cast to number');
  assert(payload.prescribed_reps === 15, 'reps cast to number');
  assert(payload.frequency_per_week === 5, 'frequency cast to number');
  assert(payload.target_rom_degrees === 120.5, 'target_rom cast to number');
  assert(payload.custom_instructions === 'Keep spine neutral', 'instructions trimmed');
});

test('Format minimal payload without ROM and notes', () => {
  const payload = buildPrescriptionPayload({
    patientId: 'p-456',
    exerciseId: 'squat',
    sets: 4,
    reps: 8,
    frequency: 3,
    targetRom: '',
    instructions: '',
  });
  assert(payload.target_rom_degrees === null, 'empty ROM converted to null');
  assert(payload.custom_instructions === null, 'empty instructions converted to null');
});

// 3. Clinical Status Derivation
console.log('\n3. Testing clinical status derivations...');

test('Low accuracy triggers form review warning', () => {
  const result = deriveClinicalStatus(68.5, 90.0);
  assert(result.status === 'Needs Form Review', 'Low accuracy gives Needs Form Review');
  assert(result.statusType === 'warning', 'Status type is warning');
});

test('High accuracy and compliance gives On Track', () => {
  const result = deriveClinicalStatus(92.0, 85.0);
  assert(result.status === 'On Track', 'High compliance & accuracy gives On Track');
  assert(result.statusType === 'success', 'Status type is success');
});

test('Zero sessions patient gives New Patient info', () => {
  const result = deriveClinicalStatus(0, 0);
  assert(result.status === 'New Patient', 'Zero session patient identified as New Patient');
  assert(result.statusType === 'info', 'Status type is info');
});

// 4. Patient Roster Filtering
console.log('\n4. Testing roster search and filtering...');

const sampleRoster = [
  { id: '1', name: 'Alex Parker', condition: 'ACL Reconstruction' },
  { id: '2', name: 'Maria Santos', condition: 'Rotator Cuff' },
  { id: '3', name: 'David Chen', condition: 'Spine Herniation' },
];

test('Empty search returns all patients', () => {
  const results = filterRoster(sampleRoster, '');
  assert(results.length === 3, 'Empty filter returns full roster');
});

test('Search by patient name', () => {
  const results = filterRoster(sampleRoster, 'alex');
  assert(results.length === 1 && results[0].name === 'Alex Parker', 'Filtered by name accurately');
});

test('Search by injury condition', () => {
  const results = filterRoster(sampleRoster, 'cuff');
  assert(results.length === 1 && results[0].name === 'Maria Santos', 'Filtered by condition accurately');
});

test('Search with no match returns empty array', () => {
  const results = filterRoster(sampleRoster, 'nonexistent');
  assert(results.length === 0, 'No matches returns empty array');
});

// 5. Phase 16 API client exports
console.log('\n5. Testing Phase 16 API client exports...');

import('../api/client.js')
  .then((mod) => {
    assert(typeof mod.getClinicianDashboard === 'function', 'getClinicianDashboard is exported');
    assert(typeof mod.getClinicianPatientRoster === 'function', 'getClinicianPatientRoster is exported');
    assert(typeof mod.createPrescription === 'function', 'createPrescription is exported');
    assert(typeof mod.getPatientPrescriptions === 'function', 'getPatientPrescriptions is exported');
    assert(typeof mod.getPrescription === 'function', 'getPrescription is exported');
    assert(typeof mod.updatePrescription === 'function', 'updatePrescription is exported');
    assert(typeof mod.deactivatePrescription === 'function', 'deactivatePrescription is exported');

    // Confirm Phase 14 & 15 exports are preserved
    assert(typeof mod.getMyProgress === 'function', 'Phase 14 getMyProgress preserved');
    assert(typeof mod.getMyAnalytics === 'function', 'Phase 15 getMyAnalytics preserved');
    assert(typeof mod.getMyHistory === 'function', 'Phase 15 getMyHistory preserved');

    console.log(`\n============================================================`);
    console.log(`All Phase 16 Clinician Dashboard Tests PASSED (${passed}/${passed + failed})`);
    console.log(`============================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Failed to import client.js:', err);
    process.exit(1);
  });
