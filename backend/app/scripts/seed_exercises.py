"""One-shot exercise seeder script.

Seeds the 6 exercises from the Phase 2 frontend into MongoDB.
Run from the backend/ directory with the venv active:

    python -m app.scripts.seed_exercises

Uses upsert-on-slug so it is safe to run multiple times (idempotent).
"""

import asyncio

from backend.app.database.connection import db_manager
from backend.app.database.collections import Collections

EXERCISES = [
    {
        "slug": "seated-knee-extension",
        "name": "Seated Knee Extension",
        "category": "Knee Rehab",
        "category_key": "knee",
        "description": "Isolate quadriceps and restore full terminal extension post-surgery or patellofemoral pain.",
        "target_joint": "knee",
        "difficulty": "gentle",
        "target_angle_min": 0.0,
        "target_angle_max": 175.0,
        "target_hold_seconds": 2.0,
        "default_sets": 3,
        "default_reps": 12,
        "technique_tips": [
            "Sit upright with back fully supported.",
            "Extend leg slowly through full range of motion.",
            "Hold at the top for 2 seconds before lowering.",
            "Do not lock knee hyperextension.",
        ],
        "is_active": True,
    },
    {
        "slug": "supine-straight-leg-raise",
        "name": "Supine Straight Leg Raise",
        "category": "Knee Rehab",
        "category_key": "knee",
        "description": "Strengthen anterior chain without placing compressive stress on the knee joint capsule.",
        "target_joint": "knee",
        "difficulty": "gentle",
        "target_angle_min": 0.0,
        "target_angle_max": 90.0,
        "target_hold_seconds": 2.0,
        "default_sets": 3,
        "default_reps": 10,
        "technique_tips": [
            "Lie flat with one knee bent, foot flat on floor.",
            "Tighten the quad of the straight leg before lifting.",
            "Raise leg to 45° and hold for 2 seconds.",
            "Lower slowly — resist gravity on the way down.",
        ],
        "is_active": True,
    },
    {
        "slug": "wall-slide-squat",
        "name": "Wall Slide Squat (45°)",
        "category": "Knee Rehab",
        "category_key": "knee",
        "description": "Build eccentric quad strength while supporting spinal alignment against the wall.",
        "target_joint": "knee",
        "difficulty": "moderate",
        "target_angle_min": 0.0,
        "target_angle_max": 90.0,
        "target_hold_seconds": 3.0,
        "default_sets": 3,
        "default_reps": 10,
        "technique_tips": [
            "Keep back flat against wall at all times.",
            "Slide down only to a 45° knee angle — not past 90°.",
            "Keep knees aligned over second toe.",
            "Push through heels on the way back up.",
        ],
        "is_active": True,
    },
    {
        "slug": "shoulder-abduction-scapular",
        "name": "Shoulder Abduction (Scapular Plane)",
        "category": "Shoulder & Neck",
        "category_key": "shoulder",
        "description": "Raise arms in the scapular plane (30° forward) to avoid subacromial impingement.",
        "target_joint": "shoulder",
        "difficulty": "gentle",
        "target_angle_min": 0.0,
        "target_angle_max": 120.0,
        "target_hold_seconds": 2.0,
        "default_sets": 3,
        "default_reps": 12,
        "technique_tips": [
            "Stand with arms at sides, thumbs pointing upward.",
            "Lift arms in a V-shape (30° forward of coronal plane).",
            "Stop at shoulder height if pain occurs.",
            "Lower slowly with control.",
        ],
        "is_active": True,
    },
    {
        "slug": "shoulder-external-rotation",
        "name": "Shoulder External Rotation",
        "category": "Shoulder & Neck",
        "category_key": "shoulder",
        "description": "Key rotator cuff stability exercise using gentle resistance or active range.",
        "target_joint": "shoulder",
        "difficulty": "moderate",
        "target_angle_min": 0.0,
        "target_angle_max": 60.0,
        "target_hold_seconds": 2.0,
        "default_sets": 3,
        "default_reps": 15,
        "technique_tips": [
            "Elbow bent at 90°, tucked close to side.",
            "Rotate forearm outward without shrugging shoulder.",
            "Use a resistance band or perform as active ROM.",
            "Stop if anterior shoulder pain occurs.",
        ],
        "is_active": True,
    },
    {
        "slug": "glute-bridge-pelvic-tilt",
        "name": "Glute Bridge & Pelvic Tilt",
        "category": "Spine & Core",
        "category_key": "spine",
        "description": "Restore pelvic stability and alleviate lower back stiffness through controlled glute recruitment.",
        "target_joint": "spine_lumbar",
        "difficulty": "moderate",
        "target_angle_min": 0.0,
        "target_angle_max": 45.0,
        "target_hold_seconds": 3.0,
        "default_sets": 3,
        "default_reps": 10,
        "technique_tips": [
            "Lie on back, knees bent, feet hip-width apart.",
            "Engage core and press lower back into the floor.",
            "Drive through heels to lift hips to a straight line.",
            "Squeeze glutes at the top — hold for 3 seconds.",
        ],
        "is_active": True,
    },
]


async def seed() -> None:
    """Connect to MongoDB and upsert all exercises."""
    print("Connecting to MongoDB...")
    await db_manager.connect()

    col = db_manager.get_collection(Collections.EXERCISES)
    if col is None:
        print("ERROR: Could not get exercises collection — is MongoDB running?")
        return

    inserted = 0
    updated = 0

    for ex in EXERCISES:
        slug = ex["slug"]
        result = await col.update_one(
            {"slug": slug},
            {"$set": ex},
            upsert=True,
        )
        if result.upserted_id:
            inserted += 1
            print(f"  [INSERT] {slug}")
        else:
            updated += 1
            print(f"  [UPDATE] {slug}")

    print(f"\nDone. {inserted} inserted, {updated} updated.")
    await db_manager.disconnect()


if __name__ == "__main__":
    asyncio.run(seed())
