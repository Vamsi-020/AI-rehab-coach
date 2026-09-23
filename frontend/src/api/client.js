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

// ---------------------------------------------------------------------------
// Phase 16: Clinician Portal & Exercise Prescriptions
// ---------------------------------------------------------------------------

/**
 * Retrieve clinician dashboard summary metrics and assigned patient roster.
 * @returns {Promise<object>} ClinicianDashboardResponse
 */
export async function getClinicianDashboard() {
  return apiFetch('/therapist/dashboard');
}

/**
 * Retrieve the authenticated clinician's assigned patient roster.
 * @returns {Promise<object>} PatientRosterResponse
 */
export async function getClinicianPatientRoster() {
  return apiFetch('/therapist/patients');
}

/**
 * Prescribe a new rehabilitation exercise routine to an assigned patient.
 * @param {object} payload - AssignmentCreateRequest
 * @returns {Promise<object>} AssignmentResponse
 */
export async function createPrescription(payload) {
  return apiFetch('/assignments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Retrieve all exercise prescriptions assigned to a specific patient.
 * @param {string} patientId
 * @returns {Promise<object>} AssignmentListResponse
 */
export async function getPatientPrescriptions(patientId) {
  return apiFetch(`/assignments/patient/${encodeURIComponent(patientId)}`);
}

/**
 * Retrieve a single exercise prescription by ID.
 * @param {string} assignmentId
 * @returns {Promise<object>} AssignmentResponse
 */
export async function getPrescription(assignmentId) {
  return apiFetch(`/assignments/${encodeURIComponent(assignmentId)}`);
}

/**
 * Update parameters on an existing prescription.
 * @param {string} assignmentId
 * @param {object} payload - AssignmentUpdateRequest
 * @returns {Promise<object>} AssignmentResponse
 */
export async function updatePrescription(assignmentId, payload) {
  return apiFetch(`/assignments/${encodeURIComponent(assignmentId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Deactivate (mark completed) an exercise prescription.
 * @param {string} assignmentId
 * @returns {Promise<object>} AssignmentResponse
 */
export async function deactivatePrescription(assignmentId) {
  return apiFetch(`/assignments/${encodeURIComponent(assignmentId)}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Phase 17 — Patient Prescribed Routine
// ---------------------------------------------------------------------------

/**
 * Retrieve the authenticated patient's own active exercise prescriptions.
 * Scoped strictly to the JWT-authenticated user — no patient_id accepted from client.
 * @returns {Promise<object>} AssignmentListResponse { assignments: [], total: number }
 */
export async function getMyPrescriptions() {
  return apiFetch('/assignments/my-routine');
}

// ---------------------------------------------------------------------------
// Phase 17 — Patient Notifications
// ---------------------------------------------------------------------------

/**
 * Retrieve all notifications for the authenticated patient.
 * @returns {Promise<object>} NotificationListResponse { notifications: [], unread_count, total }
 */
export async function getNotifications() {
  return apiFetch('/notifications');
}

/**
 * Mark a specific notification as read.
 * @param {string} notificationId
 * @returns {Promise<object>} NotificationMarkReadResponse { id, is_read, message }
 */
export async function markNotificationRead(notificationId) {
  return apiFetch(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
  });
}
