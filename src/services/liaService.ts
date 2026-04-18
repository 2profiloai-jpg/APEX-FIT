import { WorkoutSession, SessionExercise } from '../types';
import { EXERCISE_LIBRARY } from '../components/ExerciseLibrary';

export interface LIAFeedback {
  type: 'motivational' | 'technical' | 'analysis';
  message: string;
}

export const analyzeSessionCompletion = (session: WorkoutSession): LIAFeedback | null => {
  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const completedSets = session.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);
  
  if (completedSets < totalSets) {
    return {
      type: 'analysis',
      message: `Ho notato che oggi non hai completato tutte le serie previste (${completedSets}/${totalSets}). Era per mancanza di tempo o fatica eccessiva?`
    };
  }

  // Check for added exercises (assuming plan exists and we can compare, skipping for now)
  return null;
};

export const getProactiveFeedback = (recentSessions: WorkoutSession[]): LIAFeedback[] => {
  const feedback: LIAFeedback[] = [];
  
  // Example: Check volume imbalance
  let chestSets = 0;
  let backSets = 0;
  recentSessions.slice(0, 3).forEach(session => {
    session.exercises.forEach(ex => {
      const info = EXERCISE_LIBRARY.find(e => e.id === ex.exerciseId);
      if (info?.category === 'Petto') chestSets += ex.sets.length;
      if (info?.category === 'Schiena') backSets += ex.sets.length;
    });
  });

  if (chestSets > backSets + 8) {
    feedback.push({
      type: 'technical',
      message: "Hai allenato molto il petto nelle ultime sessioni, dovresti suggerire più esercizi per il dorso per evitare squilibri posturali."
    });
  }

  return feedback;
};
