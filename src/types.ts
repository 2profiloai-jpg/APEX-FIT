export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  readinessScore: number;
  lastSync: string;
  preferences: Record<string, any>;
  weight?: number;
  height?: number;
  age?: number;
  gender?: 'male' | 'female';
  activityLevel?: number;
  goal?: 'lose' | 'maintain' | 'gain';
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

export interface WorkoutSet {
  weight: number;
  reps: number;
  rpe?: number;
  tag: SetTag;
  completed?: boolean;
}

export interface SessionExercise {
  exerciseId: string;
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
  targetSets: number;
  targetReps: string;
  targetRpe?: number;
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
