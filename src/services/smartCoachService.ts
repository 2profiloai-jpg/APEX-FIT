import { WorkoutPlan, WorkoutSession, EffortLevel, Exercise } from '../types';
import { EXERCISE_LIBRARY } from '../components/ExerciseLibrary';

export interface CoachAdvice {
  type: 'info' | 'warning' | 'success';
  message: string;
}

export const getReadyToTrainAdvice = (
  todayPlan: WorkoutPlan,
  recentSessions: WorkoutSession[]
): CoachAdvice | null => {
  if (!todayPlan) return null;

  const todayMuscles = new Set<string>();
  todayPlan.exercises.forEach(pe => {
    const ex = EXERCISE_LIBRARY.find(e => e.id === pe.exerciseId);
    ex?.targetMuscles.forEach(m => todayMuscles.add(m));
  });

  // Find the last session that shares muscles
  const lastSessionWithOverlap = recentSessions.find(session => {
    return session.exercises.some(se => {
      const ex = EXERCISE_LIBRARY.find(e => e.id === se.exerciseId);
      return ex?.targetMuscles.some(m => todayMuscles.has(m));
    });
  });

  if (!lastSessionWithOverlap) {
    return {
      type: 'success',
      message: `Oggi focus su ${todayPlan.name}. Sei fresco e pronto a spingere! Punta a carichi record sui primi esercizi.`
    };
  }

  const lastDate = new Date(lastSessionWithOverlap.startTime);
  const diffHours = (new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60);

  const overlapMuscles = new Set<string>();
  lastSessionWithOverlap.exercises.forEach(se => {
    const ex = EXERCISE_LIBRARY.find(e => e.id === se.exerciseId);
    ex?.targetMuscles.forEach(m => {
      if (todayMuscles.has(m)) overlapMuscles.add(m);
    });
  });
  
  const muscleList = Array.from(overlapMuscles).join(', ');

  if (diffHours < 48) {
    return {
      type: 'warning',
      message: `Attenzione: hai allenato ${muscleList} meno di 48h fa. Se senti affaticamento, riduciamo il volume del 10% per evitare sovrallenamento.`
    };
  }

  // If recovery is ok, check last session intensity
  // Check if any set in last session had effort 'MOLTO' or 'MOLTISSIMO' or RPE >= 9
  let pushedHard = false;
  lastSessionWithOverlap.exercises.forEach(se => {
    se.sets.forEach(set => {
      if (set.effort === 'MOLTO' || set.effort === 'MOLTISSIMO' || (set.rpe && set.rpe >= 9)) {
        pushedHard = true;
      }
    });
  });

  if (pushedHard) {
    const dayName = lastDate.toLocaleDateString('it-IT', { weekday: 'long' });
    return {
      type: 'info',
      message: `${dayName} hai spinto molto. Oggi per ${todayPlan.name} sei al recuperato. Prova ad aumentare il carico di 1-2kg sui fondamentali.`
    };
  }

  return {
    type: 'success',
    message: `Il recupero procede bene. Oggi è il giorno perfetto per consolidare la tecnica su ${todayPlan.name}.`
  };
};

export const getEffortFeedback = (effort: EffortLevel): string => {
  switch (effort) {
    case 'POCO': return "Troppo leggero, aumenta il carico.";
    case 'MEDIO': return "Sforzo moderato, puoi fare di più.";
    case 'GIUSTO': return "Perfetto, mantieni questo ritmo.";
    case 'MOLTO': return "Buona intensità, ottimo lavoro.";
    case 'MOLTISSIMO': return "Cedimento tecnico, massima attenzione.";
  }
};

export const getRestAdvice = (exerciseId: string, lastEffort?: EffortLevel): number => {
  const ex = EXERCISE_LIBRARY.find(e => e.id === exerciseId);
  const isCompound = ex?.type === 'Composto' || ex?.type === 'Massa';
  
  if (lastEffort === 'MOLTISSIMO') return isCompound ? 180 : 120;
  if (lastEffort === 'MOLTO') return isCompound ? 120 : 90;
  if (lastEffort === 'GIUSTO') return isCompound ? 90 : 60;
  return 60;
};

export const getTechniqueCue = (exerciseId: string): string => {
  const ex = EXERCISE_LIBRARY.find(e => e.id === exerciseId);
  if (!ex) return "Mantieni il core contratto.";
  
  const cues: Record<string, string[]> = {
    'Petto': ['Scapole addotte e depresse', 'Petto sempre in fuori', 'Piedi ben piantati'],
    'Schiena': ['Tira con i gomiti, non con le mani', 'Apri il petto in cima', 'Allunga bene in discesa'],
    'Gambe': ['Peso sul centro piede', 'Ginocchia in linea con le punte', 'Schiena sempre neutra'],
    'Spalle': ['Core stabilissimo', 'Non alzare le spalle alle orecchie', 'Gomiti leggermente avanti'],
    'Bicipiti': ['Gomiti incollati ai fianchi', 'Nessun dondolio', 'Schiaccia il mignolo in cima'],
    'Tricipiti': ['Gomiti fermi nello spazio', 'Estensione completa', 'Tensione continua'],
  };

  const categoryCues = cues[ex.category] || ['Core contratto', 'Controllo massimo'];
  return categoryCues[Math.floor(Math.random() * categoryCues.length)];
};

export interface ProgressGoal {
  type: 'increase_weight' | 'increase_reps' | 'maintain';
  target: string;
}

export const getProgressGoal = (exerciseId: string, recentSessions: WorkoutSession[]): ProgressGoal | null => {
  // Find last time this exercise was performed
  let lastSet: any = null;
  for (const session of recentSessions) {
    const exEntry = session.exercises.find(se => se.exerciseId === exerciseId);
    if (exEntry && exEntry.sets.length > 0) {
      lastSet = exEntry.sets[0]; // Get the heaviest/first working set
      break;
    }
  }

  if (!lastSet) return null;

  if (lastSet.effort === 'POCO' || lastSet.effort === 'MEDIO') {
    return { type: 'increase_weight', target: `Prova +1-2kg rispetto ai ${lastSet.weight}kg dell'ultima volta.` };
  }
  
  if (lastSet.effort === 'MOLTO') {
    return { type: 'increase_reps', target: `Stesso peso (${lastSet.weight}kg), prova a fare +1 ripetizione.` };
  }

  return { type: 'maintain', target: `Mantieni ${lastSet.weight}kg e focus sulla perfezione tecnica.` };
};

export const getImmediateLoadSuggestion = (currentWeight: number, effort: EffortLevel): string | null => {
  if (effort === 'POCO') {
    const suggestion = currentWeight === 0 ? "Aumenta sensibilmente il carico." : `Aumenta di ${Math.max(1, Math.round(currentWeight * 0.05))}-2kg per la prossima serie.`;
    return suggestion;
  }
  if (effort === 'MOLTISSIMO') {
    const suggestion = currentWeight === 0 ? "Riduci il carico." : `Riduci di ${Math.max(1, Math.round(currentWeight * 0.1))}kg per finire in sicurezza.`;
    return suggestion;
  }
  return null;
};

export interface BalanceScore {
  pushes: number;
  pulls: number;
  legs: number;
  core: number;
  metabolicLevel: number; // Indice di Carico Metabolico
  suggestions: string[];
}

export const getPlanBalanceAnalysis = (planExercises: { exerciseId: string; targetSets: number }[]): BalanceScore => {
  let pushes = 0;
  let pulls = 0;
  let legs = 0;
  let core = 0;
  let totalSets = 0;
  let compoundSets = 0;

  planExercises.forEach(pe => {
    const ex = EXERCISE_LIBRARY.find(e => e.id === pe.exerciseId);
    if (!ex) return;

    totalSets += pe.targetSets;
    if (ex.type === 'Composto') compoundSets += pe.targetSets;

    const isPush = ['Petto', 'Spalle', 'Tricipiti'].includes(ex.category);
    const isPull = ['Schiena', 'Bicipiti'].includes(ex.category);
    const isLegs = ex.category === 'Gambe';
    const isCore = ex.category === 'Core';

    if (isPush) pushes += pe.targetSets;
    if (isPull) pulls += pe.targetSets;
    if (isLegs) legs += pe.targetSets;
    if (isCore) core += pe.targetSets;
  });

  const suggestions: string[] = [];
  if (pushes > pulls + 6) suggestions.push("Troppo volume di spinta rispetto alle tirate. Rischio squilibrio posturale.");
  if (pulls > pushes + 6) suggestions.push("Molto volume di tirata. Ottimo per la postura, ma non trascurare la spinta.");
  if (legs === 0 && totalSets > 12) suggestions.push("Questa sessione trascura completamente le gambe.");
  if (totalSets > 24) suggestions.push("Volume molto alto (>24 serie). Potrebbe essere eccessivo per una sola sessione.");
  
  // ICM = (Totale Serie + (Serie Composte * 1.5)) / 10
  const metabolicLevel = (totalSets + (compoundSets * 1.5)) / 10;

  return { pushes, pulls, legs, core, metabolicLevel, suggestions };
};
