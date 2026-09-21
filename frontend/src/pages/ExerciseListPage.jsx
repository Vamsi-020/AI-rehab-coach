import React, { useEffect, useState } from 'react';
import PageHeader from '../components/common/PageHeader';
import NavigationTabs from '../components/common/NavigationTabs';
import ExerciseCard from '../components/exercise/ExerciseCard';
import Sidebar from '../components/common/Sidebar';
import { getExercises } from '../api/client';

// Category tab definitions (counts come from live data)
const CATEGORY_DEFS = [
  { id: 'all', label: 'All Exercises' },
  { id: 'knee', label: 'Knee Rehab' },
  { id: 'shoulder', label: 'Shoulder & Neck' },
  { id: 'spine', label: 'Spine & Core' },
];

// Fallback exercises when the backend isn't available
const FALLBACK_EXERCISES = [
  {
    id: 'knee-ext', slug: 'seated-knee-extension',
    title: 'Seated Knee Extension', category: 'Knee Rehab', category_key: 'knee',
    difficulty: 'Gentle', targetReps: '12 Reps', targetSets: '3 Sets',
    targetJoint: 'Knee Quad Focus',
    description: 'Isolate quadriceps and restore full terminal extension post-surgery or patellofemoral pain.',
  },
  {
    id: 'leg-raise', slug: 'supine-straight-leg-raise',
    title: 'Supine Straight Leg Raise', category: 'Knee Rehab', category_key: 'knee',
    difficulty: 'Gentle', targetReps: '10 Reps', targetSets: '3 Sets',
    targetJoint: 'Hip Flexor & Quad',
    description: 'Strengthen anterior chain without placing compressive stress on the knee joint capsule.',
  },
  {
    id: 'wall-squat', slug: 'wall-slide-squat',
    title: 'Wall Slide Squat (45°)', category: 'Knee Rehab', category_key: 'knee',
    difficulty: 'Moderate', targetReps: '8-10 Reps', targetSets: '3 Sets',
    targetJoint: 'Glutes & Quads',
    description: 'Build eccentric quad strength while supporting spinal alignment against the wall.',
  },
  {
    id: 'shoulder-abd', slug: 'shoulder-abduction-scapular',
    title: 'Shoulder Abduction (Scapular Plane)', category: 'Shoulder & Neck', category_key: 'shoulder',
    difficulty: 'Gentle', targetReps: '12 Reps', targetSets: '3 Sets',
    targetJoint: 'Deltoid & Supraspinatus',
    description: 'Raise arms in the scapular plane (30° forward) to avoid subacromial impingement.',
  },
  {
    id: 'external-rot', slug: 'shoulder-external-rotation',
    title: 'Shoulder External Rotation', category: 'Shoulder & Neck', category_key: 'shoulder',
    difficulty: 'Moderate', targetReps: '15 Reps', targetSets: '3 Sets',
    targetJoint: 'Infraspinatus & Teres Minor',
    description: 'Key rotator cuff stability exercise using gentle resistance or active range.',
  },
  {
    id: 'bridge', slug: 'glute-bridge-pelvic-tilt',
    title: 'Glute Bridge & Pelvic Tilt', category: 'Spine & Core', category_key: 'spine',
    difficulty: 'Moderate', targetReps: '10 Reps', targetSets: '3 Sets',
    targetJoint: 'Lumbar & Gluteal Chain',
    description: 'Restore pelvic stability and alleviate lower back stiffness through controlled glute recruitment.',
  },
];

/** Map a raw API exercise document to the shape ExerciseCard expects */
function mapApiExercise(ex) {
  return {
    id: ex.id ?? ex.slug,
    slug: ex.slug,
    title: ex.name,
    category: ex.category,
    category_key: ex.category?.toLowerCase().split(' ')[0] ?? '',
    difficulty: ex.difficulty.charAt(0).toUpperCase() + ex.difficulty.slice(1),
    targetReps: `${ex.default_reps} Reps`,
    targetSets: `${ex.default_sets} Sets`,
    targetJoint: ex.target_joint,
    description: ex.description,
  };
}

const ExerciseListPage = ({ onNavigate }) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [exercises, setExercises] = useState(FALLBACK_EXERCISES);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('fallback'); // 'api' | 'fallback'

  // Fetch exercises from the backend; gracefully fall back to static data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getExercises()
      .then((data) => {
        if (cancelled) return;
        if (data?.exercises?.length > 0) {
          setExercises(data.exercises.map(mapApiExercise));
          setDataSource('api');
        } else {
          // Backend up but no exercises seeded yet — keep fallback
          setDataSource('fallback');
        }
      })
      .catch(() => {
        if (!cancelled) setDataSource('fallback');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Build category tabs with live counts
  const categories = CATEGORY_DEFS.map((cat) => ({
    ...cat,
    count: cat.id === 'all'
      ? exercises.length
      : exercises.filter((ex) => ex.category_key === cat.id).length,
  }));

  const filteredExercises = activeCategory === 'all'
    ? exercises
    : exercises.filter((ex) => ex.category_key === activeCategory);

  return (
    <div className="dashboard-layout">
      <Sidebar activePage="exercises" onNavigate={onNavigate} role="patient" />

      <main className="dashboard-content">
        <PageHeader
          badge="Catalog & Protocols"
          title="Rehabilitation Exercise Library"
          description={
            dataSource === 'api'
              ? 'Exercise catalog loaded live from the database. AI real-time angle analysis enabled.'
              : 'Browse prescribed exercises with built-in AI real-time angle analysis and posture feedback.'
          }
        />

        {/* Categories Tab */}
        <NavigationTabs
          tabs={categories}
          activeTab={activeCategory}
          onTabChange={setActiveCategory}
        />

        {/* Loading skeleton */}
        {loading ? (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  flex: '1 1 280px',
                  height: 220,
                  borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(90deg, var(--bg-subtle) 25%, var(--border-subtle) 50%, var(--bg-subtle) 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.4s infinite',
                }}
              />
            ))}
          </div>
        ) : (
          /* Exercise Card Grid */
          <div className="exercise-grid">
            {filteredExercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                title={exercise.title}
                category={exercise.category}
                difficulty={exercise.difficulty}
                targetReps={exercise.targetReps}
                targetSets={exercise.targetSets}
                targetJoint={exercise.targetJoint}
                description={exercise.description}
                onStart={() => onNavigate('session')}
              />
            ))}
            {filteredExercises.length === 0 && (
              <p style={{ color: 'var(--text-muted)', padding: '32px 0' }}>
                No exercises in this category yet.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ExerciseListPage;
