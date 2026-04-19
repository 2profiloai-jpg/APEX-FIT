export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  readinessScore: number;
  lastSync: string;
  preferences: Record<string, any>;
  themeColor?: string;
  weight?: number;
  height?: number;
  age?: number;
  gender?: 'male' | 'female';
  activityLevel?: number;
  goal?: 'lose' | 'maintain' | 'gain';
  bodyFat?: number;
  customTargets?: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  gymInventory?: GymEquipment[];
}

export interface GymEquipment {
  id: string;
  name: string;
  category: ExerciseCategory | 'Generic';
  targetMuscles: string[];
  equipmentType: 'Machine' | 'Dumbbells' | 'Barbell' | 'Bodyweight' | 'Cable';
  addedAt: string;
}

export type ExerciseCategory = 'Petto' | 'Schiena' | 'Gambe' | 'Spalle' | 'Bicipiti' | 'Tricipiti' | 'Core' | 'Cardio';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  targetMuscles: string[];
  videoUrl?: string;
  instructions?: string;
  equipment?: string;
  type?: 'Composto' | 'Isolamento' | 'Massa' | 'Tensione' | 'Allungamento' | 'Catena Post.' | 'Isometria';
  proNote?: string;
}

export type SetTag = 'Warm-up' | 'Working' | 'Top' | 'Back-off' | 'Drop' | 'Cluster' | 'Myo-rep';

export type EffortLevel = 'POCO' | 'MEDIO' | 'GIUSTO' | 'MOLTO' | 'MOLTISSIMO';

export interface WorkoutSet {
  weight: number;
  reps: number;
  rpe?: number;
  effort?: EffortLevel;
  tag: SetTag;
  completed?: boolean;
}

export interface SessionExercise {
  exerciseId: string;
  customName?: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  userId: string;
  startTime: string;
  endTime?: string;
  exercises: SessionExercise[];
}

export interface PlannedExercise {
  exerciseId: string;
  customName?: string;
  targetSets: number;
  targetReps: string;
  targetRpe?: number;
  targetEffort?: EffortLevel;
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  date: string; // YYYY-MM-DD
  exercises: PlannedExercise[];
}

export interface BiometricLog {
  userId: string;
  date: string;
  hrv: number;
  sleepHours: number;
  stressLevel: number;
}

export interface FoodItem {
  id: string;
  name: string;
  amount?: string;
  kcal: number;
  carbs?: number;
  protein?: number;
  fat?: number;
}

export interface MealLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  type: 'Colazione' | 'Pranzo' | 'Cena' | 'Spuntini';
  foods: FoodItem[];
}

export interface FavoriteMeal {
  id: string;
  userId: string;
  name: string;
  type: 'Colazione' | 'Pranzo' | 'Cena' | 'Spuntini';
  foods: FoodItem[];
}
