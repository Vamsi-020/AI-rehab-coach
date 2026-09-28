"""Development patient/therapist linking script.

Creates a designated development test patient account and links it to
the development clinician ('clinician-dev@clinic.org').

Important:
- Targets ONLY 'patient-dev@clinic.org' (does NOT touch any real or existing user accounts).
- Idempotent: uses upsert on 'user_id' so running multiple times will not create duplicates.
- Never prints or exposes passwords or hashes.
- Conforms to existing PatientModel and TherapistModel domain structures.

Run from repository root:
    .\backend\venv\Scripts\python.exe -m backend.app.scripts.link_dev_patient
Or from backend/ directory:
    .\venv\Scripts\python.exe -m app.scripts.link_dev_patient
"""

import asyncio
from datetime import datetime
import json
from pathlib import Path
import secrets
import string
from bson import ObjectId

from backend.app.core.security import hash_password
from backend.app.database.collections import Collections
from backend.app.database.connection import db_manager
from backend.app.models.patient import AffectedSide
from backend.app.models.user import UserRole, UserStatus

CLINICIAN_EMAIL = "clinician-dev@clinic.org"
DEV_PATIENT_EMAIL = "patient-dev@clinic.org"
DEV_PATIENT_NAME = "Dev Test Patient"


async def setup_dev_patient_link() -> None:
    print("Connecting to database...")
    await db_manager.connect()

    users_col = db_manager.get_collection(Collections.USERS)
    patients_col = db_manager.get_collection(Collections.PATIENTS)
    therapists_col = db_manager.get_collection(Collections.THERAPISTS)

    if users_col is None or patients_col is None or therapists_col is None:
        print("ERROR: Database collections could not be accessed. Is MongoDB connected?")
        return

    # 1. Locate Development Clinician
    clinician_user = await users_col.find_one({"email": CLINICIAN_EMAIL})
    if not clinician_user:
        print(f"ERROR: Clinician user '{CLINICIAN_EMAIL}' not found in 'users' collection.")
        print("Please ensure the development clinician account has been registered first.")
        await db_manager.disconnect()
        return

    clinician_user_id = clinician_user["_id"]
    print(f"[OK] Located Clinician account: {CLINICIAN_EMAIL} (User ID: {clinician_user_id})")

    # 2. Upsert Therapist profile for Development Clinician in therapists collection
    now = datetime.utcnow()
    therapist_profile_doc = {
        "user_id": clinician_user_id,
        "license_number": "DEV-PT-00123",
        "specialty": "Orthopedic & Sports Physical Therapy (Dev)",
        "clinic_organization": "Dev Motion Rehabilitation Clinic",
        "contact_phone": "+1-555-0199",
        "is_accepting_patients": True,
        "updated_at": now,
    }
    await therapists_col.update_one(
        {"user_id": clinician_user_id},
        {
            "$set": therapist_profile_doc,
            "$setOnInsert": {
                "_id": ObjectId(),
                "created_at": now,
            },
        },
        upsert=True,
    )
    print(f"[OK] Ensured therapist profile exists in 'therapists' collection.")

    # 3. Locate or create Development Patient User
    patient_user = await users_col.find_one({"email": DEV_PATIENT_EMAIL})
    if not patient_user:
        # Generate secure random development password
        chars = string.ascii_letters + string.digits + "!@#$%^&*"
        dev_pwd = "Dev_" + "".join(secrets.choice(chars) for _ in range(16)) + "1!"
        pwd_hash = hash_password(dev_pwd)

        patient_user_id = ObjectId()
        new_patient_user = {
            "_id": patient_user_id,
            "email": DEV_PATIENT_EMAIL,
            "full_name": DEV_PATIENT_NAME,
            "name": DEV_PATIENT_NAME,
            "hashed_password": pwd_hash,
            "role": UserRole.PATIENT.value,
            "status": UserStatus.ACTIVE.value,
            "is_active": True,
            "avatar_url": None,
            "created_at": now,
            "updated_at": now,
        }
        await users_col.insert_one(new_patient_user)
        print(f"[INSERT] Created development patient user in 'users': {DEV_PATIENT_EMAIL}")

        # Save credentials locally without printing or exposing
        cred_path = Path("backend/credentials.json")
        if not cred_path.exists():
            cred_path = Path("credentials.json")
        try:
            creds = {}
            if cred_path.exists():
                with open(cred_path, "r") as f:
                    try:
                        creds = json.load(f)
                    except Exception:
                        creds = {}
            if "email" in creds and "dev_clinician" not in creds:
                creds = {
                    "dev_clinician": {
                        "email": creds.get("email"),
                        "role": creds.get("role"),
                        "password": creds.get("password"),
                        "note": creds.get("note", "Local development clinician credentials. Gitignored."),
                    }
                }
            creds["dev_patient"] = {
                "email": DEV_PATIENT_EMAIL,
                "role": "patient",
                "password": dev_pwd,
                "note": "Fictional development test patient account. Gitignored.",
            }
            with open(cred_path, "w") as f:
                json.dump(creds, f, indent=2)
            print(f"[OK] Saved dev patient credentials to gitignored '{cred_path}'.")
        except Exception as e:
            print(f"[WARN] Could not update local credentials file: {e}")
    else:
        patient_user_id = patient_user["_id"]
        print(f"[OK] Located existing development patient user: {DEV_PATIENT_EMAIL} (User ID: {patient_user_id})")

    # 4. Upsert Patient Profile linking patient to clinician
    patient_profile_data = {
        "user_id": patient_user_id,
        "assigned_therapist_id": clinician_user_id,
        "injury_condition": "ACL Reconstruction & Meniscal Repair (Dev Test)",
        "affected_side": AffectedSide.RIGHT.value,
        "protocol_stage": "Week 2 - Early Mobility Protocol",
        "baseline_rom_degrees": 85.0,
        "target_rom_degrees": 135.0,
        "medical_notes": "Development test patient record for validating clinician dashboard roster and routine prescription flows.",
        "updated_at": now,
    }

    patient_upsert_res = await patients_col.update_one(
        {"user_id": patient_user_id},
        {
            "$set": patient_profile_data,
            "$setOnInsert": {
                "_id": ObjectId(),
                "created_at": now,
            },
        },
        upsert=True,
    )

    if patient_upsert_res.upserted_id:
        print(f"[INSERT] Created patient profile in 'patients' linking '{DEV_PATIENT_EMAIL}' to '{CLINICIAN_EMAIL}'.")
    else:
        print(f"[UPDATE] Updated patient profile in 'patients' linking '{DEV_PATIENT_EMAIL}' to '{CLINICIAN_EMAIL}'.")

    print("\nSummary: Development patient and clinician link completed successfully.")
    print("The patient will now appear on the Clinician Dashboard active roster.")
    await db_manager.disconnect()


if __name__ == "__main__":
    asyncio.run(setup_dev_patient_link())
