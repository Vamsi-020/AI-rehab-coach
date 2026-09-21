# AI Rehabilitation Coach

## 1. Project Purpose
The **AI Rehabilitation Coach** is an intelligent physiotherapy and physical rehabilitation platform. It is designed to assist patients recovering from injuries and individuals performing physical therapy exercises by tracking movement, analyzing posture, ensuring correct exercise form, and providing real-time feedback.

---

## 2. Current Technology Stack

### Backend
- **Language**: Python 3.10+ / 3.12+
- **Framework**: FastAPI (0.104.1+)
- **ASGI Server**: Uvicorn (0.52.4+)
- **Settings & Config**: Pydantic v2 & Pydantic-Settings
- **Environment Handling**: python-dotenv
- **Testing**: Pytest + HTTPX TestClient

### Frontend
- **Framework / UI**: React 19
- **Build Tool**: Vite 8
- **Linter**: Oxlint

---

## 3. Current Project Structure

```text
AI-Rehabilitation-Coach/
├── .gitignore
├── README.md
├── backend/
│   ├── .env
│   ├── .env.example
│   ├── app/
│   │   ├── __init__.py
│   │   ├── ai/
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── exceptions.py
│   │   │   └── logging.py
│   │   ├── database/
│   │   ├── factory.py
│   │   ├── models/
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── api_v1.py
│   │   │   └── health.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── common.py
│   │   │   └── health.py
│   │   ├── services/
│   │   └── utils/
│   ├── main.py
│   ├── requirements.txt
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_config.py
│   │   ├── test_cors.py
│   │   └── test_health.py
│   └── venv/
├── docs/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── src/
│   └── vite.config.js
├── scripts/
└── tests/
```

---

## 4. How to Activate the Python Virtual Environment on Windows

Open PowerShell or Command Prompt from the project root:

### PowerShell:
```powershell
.\backend\venv\Scripts\Activate.ps1
```

### Command Prompt (cmd):
```cmd
backend\venv\Scripts\activate.bat
```

> **Note**: If PowerShell shows an execution policy error, run:
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

---

## 5. How to Start the FastAPI Backend

1. Navigate to the `backend` directory:
   ```powershell
   cd backend
   ```
2. Activate the virtual environment (if not already active):
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
3. Start the FastAPI server with reload enabled:
   ```powershell
   uvicorn main:app --reload
   ```
   The server will start listening at `http://127.0.0.1:8000`.

---

## 6. How to Start the React Frontend

1. Navigate to the `frontend` directory:
   ```powershell
   cd frontend
   ```
2. Start the Vite development server:
   ```powershell
   npm run dev
   ```
   The frontend application will be accessible at `http://localhost:5173`.

---

## 7. Health Endpoints & API Docs

Verify that the backend is active by accessing either health endpoint:

- **Root Health Check**:
  - **Method**: `GET`
  - **URL**: `http://127.0.0.1:8000/api/health`
  - **Response**: `{"status": "ok", "message": "AI Rehabilitation Coach backend is running"}`

- **Versioned Health Check**:
  - **Method**: `GET`
  - **URL**: `http://127.0.0.1:8000/api/v1/health`
  - **Response**: `{"status": "ok", "message": "AI Rehabilitation Coach backend is running", "environment": "development", "version": "1.0.0"}`

- **Interactive API Documentation**:
  - Swagger UI: `http://127.0.0.1:8000/api/v1/docs`
  - ReDoc: `http://127.0.0.1:8000/api/v1/redoc`

---

- **Phase 1: Project Foundation** — COMPLETED
- **Phase 2: Frontend Foundation & Design** — COMPLETED
- **Phase 3: Backend Foundation & API Architecture** — COMPLETED
- **Phase 4: Full-Stack Feature Integration** — COMPLETED
  - Live authentication with JWT (`POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`).
  - Native bcrypt password hashing & secure token validation.
  - Live exercise catalog with MongoDB backing and category filtering (`GET /api/v1/exercises`, `GET /api/v1/exercises/{slug}`).
  - Rehabilitation session logging with form accuracy and angle records (`POST /api/v1/sessions`, `GET /api/v1/sessions/me`).
  - Dynamic patient recovery analytics aggregation (`GET /api/v1/progress/me`).
  - Idempotent exercise seed script (`python -m backend.app.scripts.seed_exercises`).
  - React `AuthContext` + API client integration across all pages with graceful offline fallback.
  - Comprehensive Pytest test suite (46 passed, 2 skipped, 0 failed).

---

## 9. Database Seeding & Testing

### Seeding Exercise Catalog (MongoDB):
```powershell
$env:PYTHONPATH="."
.\backend\venv\Scripts\python -m backend.app.scripts.seed_exercises
```

### Running Backend Pytest Suite:
```powershell
$env:PYTHONPATH="."
.\backend\venv\Scripts\pytest backend/tests/ -v
```

