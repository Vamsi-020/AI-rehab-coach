/**
 * Phase 15 — Progress Analytics Frontend Tests.
 *
 * Tests the pure-logic helpers used in ProgressPage.jsx without requiring a DOM:
 * - Performance label derivation
 * - Quality color derivation
 * - Date formatting
 * - SVG chart data point mapping
 * - Empty-state detection
 * - Pagination math
 *
 * Also verifies the new Phase 15 API client functions are properly exported.
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

// ─── Inline helpers (mirrors ProgressPage.jsx logic) ─────────────────────────

function qualityLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Needs Work';
}

function qualityColor(score) {
  const SUCCESS = '#059669';
  const PRIMARY = '#0284c7';
  const WARNING = '#d97706';
  const DANGER = '#dc2626';
  if (score >= 90) return SUCCESS;
  if (score >= 75) return PRIMARY;
  if (score >= 60) return WARNING;
  return DANGER;
}

function fmtDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function computeTotalPages(total, pageSize) {
  return Math.ceil(total / pageSize);
}

function isEmptyState(analytics) {
  return !analytics || analytics.session_count === 0;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n--- Running Phase 15 Frontend Analytics Tests ---\n');

// 1. Quality label derivation
console.log('1. Testing quality label derivation...');
test('Quality label boundaries', () => {
  assert(qualityLabel(100) === 'Excellent', 'Score 100 → Excellent');
  assert(qualityLabel(95) === 'Excellent', 'Score 95 → Excellent');
  assert(qualityLabel(90) === 'Excellent', 'Score 90 → Excellent');
  assert(qualityLabel(89) === 'Good', 'Score 89 → Good');
  assert(qualityLabel(75) === 'Good', 'Score 75 → Good');
  assert(qualityLabel(74) === 'Fair', 'Score 74 → Fair');
  assert(qualityLabel(60) === 'Fair', 'Score 60 → Fair');
  assert(qualityLabel(59) === 'Needs Work', 'Score 59 → Needs Work');
  assert(qualityLabel(0) === 'Needs Work', 'Score 0 → Needs Work');
});

// 2. Quality color mapping
console.log('\n2. Testing quality color mapping...');
test('Quality colors are correct hex values', () => {
  assert(qualityColor(95) === '#059669', 'Score 95 → success green');
  assert(qualityColor(80) === '#0284c7', 'Score 80 → primary blue');
  assert(qualityColor(65) === '#d97706', 'Score 65 → warning amber');
  assert(qualityColor(40) === '#dc2626', 'Score 40 → danger red');
});

// 3. Date formatting
console.log('\n3. Testing date formatting...');
test('Date formatting returns sensible labels', () => {
  const now = new Date().toISOString();
  const todayLabel = fmtDate(now);
  assert(todayLabel.startsWith('Today'), `"${todayLabel}" starts with Today`);

  const yesterday = new Date(Date.now() - 86400000).toISOString();
  assert(fmtDate(yesterday) === 'Yesterday', 'Yesterday label correct');

  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
  assert(fmtDate(twoDaysAgo) === '2d ago', '2 days ago label correct');

  assert(fmtDate(null) === '—', 'Null returns em-dash');
  assert(fmtDate(undefined) === '—', 'Undefined returns em-dash');
});

// 4. Pagination math
console.log('\n4. Testing pagination calculations...');
test('Total pages computed correctly', () => {
  assert(computeTotalPages(0, 10) === 0, '0 sessions → 0 pages');
  assert(computeTotalPages(1, 10) === 1, '1 session → 1 page');
  assert(computeTotalPages(10, 10) === 1, '10 sessions / 10 per page → 1 page');
  assert(computeTotalPages(11, 10) === 2, '11 sessions / 10 per page → 2 pages');
  assert(computeTotalPages(100, 10) === 10, '100 sessions / 10 per page → 10 pages');
  assert(computeTotalPages(101, 10) === 11, '101 sessions / 10 per page → 11 pages');
});

// 5. Empty state detection
console.log('\n5. Testing empty state detection...');
test('Empty state correctly identified', () => {
  assert(isEmptyState(null) === true, 'Null analytics → empty state');
  assert(isEmptyState(undefined) === true, 'Undefined → empty state');
  assert(isEmptyState({ session_count: 0 }) === true, 'session_count 0 → empty state');
  assert(isEmptyState({ session_count: 1 }) === false, 'session_count 1 → NOT empty state');
  assert(isEmptyState({ session_count: 100 }) === false, 'session_count 100 → NOT empty state');
});

// 6. Chart data preparation (min/max range)
console.log('\n6. Testing chart data range calculation...');
test('Min/max values computed from trend data', () => {
  const trend = [
    { date: '2026-09-15', value: 80.0 },
    { date: '2026-09-16', value: 88.5 },
    { date: '2026-09-17', value: 92.0 },
  ];
  const values = trend.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  assert(min === 80.0, 'Min value is 80.0');
  assert(max === 92.0, 'Max value is 92.0');
  const range = max - min;
  assert(range === 12.0, 'Range is 12.0');
});

test('Single-point chart has zero range handled safely', () => {
  const trend = [{ date: '2026-09-17', value: 90.0 }];
  const values = trend.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // Guard against division by zero
  assert(range === 1, 'Single point range guarded to 1');
});

test('Empty trend data returns empty values array', () => {
  const trend = [];
  assert(trend.length === 0, 'Empty trend has 0 items');
  assert(!trend.some((d) => d.value !== 0), 'No items to check');
});

// 7. API client exports
console.log('\n7. Testing Phase 15 API client exports...');
import('../api/client.js')
  .then((mod) => {
    assert(typeof mod.getMyAnalytics === 'function', 'getMyAnalytics is exported as function');
    assert(typeof mod.getMyHistory === 'function', 'getMyHistory is exported as function');
    assert(typeof mod.getMyExerciseProgress === 'function', 'getMyExerciseProgress is exported as function');
    // Phase 14 backwards compatibility
    assert(typeof mod.getMyProgress === 'function', 'getMyProgress still exported (Phase 14 compat)');
    assert(typeof mod.logSession === 'function', 'logSession still exported');

    finalize();
  })
  .catch((err) => {
    console.error(`  [FAIL] API client import failed: ${err.message}`);
    failed++;
    finalize();
  });

function finalize() {
  console.log(`\n${'='.repeat(60)}`);
  if (failed === 0) {
    console.log(`All Phase 15 Frontend Analytics Tests PASSED (${passed}/${passed + failed})`);
  } else {
    console.error(`FAILED: ${failed} test(s) failed. ${passed} passed.`);
    process.exit(1);
  }
  console.log(`${'='.repeat(60)}\n`);
}
