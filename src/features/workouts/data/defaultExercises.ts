import type { Exercise } from '@/types/workout'

export const DEFAULT_EXERCISES: Exercise[] = [
  // Chest
  {
    id: 'def-bench-press',
    user_id: null,
    name: 'Barbell Bench Press',
    muscle_group: 'chest',
    equipment: 'barbell',
    instructions:
      'Lie flat on the bench, grip the bar slightly wider than shoulder-width, lower to mid-chest, and press explosively while maintaining upper back tightness.',
    is_custom: false,
  },
  {
    id: 'def-incline-db-press',
    user_id: null,
    name: 'Incline Dumbbell Press',
    muscle_group: 'chest',
    equipment: 'dumbbell',
    instructions:
      'Set the bench to a 30-degree incline. Press dumbbells up and slightly inward over the upper chest with controlled descent.',
    is_custom: false,
  },
  {
    id: 'def-dips-chest',
    user_id: null,
    name: 'Dips (Chest Focus)',
    muscle_group: 'chest',
    equipment: 'bodyweight',
    instructions:
      'Lean torso forward roughly 30 degrees, flare elbows slightly, lower until upper arms are parallel to the ground, and push back up.',
    is_custom: false,
  },
  {
    id: 'def-cable-fly',
    user_id: null,
    name: 'Cable Chest Fly',
    muscle_group: 'chest',
    equipment: 'cable',
    instructions:
      'Set cables at chest height. Bring hands together in an arc motion with elbows slightly bent, squeezing the pectoral muscles at peak contraction.',
    is_custom: false,
  },
  {
    id: 'def-push-ups',
    user_id: null,
    name: 'Push-ups',
    muscle_group: 'chest',
    equipment: 'bodyweight',
    instructions:
      'Keep core tight, elbows at a 45-degree angle, lower until chest touches the floor, and press up to full lockout.',
    is_custom: false,
  },

  // Back
  {
    id: 'def-deadlift',
    user_id: null,
    name: 'Barbell Deadlift',
    muscle_group: 'back',
    equipment: 'barbell',
    instructions:
      'Stand with feet hip-width apart. Hinge at hips, grip the bar just outside knees, brace core, and drive through the floor to stand tall.',
    is_custom: false,
  },
  {
    id: 'def-barbell-row',
    user_id: null,
    name: 'Barbell Bent-Over Row',
    muscle_group: 'back',
    equipment: 'barbell',
    instructions:
      'Hinge forward at 45 degrees with flat spine. Pull the barbell toward your lower ribcage, squeezing the lats and rhomboids.',
    is_custom: false,
  },
  {
    id: 'def-pull-ups',
    user_id: null,
    name: 'Pull-ups',
    muscle_group: 'back',
    equipment: 'bodyweight',
    instructions:
      'Overhand grip slightly wider than shoulder-width. Drive elbows down toward your hips until your chin clears the bar.',
    is_custom: false,
  },
  {
    id: 'def-lat-pulldown',
    user_id: null,
    name: 'Lat Pulldown',
    muscle_group: 'back',
    equipment: 'cable',
    instructions:
      'Grip the wide bar, lean back slightly, pull the bar down to collarbone level while driving elbows downward.',
    is_custom: false,
  },
  {
    id: 'def-cable-row',
    user_id: null,
    name: 'Seated Cable Row',
    muscle_group: 'back',
    equipment: 'cable',
    instructions:
      'Maintain neutral spine, pull handle toward your abdomen, retracting shoulder blades without leaning excessively backward.',
    is_custom: false,
  },

  // Shoulders
  {
    id: 'def-ohp',
    user_id: null,
    name: 'Overhead Press (OHP)',
    muscle_group: 'shoulders',
    equipment: 'barbell',
    instructions:
      'Stand tall with bar racked at clavicle height. Press the bar vertically overhead while squeezing glutes and core.',
    is_custom: false,
  },
  {
    id: 'def-lateral-raise',
    user_id: null,
    name: 'Dumbbell Lateral Raise',
    muscle_group: 'shoulders',
    equipment: 'dumbbell',
    instructions:
      'Slight forward lean, raise dumbbells out to the sides in the scapular plane up to shoulder level with controlled eccentric.',
    is_custom: false,
  },
  {
    id: 'def-db-shoulder-press',
    user_id: null,
    name: 'Seated Dumbbell Shoulder Press',
    muscle_group: 'shoulders',
    equipment: 'dumbbell',
    instructions:
      'Press dumbbells overhead from ear level, locking out smoothly without slamming the weights together.',
    is_custom: false,
  },
  {
    id: 'def-face-pull',
    user_id: null,
    name: 'Face Pulls',
    muscle_group: 'shoulders',
    equipment: 'cable',
    instructions:
      'Attach rope at eye level. Pull rope toward your face while externally rotating your shoulders, bringing knuckles back.',
    is_custom: false,
  },

  // Legs
  {
    id: 'def-squat',
    user_id: null,
    name: 'Barbell Back Squat',
    muscle_group: 'legs',
    equipment: 'barbell',
    instructions:
      'Rest bar on upper traps. Break at hips and knees simultaneously, descend to parallel or deeper, then drive through mid-foot to return.',
    is_custom: false,
  },
  {
    id: 'def-rdl',
    user_id: null,
    name: 'Romanian Deadlift (RDL)',
    muscle_group: 'legs',
    equipment: 'barbell',
    instructions:
      'Keep slight bend in knees, push hips backward until you feel a deep stretch in the hamstrings, then engage glutes to stand.',
    is_custom: false,
  },
  {
    id: 'def-leg-press',
    user_id: null,
    name: 'Leg Press',
    muscle_group: 'legs',
    equipment: 'machine',
    instructions:
      'Place feet shoulder-width on platform. Lower sled until knees reach 90 degrees, then press through heels without locking knees abruptly.',
    is_custom: false,
  },
  {
    id: 'def-bulgarian-split-squat',
    user_id: null,
    name: 'Bulgarian Split Squat',
    muscle_group: 'legs',
    equipment: 'dumbbell',
    instructions:
      'Place rear foot elevated on a bench. Lower hips until front thigh is parallel to the ground, driving through front heel to rise.',
    is_custom: false,
  },
  {
    id: 'def-leg-curl',
    user_id: null,
    name: 'Lying Leg Curl',
    muscle_group: 'legs',
    equipment: 'machine',
    instructions:
      'Lie face down with pad above ankles. Curl weight toward glutes, pausing momentarily at peak contraction.',
    is_custom: false,
  },
  {
    id: 'def-leg-extension',
    user_id: null,
    name: 'Leg Extension',
    muscle_group: 'legs',
    equipment: 'machine',
    instructions:
      'Sit back against pad. Extend legs forward to contract the quadriceps, lowering with smooth control.',
    is_custom: false,
  },
  {
    id: 'def-calf-raise',
    user_id: null,
    name: 'Standing Calf Raise',
    muscle_group: 'legs',
    equipment: 'machine',
    instructions:
      'Balls of feet on step with heels hanging off. Lower heels for a full calf stretch, then rise onto toes with a solid contraction.',
    is_custom: false,
  },

  // Arms
  {
    id: 'def-bicep-curl',
    user_id: null,
    name: 'Barbell Bicep Curl',
    muscle_group: 'arms',
    equipment: 'barbell',
    instructions:
      'Grip bar shoulder-width with underhand grip. Keep elbows pinned to sides, curl weight up, and lower under control.',
    is_custom: false,
  },
  {
    id: 'def-incline-curl',
    user_id: null,
    name: 'Incline Dumbbell Curl',
    muscle_group: 'arms',
    equipment: 'dumbbell',
    instructions:
      'Sit on a 45-60 degree incline. Let arms hang back for maximum stretch on the long head of the bicep before curling.',
    is_custom: false,
  },
  {
    id: 'def-hammer-curl',
    user_id: null,
    name: 'Hammer Curl',
    muscle_group: 'arms',
    equipment: 'dumbbell',
    instructions:
      'Hold dumbbells with neutral palms-facing-in grip. Curl up to target the brachialis and brachioradialis.',
    is_custom: false,
  },
  {
    id: 'def-tricep-pushdown',
    user_id: null,
    name: 'Tricep Rope Pushdown',
    muscle_group: 'arms',
    equipment: 'cable',
    instructions:
      'Keep upper arms perpendicular to the floor. Push rope down, flaring ends outward at bottom lockout for maximum tricep activation.',
    is_custom: false,
  },
  {
    id: 'def-skull-crusher',
    user_id: null,
    name: 'Skull Crushers',
    muscle_group: 'arms',
    equipment: 'barbell',
    instructions:
      'Lie on flat bench. Lower EZ-curl bar toward forehead by bending at elbows, then extend back to starting position.',
    is_custom: false,
  },

  // Core & Full Body
  {
    id: 'def-hanging-leg-raise',
    user_id: null,
    name: 'Hanging Leg Raise',
    muscle_group: 'core',
    equipment: 'bodyweight',
    instructions:
      'Hang from bar with active shoulders. Raise legs or knees smoothly toward chest using abdominal control without swinging.',
    is_custom: false,
  },
  {
    id: 'def-cable-woodchopper',
    user_id: null,
    name: 'Cable Woodchoppers',
    muscle_group: 'core',
    equipment: 'cable',
    instructions:
      'Rotate torso diagonally across your body engaging the obliques, pivoting on back foot with controlled return.',
    is_custom: false,
  },
  {
    id: 'def-ab-wheel',
    user_id: null,
    name: 'Ab Wheel Rollout',
    muscle_group: 'core',
    equipment: 'bodyweight',
    instructions:
      'Kneel with wheel in front. Roll forward extending hips and core as far as possible without sagging lower back, then pull back.',
    is_custom: false,
  },
  {
    id: 'def-plank',
    user_id: null,
    name: 'Plank',
    muscle_group: 'core',
    equipment: 'bodyweight',
    instructions:
      'Rest on forearms and toes, maintaining a straight line from heels to head while bracing core and squeezing glutes.',
    is_custom: false,
  },
]
