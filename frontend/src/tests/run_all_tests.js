/**
 * Test Runner for AI Rehabilitation Coach Frontend.
 * Runs all active phase test suites sequentially.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suites = [
  'pose_foundation.test.js',
  'landmark_processing.test.js',
  'joint_angle.test.js',
  'exercise_analyzer.test.js',
  'rep_counter.test.js',
  'movement_quality.test.js',
  'feedback_engine.test.js',
  'session_integration.test.js',
  'progress_analytics.test.js',
];

console.log(`\n========================================`);
console.log(`Running Frontend Test Suite (${suites.length} files)`);
console.log(`========================================\n`);

let passedSuites = 0;

for (const suite of suites) {
  const suitePath = path.join(__dirname, suite);
  try {
    execSync(`node "${suitePath}"`, { stdio: 'inherit' });
    passedSuites++;
  } catch (err) {
    console.error(`\nFAILED: ${suite}`);
    process.exit(1);
  }
}

console.log(`\n========================================`);
console.log(`SUCCESS: All ${passedSuites}/${suites.length} test suites passed!`);
console.log(`========================================\n`);
