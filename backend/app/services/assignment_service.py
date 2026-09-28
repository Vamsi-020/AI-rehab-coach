"""Exercise assignment and clinician management service layer (Phases 16–17).

Handles:
- Clinician dashboard metrics aggregation
- Assigned patient roster retrieval with kinematic telemetry
- Exercise prescription CRUD operations and clinical verification
- Clinician-patient data isolation and RBAC checks
- Patient self-service routine retrieval (Phase 17) — scoped to authenticated user
"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status

from backend.app.database.collections import Collections
from backend.app.database.connection import db_manager
from backend.app.models.exercise_assignment import AssignmentStatus
from backend.app.schemas.assignment import (
    AssignmentCreateRequest,
    AssignmentListResponse,
    AssignmentResponse,
    AssignmentUpdateRequest,
)
from backend.app.schemas.therapist import (
    ClinicianDashboardMetrics,
    ClinicianDashboardResponse,
    PatientRosterItem,
    PatientRosterResponse,
)


def _get_col(name: str):
    """Retrieve collection from db_manager or raise HTTP 503."""
    col = db_manager.get_collection(name)
    if col is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database collection '{name}' is currently unavailable.",
        )
    return col


async def _resolve_exercise_doc(exercise_id_or_slug: str) -> Dict[str, Any]:
    """Find an exercise in catalog by ObjectId or slug."""
    col = _get_col(Collections.EXERCISES)
    query = {"$or": [{"slug": exercise_id_or_slug}]}
    if ObjectId.is_valid(exercise_id_or_slug):
        query["$or"].append({"_id": ObjectId(exercise_id_or_slug)})

    doc = await col.find_one(query)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exercise '{exercise_id_or_slug}' not found in exercise catalog.",
        )
    return doc


def _assignment_doc_to_response(doc: Dict[str, Any], exercise_doc: Optional[Dict[str, Any]] = None) -> AssignmentResponse:
    """Format MongoDB assignment document into AssignmentResponse."""
    ex_name = doc.get("exercise_name")
    ex_slug = doc.get("exercise_slug")
    target_joint = doc.get("target_joint")

    if exercise_doc:
        ex_name = exercise_doc.get("name", ex_name)
        ex_slug = exercise_doc.get("slug", ex_slug)
        target_joint = exercise_doc.get("target_joint", target_joint)

    start_date_val = doc.get("start_date")
    if isinstance(start_date_val, (date, datetime)):
        start_date_str = start_date_val.isoformat()
    else:
        start_date_str = str(start_date_val) if start_date_val else None

    end_date_val = doc.get("end_date")
    if isinstance(end_date_val, (date, datetime)):
        end_date_str = end_date_val.isoformat()
    else:
        end_date_str = str(end_date_val) if end_date_val else None

    return AssignmentResponse(
        id=str(doc["_id"]),
        patient_id=str(doc["patient_id"]),
        therapist_id=str(doc["therapist_id"]),
        exercise_id=str(doc["exercise_id"]),
        exercise_name=ex_name,
        exercise_slug=ex_slug,
        target_joint=target_joint,
        prescribed_sets=int(doc.get("prescribed_sets", 3)),
        prescribed_reps=int(doc.get("prescribed_reps", 10)),
        frequency_per_week=int(doc.get("frequency_per_week", 5)),
        target_rom_degrees=doc.get("target_rom_degrees"),
        custom_instructions=doc.get("custom_instructions"),
        start_date=start_date_str,
        end_date=end_date_str,
        status=str(doc.get("status", "active")),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
    )


async def _verify_patient_belongs_to_therapist(therapist_user_id: str, patient_id_str: str) -> Dict[str, Any]:
    """Verify that patient exists and is assigned to the authenticated clinician.

    Supports patient_id as either patients._id or users._id.
    """
    patients_col = _get_col(Collections.PATIENTS)
    users_col = _get_col(Collections.USERS)

    query = {}
    if ObjectId.is_valid(patient_id_str):
        query = {"$or": [{"_id": ObjectId(patient_id_str)}, {"user_id": ObjectId(patient_id_str)}]}
    else:
        query = {"user_id": patient_id_str}

    patient_doc = await patients_col.find_one(query)

    user_query = {}
    if ObjectId.is_valid(patient_id_str):
        user_query = {"_id": ObjectId(patient_id_str)}
    user_doc = await users_col.find_one(user_query) if user_query else None

    if not patient_doc and not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient record '{patient_id_str}' not found.",
        )

    # Check clinician assignment if patient_doc has assigned_therapist_id
    if patient_doc and patient_doc.get("assigned_therapist_id"):
        assigned = str(patient_doc["assigned_therapist_id"])
        if assigned != therapist_user_id:
            therapists_col = _get_col(Collections.THERAPISTS)
            t_doc = await therapists_col.find_one({"user_id": ObjectId(therapist_user_id)}) if ObjectId.is_valid(therapist_user_id) else None
            t_id = str(t_doc["_id"]) if t_doc else None

            if assigned != t_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: This patient is not assigned to your clinical roster.",
                )

    return patient_doc or {"user_id": user_doc["_id"]}



# ---------------------------------------------------------------------------
# Clinician Dashboard & Roster Logic
# ---------------------------------------------------------------------------

async def get_clinician_patient_roster(therapist_user_id: str) -> List[PatientRosterItem]:
    """Retrieve all assigned patients with computed compliance and AI kinematic form metrics."""
    patients_col = _get_col(Collections.PATIENTS)
    users_col = _get_col(Collections.USERS)
    sessions_col = _get_col(Collections.REHABILITATION_SESSIONS)
    assignments_col = _get_col(Collections.EXERCISE_ASSIGNMENTS)
    therapists_col = _get_col(Collections.THERAPISTS)

    # Resolve therapist document ID if available
    t_doc = None
    if ObjectId.is_valid(therapist_user_id):
        t_doc = await therapists_col.find_one({"user_id": ObjectId(therapist_user_id)})
    t_id_objs = [ObjectId(therapist_user_id)] if ObjectId.is_valid(therapist_user_id) else []
    if t_doc:
        t_id_objs.append(t_doc["_id"])

    # Query assigned patients
    query = {"assigned_therapist_id": {"$in": t_id_objs + [therapist_user_id]}}
    cursor = patients_col.find(query)
    patient_docs = await cursor.to_list(length=200)

    roster_items: List[PatientRosterItem] = []

    for p_doc in patient_docs:
        p_user_id = p_doc.get("user_id")
        user_doc = await users_col.find_one({"_id": p_user_id}) if p_user_id else None

        name = user_doc.get("full_name") or user_doc.get("name") or "Patient" if user_doc else "Patient"
        email = user_doc.get("email") if user_doc else None

        # Fetch patient sessions
        sess_query = {"$or": [{"patient_id": str(p_user_id)}]}
        if ObjectId.is_valid(str(p_user_id)):
            sess_query["$or"].append({"patient_id": ObjectId(p_user_id)})
        sess_query["$or"].append({"patient_id": str(p_doc["_id"])})

        sess_cursor = sessions_col.find(sess_query).sort("created_at", -1)
        sessions = await sess_cursor.to_list(length=100)

        # Count active assignments
        asgn_query = {
            "$or": [
                {"patient_id": str(p_user_id)},
                {"patient_id": str(p_doc["_id"])},
            ],
            "status": "active",
        }
        if ObjectId.is_valid(str(p_user_id)):
            asgn_query["$or"].append({"patient_id": ObjectId(p_user_id)})
        active_asgn_count = await assignments_col.count_documents(asgn_query)

        # Compute accuracy and compliance
        if sessions:
            avg_acc = sum(float(s.get("average_form_accuracy_pct", 0)) for s in sessions) / len(sessions)
            avg_acc = round(avg_acc, 1)
            # Simple compliance based on recent activity (target ~12 sessions per month)
            comp_rate = min(100.0, round((len(sessions) / 12.0) * 100, 1))
        else:
            avg_acc = 0.0
            comp_rate = 0.0

        # Clinical status derivation
        if avg_acc > 0 and avg_acc < 75.0:
            status_text = "Needs Form Review"
            status_type = "warning"
        elif comp_rate >= 80.0 and avg_acc >= 85.0:
            if "discharge" in p_doc.get("protocol_stage", "").lower() or "week 6" in p_doc.get("protocol_stage", "").lower():
                status_text = "Near Discharge"
            else:
                status_text = "On Track"
            status_type = "success"
        elif sessions:
            status_text = "On Track"
            status_type = "success"
        else:
            status_text = "New Patient"
            status_type = "info"

        roster_items.append(
            PatientRosterItem(
                id=str(p_doc["_id"]),
                patient_id=str(p_doc["_id"]),
                user_id=str(p_user_id),
                name=name,
                email=email,
                condition=p_doc.get("injury_condition", "Rehabilitation Protocol"),
                stage=p_doc.get("protocol_stage", "Phase 1 Recovery"),
                affected_side=str(p_doc.get("affected_side", "right")),
                compliance=f"{int(comp_rate)}%",
                compliance_rate=comp_rate,
                accuracy=f"{int(avg_acc)}%" if avg_acc > 0 else "--",
                accuracy_score=avg_acc,
                status=status_text,
                statusType=status_type,
                recent_sessions_count=len(sessions),
                active_assignments_count=active_asgn_count,
            )
        )

    return roster_items


async def get_clinician_dashboard(therapist_user_id: str) -> ClinicianDashboardResponse:
    """Compute aggregate high-level metrics and return assigned patient roster."""
    roster = await get_clinician_patient_roster(therapist_user_id)

    total_patients = len(roster)
    if total_patients > 0:
        avg_comp = round(sum(p.compliance_rate for p in roster) / total_patients, 1)
        alerts_count = sum(1 for p in roster if p.statusType == "warning")
        weekly_review_hrs = round(total_patients * 0.8, 1)
    else:
        avg_comp = 0.0
        alerts_count = 0
        weekly_review_hrs = 0.0

    metrics = ClinicianDashboardMetrics(
        active_patients_count=total_patients,
        average_compliance_rate=avg_comp,
        kinematic_form_alerts_count=alerts_count,
        weekly_review_hours=weekly_review_hrs,
    )

    return ClinicianDashboardResponse(
        metrics=metrics,
        patients=roster,
        total_patients=total_patients,
    )


# ---------------------------------------------------------------------------
# Exercise Prescription CRUD Logic
# ---------------------------------------------------------------------------

async def create_prescription(therapist_user_id: str, payload: AssignmentCreateRequest) -> AssignmentResponse:
    """Prescribe a new exercise routine to an assigned patient."""
    # 1. Verify patient exists and is assigned
    await _verify_patient_belongs_to_therapist(therapist_user_id, payload.patient_id)

    # 2. Verify exercise exists in catalog
    exercise_doc = await _resolve_exercise_doc(payload.exercise_id)

    # 3. Create assignment record
    col = _get_col(Collections.EXERCISE_ASSIGNMENTS)
    now = datetime.utcnow()

    p_id_val = ObjectId(payload.patient_id) if ObjectId.is_valid(payload.patient_id) else payload.patient_id
    t_id_val = ObjectId(therapist_user_id) if ObjectId.is_valid(therapist_user_id) else therapist_user_id

    doc = {
        "patient_id": p_id_val,
        "therapist_id": t_id_val,
        "exercise_id": exercise_doc["_id"],
        "exercise_name": exercise_doc.get("name"),
        "exercise_slug": exercise_doc.get("slug"),
        "target_joint": exercise_doc.get("target_joint"),
        "prescribed_sets": payload.prescribed_sets,
        "prescribed_reps": payload.prescribed_reps,
        "frequency_per_week": payload.frequency_per_week,
        "target_rom_degrees": payload.target_rom_degrees,
        "custom_instructions": payload.custom_instructions,
        "start_date": payload.start_date.isoformat() if payload.start_date else date.today().isoformat(),
        "end_date": payload.end_date.isoformat() if payload.end_date else None,
        "status": AssignmentStatus.ACTIVE.value,
        "created_at": now,
        "updated_at": now,
    }

    result = await col.insert_one(doc)
    doc["_id"] = result.inserted_id

    return _assignment_doc_to_response(doc, exercise_doc)


async def get_prescriptions_for_patient(therapist_user_id: str, patient_id: str) -> List[AssignmentResponse]:
    """Retrieve all exercise prescriptions for a specific patient."""
    await _verify_patient_belongs_to_therapist(therapist_user_id, patient_id)

    col = _get_col(Collections.EXERCISE_ASSIGNMENTS)
    p_query = {"$or": [{"patient_id": patient_id}]}
    if ObjectId.is_valid(patient_id):
        p_query["$or"].append({"patient_id": ObjectId(patient_id)})

    cursor = col.find(p_query).sort("created_at", -1)
    docs = await cursor.to_list(length=100)

    # Collect exercises to populate details
    ex_col = _get_col(Collections.EXERCISES)
    ex_cache: Dict[str, Any] = {}

    responses: List[AssignmentResponse] = []
    for doc in docs:
        ex_id = str(doc.get("exercise_id"))
        if ex_id not in ex_cache and ObjectId.is_valid(ex_id):
            ex_cache[ex_id] = await ex_col.find_one({"_id": ObjectId(ex_id)})
        responses.append(_assignment_doc_to_response(doc, ex_cache.get(ex_id)))

    return responses


async def get_prescription_by_id(therapist_user_id: str, assignment_id: str) -> AssignmentResponse:
    """Retrieve a single assignment ensuring clinician authorization."""
    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment ID format.",
        )

    col = _get_col(Collections.EXERCISE_ASSIGNMENTS)
    doc = await col.find_one({"_id": ObjectId(assignment_id)})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exercise assignment not found.",
        )

    # Verify authorization
    t_id_str = str(doc.get("therapist_id"))
    if t_id_str != therapist_user_id:
        therapists_col = _get_col(Collections.THERAPISTS)
        t_doc = await therapists_col.find_one({"user_id": ObjectId(therapist_user_id)}) if ObjectId.is_valid(therapist_user_id) else None
        t_doc_id = str(t_doc["_id"]) if t_doc else None

        if t_id_str != t_doc_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You are not authorized to view this prescription.",
            )

    ex_col = _get_col(Collections.EXERCISES)
    ex_doc = await ex_col.find_one({"_id": doc["exercise_id"]}) if ObjectId.is_valid(str(doc.get("exercise_id"))) else None
    return _assignment_doc_to_response(doc, ex_doc)


async def update_prescription(
    therapist_user_id: str,
    assignment_id: str,
    payload: AssignmentUpdateRequest,
) -> AssignmentResponse:
    """Update fields of an existing prescription."""
    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment ID format.",
        )

    col = _get_col(Collections.EXERCISE_ASSIGNMENTS)
    doc = await col.find_one({"_id": ObjectId(assignment_id)})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exercise assignment not found.",
        )

    t_id_str = str(doc.get("therapist_id"))
    if t_id_str != therapist_user_id:
        therapists_col = _get_col(Collections.THERAPISTS)
        t_doc = await therapists_col.find_one({"user_id": ObjectId(therapist_user_id)}) if ObjectId.is_valid(therapist_user_id) else None
        t_doc_id = str(t_doc["_id"]) if t_doc else None

        if t_id_str != t_doc_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You cannot modify another clinician's prescription.",
            )


    update_fields: Dict[str, Any] = {"updated_at": datetime.utcnow()}
    if payload.prescribed_sets is not None:
        update_fields["prescribed_sets"] = payload.prescribed_sets
    if payload.prescribed_reps is not None:
        update_fields["prescribed_reps"] = payload.prescribed_reps
    if payload.frequency_per_week is not None:
        update_fields["frequency_per_week"] = payload.frequency_per_week
    if payload.target_rom_degrees is not None:
        update_fields["target_rom_degrees"] = payload.target_rom_degrees
    if payload.custom_instructions is not None:
        update_fields["custom_instructions"] = payload.custom_instructions
    if payload.status is not None:
        update_fields["status"] = payload.status.value

    await col.update_one({"_id": ObjectId(assignment_id)}, {"$set": update_fields})
    updated_doc = await col.find_one({"_id": ObjectId(assignment_id)})

    ex_col = _get_col(Collections.EXERCISES)
    ex_doc = await ex_col.find_one({"_id": updated_doc["exercise_id"]}) if ObjectId.is_valid(str(updated_doc.get("exercise_id"))) else None
    return _assignment_doc_to_response(updated_doc, ex_doc)


async def deactivate_prescription(therapist_user_id: str, assignment_id: str) -> AssignmentResponse:
    """Deactivate (pause or mark completed) an existing exercise prescription."""
    return await update_prescription(
        therapist_user_id=therapist_user_id,
        assignment_id=assignment_id,
        payload=AssignmentUpdateRequest(status=AssignmentStatus.COMPLETED),
    )


# ---------------------------------------------------------------------------
# Phase 17 — Patient Self-Service Routine Retrieval
# ---------------------------------------------------------------------------

async def get_my_active_routine(patient_user_id: str) -> List[AssignmentResponse]:
    """Return all active exercise prescriptions for the authenticated patient.

    This function is patient-only and is scoped exclusively to the JWT-authenticated
    user's ID. No client-supplied patient_id is accepted — data isolation is enforced
    at the service layer.

    Args:
        patient_user_id: The authenticated patient's user ID, extracted from the JWT.

    Returns:
        List of AssignmentResponse objects for each active prescription.
    """
    col = _get_col(Collections.EXERCISE_ASSIGNMENTS)
    ex_col = _get_col(Collections.EXERCISES)
    patients_col = _get_col(Collections.PATIENTS)

    # Build a broad query to match patient_id stored as ObjectId or string
    # Supports both authenticated users._id and patient profile patients._id
    id_variants: list = [patient_user_id]
    if ObjectId.is_valid(patient_user_id):
        id_variants.append(ObjectId(patient_user_id))

    # Resolve patient profile from patients collection using authenticated user_id
    p_filter = [{"user_id": patient_user_id}]
    if ObjectId.is_valid(patient_user_id):
        p_filter.append({"user_id": ObjectId(patient_user_id)})
    patient_doc = await patients_col.find_one({"$or": p_filter})
    if patient_doc and "_id" in patient_doc:
        p_doc_id = patient_doc["_id"]
        if p_doc_id not in id_variants:
            id_variants.append(p_doc_id)
        p_doc_id_str = str(p_doc_id)
        if p_doc_id_str not in id_variants:
            id_variants.append(p_doc_id_str)

    query = {
        "patient_id": {"$in": id_variants},
        "status": AssignmentStatus.ACTIVE.value,
    }

    cursor = col.find(query).sort("created_at", -1)
    docs = await cursor.to_list(length=100)

    ex_cache: Dict[str, Any] = {}
    responses: List[AssignmentResponse] = []

    for doc in docs:
        ex_id = str(doc.get("exercise_id", ""))
        if ex_id not in ex_cache and ObjectId.is_valid(ex_id):
            ex_cache[ex_id] = await ex_col.find_one({"_id": ObjectId(ex_id)})
        responses.append(_assignment_doc_to_response(doc, ex_cache.get(ex_id)))

    return responses

