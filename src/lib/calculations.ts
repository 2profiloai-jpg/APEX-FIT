export const calculateBMR = (weight: number, height: number, age: number, gender: 'male' | 'female', bodyFat?: number) => {
  if (bodyFat && bodyFat > 0) {
    const leanMass = weight * (1 - (bodyFat / 100));
    return 370 + (21.6 * leanMass);
  }
  if (gender === 'male') {
    return (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    return (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }
};

export const calculateTDEE = (bmr: number, activityLevel: number) => {
  return bmr * activityLevel;
};

export const calculateTargetKcal = (tdee: number, goal: 'lose' | 'maintain' | 'gain') => {
  if (goal === 'lose') return tdee * 0.85; // -15%
  if (goal === 'gain') return tdee * 1.15; // +15%
  return tdee;
};

export const calculateMacros = (weight: number, targetKcal: number) => {
  // Algoritmo Ipertrofia (Massa)
  const protein = weight * 2.0;
  const fat = weight * 0.9; // Media tra 0.8 e 1
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const carbsKcal = targetKcal - proteinKcal - fatKcal;
  const carbs = Math.max(0, carbsKcal / 4);
  
  return {
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs)
  };
};

export const calculateBMI = (weight: number, height: number) => {
  if (!height) return 0;
  const heightM = height / 100;
  return weight / (heightM * heightM);
};

export const calculate1RM = (weight: number, reps: number) => {
  if (reps === 1) return weight;
  return weight / (1.0278 - (0.0278 * reps));
};

export const calculateVolume = (sets: number, reps: number, weight: number) => {
  return sets * reps * weight;
};
