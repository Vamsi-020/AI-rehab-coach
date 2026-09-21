/**
 * API client for the AI Rehabilitation Coach backend.
 *
 * All functions return parsed JSON or throw an Error with a user-friendly
 * message extracted from the server's response body.
 */

const BASE_URL = 'http://127.0.0.1:8000/api/v1';

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Sends an HTTP request to the backend, automatically attaching the JWT
 * from localStorage as a Bearer token when available.
 *
 * @param {string} path   - Endpoint path relative to BASE_URL (e.g. '/auth/login')
 * @param {RequestInit} options - Fetch options (method, body, headers, …)
 * @returns {Promise<any>} Parsed JSON response body
 * @throws {Error} with a descriptive message on non-2xx responses
 */
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('rehab_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Parse body regardless of status — the server always returns JSON
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    // FastAPI returns { "detail": "..." } for errors
    const message =
      (body && (body.detail || body.message)) ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Authenticate with email + password and receive a JWT token.
 * @returns {{ access_token: string, token_type: string, user: object }}
 */
export async function login(email, password) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Register a new user account.
 * @returns {{ message: string, user: object }}
 */
export async function register(full_name, email, password, role = 'patient') {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ full_name, email, password, role }),
  });
}

/**
 * Fetch the profile of the currently authenticated user.
 * @returns {object} UserResponse
 */
export async function getMe() {
  return apiFetch('/auth/me');
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

/**
 * List active exercises, optionally filtered by category key.
 * @param {string|null} category - e.g. 'knee', 'shoulder', 'spine'
 * @returns {{ exercises: object[], total: number, category: string|null }}
 */
export async function getExercises(category = null) {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiFetch(`/exercises${query}`);
}

/**
 * Fetch a single exercise by its URL slug.
 * @param {string} slug
 * @returns {object} ExerciseResponse
 */
export async function getExerciseBySlug(slug) {
  return apiFetch(`/exercises/${encodeURIComponent(slug)}`);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * Log a completed rehabilitation session.
 * @param {{ exercise_id, exercise_name, sets_completed, reps_completed,
 *            average_form_accuracy_pct, peak_angle_degrees?, notes? }} payload
 * @returns {object} SessionResponse
 */
export async function logSession(payload) {
  return apiFetch('/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Retrieve the current patient's session history.
 * @returns {object[]} Array of SessionResponse
 */
export async function getMySessions() {
  return apiFetch('/sessions/me');
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/**
 * Retrieve the current patient's aggregated recovery progress summary.
 * (Phase 14 — preserved for backwards compatibility)
 * @returns {object} ProgressSummaryResponse
 */
export async function getMyProgress() {
  return apiFetch('/progress/me');
}

/**
 * Retrieve the full analytics summary including trend data and exercise breakdown.
 * (Phase 15)
 * @returns {object} DetailedProgressResponse
 */
export async function getMyAnalytics() {
  return apiFetch('/progress/analytics');
}

/**
 * Retrieve paginated session history with optional exercise filter.
 * (Phase 15)
 * @param {{ page?: number, pageSize?: number, exercise?: string }} opts
 * @returns {object} SessionHistoryResponse
 */
export async function getMyHistory({ page = 1, pageSize = 20, exercise = null } = {}) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (exercise) params.set('exercise', exercise);
  return apiFetch(`/progress/history?${params.toString()}`);
}

/**
 * Retrieve per-exercise performance breakdown.
 * (Phase 15)
 * @param {string|null} exercise - Optional exercise name filter
 * @returns {object[]} ExerciseAnalyticsSummary[]
 */
export async function getMyExerciseProgress(exercise = null) {
  const query = exercise ? `?exercise=${encodeURIComponent(exercise)}` : '';
  return apiFetch(`/progress/exercises${query}`);
}
