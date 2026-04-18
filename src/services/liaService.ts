import { WorkoutSession, SessionExercise } from '../types';
import { EXERCISE_LIBRARY } from '../components/ExerciseLibrary';

export interface LIAFeedback {
  type: 'progression' | 'balancing' | 'technical';
  message: string;
}

export const analyzeSessionCompletion = (session: WorkoutSession): LIAFeedback | null => {
  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const completedSets = session.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);
  
  if (completedSets < totalSets) {
    return {
      type: 'technical',
      message: `Ho notato che oggi non hai completato tutte le serie previste (${completedSets}/${totalSets}). Era per mancanza di tempo o fatica eccessiva?`
    };
  }

  return null;
};

export const getProactiveFeedback = (recentSessions: WorkoutSession[]): LIAFeedback[] => {
  const feedback: LIAFeedback[] = [];
  if (!recentSessions || recentSessions.length === 0) return feedback;

  const lastSession = recentSessions[0];
  
  // 1. Progression: Check if user completed all sets in a heavy compound exercise with 'GIUSTO' or 'POCO' effort.
  const firstCompound = lastSession.exercises.find(ex => {
    const info = EXERCISE_LIBRARY.find(e => e.id === ex.exerciseId);
    return info?.type === 'Composto' || info?.type === 'Massa';
  });

  if (firstCompound && firstCompound.sets.length > 0) {
    const allCompleted = firstCompound.sets.every(s => s.completed !== false);
    const hasLowEffort = firstCompound.sets.some(s => s.effort === 'POCO' || s.effort === 'MEDIO');
    const info = EXERCISE_LIBRARY.find(e => e.id === firstCompound.exerciseId);
    
    if (allCompleted && hasLowEffort) {
      feedback.push({
        type: 'progression',
        message: `Performance solida su ${info?.name}! Hai completato il 100% del volume previsto e l'effort percepito era controllato. La prossima volta proviamo ad aggiungere 2-5kg per lato per stimolare un ulteriore adattamento.`
      });
    }
  }

  // 2. Balancing: Check if user skipped specific muscle groups logically paired.
  const categoriesHit = new Set<string>();
  lastSession.exercises.forEach(ex => {
    if (ex.sets.some(s => s.completed !== false)) {
      const info = EXERCISE_LIBRARY.find(e => e.id === ex.exerciseId);
      if (info) categoriesHit.add(info.category);
    }
  });
  
  if (categoriesHit.has('Petto') && (!categoriesHit.has('Tricipiti') && !categoriesHit.has('Spalle'))) {
    feedback.push({
      type: 'balancing',
      message: `Nell'ultima sessione hai spinto al massimo sul Petto, ma sembra tu abbia saltato il lavoro su Spalle o Tricipiti. Oggi diamo priorità a questi ultimi per evitare squilibri posturali, poi passiamo al resto della scheda.`
    });
  } else if (categoriesHit.has('Schiena') && !categoriesHit.has('Bicipiti')) {
    feedback.push({
      type: 'balancing',
      message: `Ho notato che nell'ultima sessione di Tirata hai saltato i bicipiti. Il dorso ha lavorato bene, ma per ottimizzare le braccia, inseriamo i complementari oggi.`
    });
  }

  // 3. Technical: Check for high effort ('MOLTISSIMO') or drops in completed sets.
  let strugglingExerciseName = '';
  let dropWeight = false;
  
  lastSession.exercises.forEach(ex => {
    const incompleteSets = ex.sets.filter(s => s.completed === false);
    const veryHardSets = ex.sets.filter(s => s.effort === 'MOLTISSIMO' || (s.rpe && s.rpe >= 9.5));
    
    if ((incompleteSets.length > 0 || veryHardSets.length > 1) && !strugglingExerciseName) {
      const info = EXERCISE_LIBRARY.find(e => e.id === ex.exerciseId);
      if (info) {
        strugglingExerciseName = info.name;
        dropWeight = incompleteSets.length > 0;
      }
    }
  });

  if (strugglingExerciseName) {
    if (dropWeight) {
      feedback.push({
        type: 'technical',
        message: `Nelle ultime serie di ${strugglingExerciseName} il tuo volume è calato e non hai chiuso le ripetizioni. Forse il carico è troppo alto per mantenere la tecnica? Ti suggerisco un deload del 10% la prossima volta e focus sulla profondità.`
      });
    } else {
      feedback.push({
        type: 'technical',
        message: `Su ${strugglingExerciseName} sei arrivato a cedimento tecnico estremo. Ottimo per l'intensità, ma attenzione al recupero nervoso: tieniti una ripetizione in canna (RPE 8-9) per gestire meglio il volume globale.`
      });
    }
  }

  // Fallback if no specific feedback generated
  if (feedback.length === 0 && lastSession.exercises.length >= 2) {
      feedback.push({
        type: 'progression',
        message: `Ottima costanza! Hai mantenuto un volume allenante eccellente nell'ultima sessione. Nessuna lacuna rilevata.`
      });
  }

  return feedback;
};
