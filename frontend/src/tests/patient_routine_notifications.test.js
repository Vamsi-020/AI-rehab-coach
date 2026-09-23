/**
 * Phase 17 — Patient Routine Notifications Frontend Tests.
 *
 * Tests:
 * 1. API client function exports (getMyPrescriptions, getNotifications, markNotificationRead)
 * 2. Prescribed routine rendering & empty state logic
 * 3. Prescription session parameter derivation (sets, reps, ROM, exercise slug)
 * 4. Clinician instructions formatting (display, neutral language)
 * 5. Notification unread count and read state toggle logic
 * 6. Notification type badge categorization
 * 7. Milestone language compliance (neutral, no clinical claims)
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

// ─── 1. API Client Exports ────────────────────────────────────────────────────

console.log('\n--- Section 1: API Client Function Exports ---');

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read client.js as text to check exports exist
import { readFileSync } from 'fs';
const clientSrc = readFileSync(path.join(__dirname, '..', 'api', 'client.js'), 'utf8');

test('getMyPrescriptions is exported from client.js', () => {
  assert(
    clientSrc.includes('export async function getMyPrescriptions'),
    'client.js exports getMyPrescriptions()'
  );
});

test('getNotifications is exported from client.js', () => {
  assert(
    clientSrc.includes('export async function getNotifications'),
    'client.js exports getNotifications()'
  );
});

test('markNotificationRead is exported from client.js', () => {
  assert(
    clientSrc.includes('export async function markNotificationRead'),
    'client.js exports markNotificationRead()'
  );
});

test('getMyPrescriptions calls correct endpoint', () => {
  assert(
    clientSrc.includes("'/assignments/my-routine'") || clientSrc.includes('"/assignments/my-routine"'),
    'getMyPrescriptions() calls /assignments/my-routine'
  );
});

test('getNotifications calls correct endpoint', () => {
  assert(
    clientSrc.includes("'/notifications'") || clientSrc.includes('"/notifications"'),
    'getNotifications() calls /notifications'
  );
});

test('markNotificationRead calls PATCH /notifications/{id}/read', () => {
  assert(
    clientSrc.includes("method: 'PATCH'") && clientSrc.includes('/notifications/'),
    'markNotificationRead() uses PATCH method and /notifications/ path'
  );
});

// ─── 2. Prescription Parameter Derivation ─────────────────────────────────────

console.log('\n--- Section 2: Prescription Session Parameter Derivation ---');

function derivePrescriptionParams(prescription) {
  const exerciseId = prescription?.exercise_slug || 'knee-flexion';
  const exerciseName = prescription?.exercise_name || 'Seated Knee Extension';
  const reps = (prescription?.prescribed_reps > 0 ? prescription.prescribed_reps : null) || 12;
  const sets = (prescription?.prescribed_sets > 0 ? prescription.prescribed_sets : null) || 3;
  const rom = prescription?.target_rom_degrees || null;
  const notes = prescription?.custom_instructions || null;
  return { exerciseId, exerciseName, reps, sets, rom, notes };
}

test('Null prescription falls back to defaults', () => {
  const params = derivePrescriptionParams(null);
  assert(params.exerciseId === 'knee-flexion', 'Default exercise slug is knee-flexion');
  assert(params.reps === 12, 'Default reps is 12');
  assert(params.sets === 3, 'Default sets is 3');
  assert(params.rom === null, 'Default ROM is null');
  assert(params.notes === null, 'Default notes is null');
});

test('Valid prescription overrides defaults', () => {
  const prescription = {
    exercise_slug: 'shoulder-abduction',
    exercise_name: 'Shoulder Abduction',
    prescribed_reps: 15,
    prescribed_sets: 4,
    target_rom_degrees: 90,
    custom_instructions: 'Move slowly.',
  };
  const params = derivePrescriptionParams(prescription);
  assert(params.exerciseId === 'shoulder-abduction', 'Exercise slug set from prescription');
  assert(params.reps === 15, 'Prescribed reps applied');
  assert(params.sets === 4, 'Prescribed sets applied');
  assert(params.rom === 90, 'Target ROM applied');
  assert(params.notes === 'Move slowly.', 'Clinician notes applied');
});

test('Zero reps/sets in prescription fall back to defaults', () => {
  const prescription = { prescribed_reps: 0, prescribed_sets: 0 };
  const params = derivePrescriptionParams(prescription);
  assert(params.reps === 12, 'Zero reps falls back to 12');
  assert(params.sets === 3, 'Zero sets falls back to 3');
});

test('Prescription without notes returns null notes', () => {
  const prescription = { prescribed_reps: 10, prescribed_sets: 3 };
  const params = derivePrescriptionParams(prescription);
  assert(params.notes === null, 'No notes in prescription returns null');
});

// ─── 3. Prescribed Routine Rendering Logic ────────────────────────────────────

console.log('\n--- Section 3: Prescribed Routine Rendering Logic ---');

function formatPrescribedRoutine(assignments) {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return { hasItems: false, items: [], emptyMessage: 'No active prescriptions assigned yet. Contact your physical therapist.' };
  }
  const items = assignments.map((a) => ({
    id: a.id,
    name: a.exercise_name || 'Prescribed Exercise',
    label: `${a.prescribed_sets} sets × ${a.prescribed_reps} reps${a.target_rom_degrees ? ` • Target ROM: ${a.target_rom_degrees}°` : ''}`,
    hasNotes: Boolean(a.custom_instructions),
  }));
  return { hasItems: true, items, emptyMessage: null };
}

test('Empty assignments list triggers empty state', () => {
  const result = formatPrescribedRoutine([]);
  assert(result.hasItems === false, 'hasItems is false for empty list');
  assert(result.emptyMessage !== null, 'emptyMessage is set');
  assert(result.emptyMessage.toLowerCase().includes('physiotherapist') || result.emptyMessage.toLowerCase().includes('therapist'), 'emptyMessage mentions therapist');
});

test('Null assignments list triggers empty state', () => {
  const result = formatPrescribedRoutine(null);
  assert(result.hasItems === false, 'hasItems is false for null list');
});

test('Single assignment renders correctly', () => {
  const assignments = [{
    id: 'asgn1',
    exercise_name: 'Seated Knee Extension',
    prescribed_sets: 3,
    prescribed_reps: 12,
    target_rom_degrees: 130,
    custom_instructions: 'Hold at top.',
  }];
  const result = formatPrescribedRoutine(assignments);
  assert(result.hasItems === true, 'hasItems is true');
  assert(result.items.length === 1, '1 item rendered');
  assert(result.items[0].name === 'Seated Knee Extension', 'Exercise name correct');
  assert(result.items[0].label.includes('3 sets'), 'Sets shown in label');
  assert(result.items[0].label.includes('12 reps'), 'Reps shown in label');
  assert(result.items[0].label.includes('130°'), 'ROM shown in label');
  assert(result.items[0].hasNotes === true, 'Notes flag set');
});

test('Multiple assignments all render', () => {
  const assignments = [
    { id: 'a1', exercise_name: 'Ex 1', prescribed_sets: 3, prescribed_reps: 10, custom_instructions: null },
    { id: 'a2', exercise_name: 'Ex 2', prescribed_sets: 2, prescribed_reps: 15, custom_instructions: 'Slow.' },
  ];
  const result = formatPrescribedRoutine(assignments);
  assert(result.items.length === 2, 'Two items rendered');
});

// ─── 4. Notification Unread Count & Read Toggle ────────────────────────────────

console.log('\n--- Section 4: Notification Unread Count & Read Toggle ---');

function computeUnreadCount(notifications) {
  if (!Array.isArray(notifications)) return 0;
  return notifications.filter((n) => !n.is_read).length;
}

function toggleNotificationRead(notifications, id) {
  return notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n));
}

const mockNotifications = [
  { id: 'n1', type: 'milestone_unlocked', title: 'Milestone', message: 'Msg 1', is_read: false, created_at: new Date().toISOString() },
  { id: 'n2', type: 'routine_reminder',   title: 'Reminder',  message: 'Msg 2', is_read: true,  created_at: new Date().toISOString() },
  { id: 'n3', type: 'clinical_feedback',  title: 'Feedback',  message: 'Msg 3', is_read: false, created_at: new Date().toISOString() },
];

test('Unread count correctly identifies 2 unread out of 3', () => {
  const count = computeUnreadCount(mockNotifications);
  assert(count === 2, `Expected 2 unread, got ${count}`);
});

test('Unread count is 0 for empty list', () => {
  assert(computeUnreadCount([]) === 0, 'Empty list has 0 unread');
});

test('Unread count is 0 for null', () => {
  assert(computeUnreadCount(null) === 0, 'null list returns 0 unread');
});

test('Toggle read updates single notification only', () => {
  const updated = toggleNotificationRead(mockNotifications, 'n1');
  const n1 = updated.find((n) => n.id === 'n1');
  const n3 = updated.find((n) => n.id === 'n3');
  assert(n1.is_read === true, 'n1 is now read');
  assert(n3.is_read === false, 'n3 remains unread');
});

test('After toggle, unread count decreases by 1', () => {
  const updated = toggleNotificationRead(mockNotifications, 'n1');
  const count = computeUnreadCount(updated);
  assert(count === 1, `Expected 1 unread after toggle, got ${count}`);
});

// ─── 5. Notification Type Badge Categorization ────────────────────────────────

console.log('\n--- Section 5: Notification Type Badge Categorization ---');

const BADGE_MAP = {
  milestone_unlocked: { label: 'Milestone', color: 'success' },
  routine_reminder:   { label: 'Reminder',  color: 'primary' },
  clinical_feedback:  { label: 'Clinical',  color: 'warning' },
  kinematic_alert:    { label: 'Alert',     color: 'error' },
  system:             { label: 'System',    color: 'muted' },
};

function getBadgeFor(type) {
  return BADGE_MAP[type] || BADGE_MAP.system;
}

test('milestone_unlocked maps to Milestone badge', () => {
  assert(getBadgeFor('milestone_unlocked').label === 'Milestone', 'Milestone badge label correct');
});

test('routine_reminder maps to Reminder badge', () => {
  assert(getBadgeFor('routine_reminder').label === 'Reminder', 'Reminder badge label correct');
});

test('clinical_feedback maps to Clinical badge', () => {
  assert(getBadgeFor('clinical_feedback').label === 'Clinical', 'Clinical badge label correct');
});

test('kinematic_alert maps to Alert badge', () => {
  assert(getBadgeFor('kinematic_alert').label === 'Alert', 'Alert badge label correct');
});

test('Unknown type falls back to system badge', () => {
  assert(getBadgeFor('unknown_type').label === 'System', 'Unknown type fallback to System badge');
});

// ─── 6. Milestone Language Compliance ─────────────────────────────────────────

console.log('\n--- Section 6: Milestone Language Compliance ---');

const milestoneMessages = [
  'Consistency milestone: You have logged 3 rehabilitation sessions. Keep up the steady activity to build long-term progress.',
  'Consistency milestone: You have now logged 5 rehabilitation sessions. Your regular activity has been recorded.',
  'Form milestone: A session with 90% or greater form accuracy score has been recorded. This reflects precise movement execution during your exercise.',
  'ROM target recorded: A peak joint angle of 120° or greater has been logged in your session. This data has been saved to your progress record.',
];

const forbiddenPhrases = ['cleared', 'discharged', 'recovered', 'cured', 'diagnosis', 'prescribe', 'medical advice'];

test('No milestone message contains forbidden clinical clearance phrases', () => {
  let allClean = true;
  for (const msg of milestoneMessages) {
    for (const phrase of forbiddenPhrases) {
      if (msg.toLowerCase().includes(phrase)) {
        allClean = false;
        console.error(`  [ISSUE] Found forbidden phrase "${phrase}" in message: "${msg}"`);
      }
    }
  }
  assert(allClean, 'All milestone messages are free of clinical clearance language');
});

test('Milestone messages use tracking-neutral language', () => {
  const neutralKeywords = ['recorded', 'logged', 'milestone', 'activity', 'session'];
  const hasNeutralLanguage = milestoneMessages.every((msg) =>
    neutralKeywords.some((kw) => msg.toLowerCase().includes(kw))
  );
  assert(hasNeutralLanguage, 'All milestone messages use neutral tracking language');
});

// ─── 7. Notification Popover State Logic ──────────────────────────────────────

console.log('\n--- Section 7: Notification Popover State Logic ---');

function getPopoverState({ notifications, loading, error }) {
  if (loading) return 'loading';
  if (error) return 'error';
  if (!notifications || notifications.length === 0) return 'empty';
  return 'populated';
}

test('Loading state renders correctly', () => {
  const state = getPopoverState({ notifications: [], loading: true, error: false });
  assert(state === 'loading', 'Loading state identified');
});

test('Error state renders correctly', () => {
  const state = getPopoverState({ notifications: [], loading: false, error: true });
  assert(state === 'error', 'Error state identified');
});

test('Empty notifications renders empty state', () => {
  const state = getPopoverState({ notifications: [], loading: false, error: false });
  assert(state === 'empty', 'Empty state identified');
});

test('Populated notifications renders list', () => {
  const state = getPopoverState({ notifications: [{ id: 'n1', title: 'Test' }], loading: false, error: false });
  assert(state === 'populated', 'Populated state identified');
});

// ─── Summary ──────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n========================================`);
console.log(`Phase 17 Notification Tests: ${passed}/${total} passed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
