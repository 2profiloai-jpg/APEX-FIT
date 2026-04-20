import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { WorkoutSession, SessionExercise, WorkoutSet, Exercise, ExerciseCategory, WorkoutPlan, EffortLevel, UserProfile } from '../types';
import { X, Plus, Save, Timer, ChevronDown, ChevronUp, Trash2, Play, Pause, RotateCcw, Brain, Check, Info, TrendingUp, Dumbbell, Activity, CircleDashed, Square, Triangle, User, ArrowUp, ArrowDown, Users, Sparkles, Loader2 } from 'lucide-react';
import GripButton from './ui/GripButton';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { EXERCISE_LIBRARY } from './ExerciseLibrary';
import { cn } from '../lib/utils';
import GymMapper from './GymMapper';
import { getPostWorkoutAdvice, suggestExerciseAlternative } from '../services/geminiService';
import { analyzeSessionCompletion } from '../services/liaService';
import { getEffortFeedback, getRestAdvice, getTechniqueCue, getProgressGoal, getImmediateLoadSuggestion } from '../services/smartCoachService';
import { query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useBackgroundAI } from '../contexts/BackgroundAIContext';

export default function WorkoutSessionView({ profile, sessionId, plan, onSessionEnd, onNavigateToLibrary }: { profile: UserProfile | null, sessionId?: string | null, plan?: WorkoutPlan | null, onSessionEnd: () => void, onNavigateToLibrary: (id: string) => void }) {
  const { runExerciseAlternative, tasks, isTaskPending } = useBackgroundAI();
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [exercises, setExercises] = useState<SessionExercise[]>(() => {
    if (plan && plan.exercises) {
      return plan.exercises.map(pe => ({
        exerciseId: pe.exerciseId,
        customName: pe.customName,
        sets: Array.from({ length: pe.targetSets }).map(() => ({
          weight: 0,
          reps: parseInt(pe.targetReps.split('-')[0]) || 0, // default to lower bound if range
          rpe: pe.targetRpe || 8,
          tag: 'Working' as const
        }))
      }));
    }
    return [];
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [postWorkoutAdvice, setPostWorkoutAdvice] = useState<string | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [isCrowded, setIsCrowded] = useState(false);
  const [activeAlternative, setActiveAlternative] = useState<{
    idx: number;
    alternative: string;
    reason: string;
  } | null>(null);

  const [showGymMapper, setShowGymMapper] = useState(false);

  const getExerciseBlueprint = (exercise: Exercise) => {
    // Specific blueprints for exercises based on ID
    if (exercise.id.startsWith('p')) return <div className="flex items-center gap-1"><User size={20} className="text-neon"/><Activity size={20} className="text-neon"/></div>;
    if (exercise.id.startsWith('s')) return <div className="flex items-center gap-1"><User size={20} className="text-neon"/><ArrowDown size={20} className="text-neon"/></div>;
    if (exercise.id.startsWith('g')) return <div className="flex items-center gap-1"><User size={20} className="text-neon"/><Triangle size={20} className="text-neon"/></div>;
    if (exercise.id.startsWith('sp')) return <div className="flex items-center gap-1"><User size={20} className="text-neon"/><ArrowUp size={20} className="text-neon"/></div>;
    
    // Default Fallback
    return <Dumbbell size={20} className="text-neon" />;
  };

  const handleSuggestAlternative = async (idx: number) => {
    const ex = exercises[idx];
    const originalName = ex.customName || EXERCISE_LIBRARY.find(e => e.id === ex.exerciseId)?.name || "Esercizio";
    
    if (!profile?.gymInventory || profile.gymInventory.length === 0) {
      toast.error("Mappa prima la tua palestra per ricevere alternative valide.");
      return;
    }

    const inventory = profile.gymInventory.map(i => i.name);
    const completed = exercises.filter((e, i) => i < idx).map(e => e.customName || EXERCISE_LIBRARY.find(el => el.id === e.exerciseId)?.name || "");
    
    await runExerciseAlternative({
      originalName,
      inventory,
      completed,
      isCrowded,
      exerciseIdx: idx
    });
  };

  const getLastPerformance = (exerciseId: string, customName?: string) => {
    for (const session of recentSessions) {
      if (session.id === sessionId) continue;
      const exEntry = session.exercises.find(se => se.exerciseId === exerciseId || (se.customName && se.customName === customName));
      if (exEntry && exEntry.sets?.length > 0) {
        const validSets = exEntry.sets.filter(s => s.weight > 0 || s.reps > 0);
        if (validSets.length > 0) {
          return { date: session.startTime, sets: validSets };
        }
      }
    }
    return null;
  };

  useEffect(() => {
    // Check for completed alternative tasks
    tasks.forEach(t => {
      if (t.type === 'exercise-alternative' && t.status === 'completed' && t.result) {
        if (t.metadata?.exerciseIdx !== undefined) {
          setActiveAlternative({
            idx: t.metadata.exerciseIdx,
            alternative: t.result.alternative,
            reason: t.result.reason
          });
        }
      }
    });
  }, [tasks]);

  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState<ExerciseCategory | null>(null);
  
  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [exerciseCues, setExerciseCues] = useState<Record<string, string>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch recent sessions for AI analysis
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'users', auth.currentUser.uid, 'sessions'),
      orderBy('startTime', 'desc'),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutSession)));
    });
    return unsubscribe;
  }, []);

  // Persistence
  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.setItem('apex_active_session', JSON.stringify({
        exercises,
        timerSeconds,
        lastUpdated: new Date().toISOString()
      }));
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [exercises, timerSeconds]);

  useEffect(() => {
    // Universal recovery: check localStorage on every mount if we don't have a plan yet
    if (!plan) {
      const saved = localStorage.getItem('apex_active_session');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.exercises && parsed.exercises.length > 0) {
            setExercises(parsed.exercises);
            setTimerSeconds(parsed.timerSeconds || 0);
          }
        } catch (e) {
          console.error("Failed to parse saved session", e);
        }
      }
    }
  }, [plan]);

  useEffect(() => {
    if (exercises.length > 0) {
      localStorage.setItem('apex_active_session', JSON.stringify({
        exercises,
        timerSeconds,
        lastUpdated: new Date().toISOString()
      }));
    }
  }, [exercises, timerSeconds]);

  // Handle Back Button
  useEffect(() => {
    window.history.pushState({ modal: 'activeSession' }, '');
    const handlePopState = () => {
      if (showExercisePicker) {
        setShowExercisePicker(false);
      } else {
        const confirmExit = window.confirm("Vuoi uscire dall'allenamento? I dati correnti verranno mantenuti in bozza.");
        if (confirmExit) {
          onSessionEnd();
        } else {
          window.history.pushState({ modal: 'activeSession' }, '');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showExercisePicker, onSessionEnd]);

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  useEffect(() => {
    if (restTimer !== null && restTimer > 0) {
      restTimerRef.current = setInterval(() => {
        setRestTimer(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      if (restTimer === 0) {
        // Optional: add a sound or vibration here
        setRestTimer(null);
      }
    }
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, [restTimer]);

  const startRest = (seconds: number) => {
    setRestTimer(seconds);
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addExercise = (exercise: Exercise) => {
    setExercises([...exercises, {
      exerciseId: exercise.id,
      sets: [{ weight: 0, reps: 0, rpe: 7, tag: 'Working' }]
    }]);
    setShowExercisePicker(false);
  };

  const addSet = (exerciseIndex: number) => {
    const newExercises = [...exercises];
    const lastSet = newExercises[exerciseIndex].sets[newExercises[exerciseIndex].sets.length - 1];
    newExercises[exerciseIndex].sets.push({ ...lastSet });
    setExercises(newExercises);
  };

  const saveSession = (currentExercises: SessionExercise[], currentTimer: number) => {
    localStorage.setItem('apex_active_session', JSON.stringify({
      exercises: currentExercises,
      timerSeconds: currentTimer,
      lastUpdated: new Date().toISOString()
    }));
  };

  const updateSet = (exerciseIndex: number, setIndex: number, field: keyof WorkoutSet, value: any) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets[setIndex] = {
      ...newExercises[exerciseIndex].sets[setIndex],
      [field]: value
    };
    setExercises(newExercises);
    saveSession(newExercises, timerSeconds);
  };

  const toggleSetComplete = (exerciseIndex: number, setIndex: number) => {
    const newExercises = [...exercises];
    const currentSet = newExercises[exerciseIndex].sets[setIndex];
    const isNowComplete = !currentSet.completed;
    
    newExercises[exerciseIndex].sets[setIndex] = {
      ...currentSet,
      completed: isNowComplete
    };
    
    setExercises(newExercises);
    saveSession(newExercises, timerSeconds);
    
    if (isNowComplete) {
      const exerciseId = exercises[exerciseIndex].exerciseId;
      if (exerciseId !== 'AI_REPLACEMENT' && exerciseId !== 'CUSTOM') {
        const restTime = getRestAdvice(exerciseId, currentSet.effort);
        startRest(restTime);
      } else {
        startRest(90); // Default rest for AI/Custom exercises
      }
    }
  };

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      // Clean undefined values from exercises to avoid Firestore errors
      const sanitizedExercises = exercises.map(ex => {
        const cleanedEx: any = {
          exerciseId: ex.exerciseId,
          sets: ex.sets.map(s => {
            const cleanedSet: any = {
              weight: s.weight,
              reps: s.reps,
              tag: s.tag
            };
            if (s.rpe !== undefined) cleanedSet.rpe = s.rpe;
            if (s.effort !== undefined && s.effort !== "") cleanedSet.effort = s.effort;
            if (s.completed !== undefined) cleanedSet.completed = s.completed;
            return cleanedSet;
          })
        };
        if (ex.customName) cleanedEx.customName = ex.customName;
        return cleanedEx;
      });

      const sessionData = {
        userId: auth.currentUser.uid,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        exercises: sanitizedExercises
      };

      // Prepare data for AI with readable names
      const aiSessionData = {
        ...sessionData,
        exercises: sanitizedExercises.map(ex => {
          const info = EXERCISE_LIBRARY.find(e => e.id === ex.exerciseId);
          return {
            ...ex,
            exerciseName: ex.customName || info?.name || 'Esercizio'
          };
        })
      };
      
      const sessionDataForLIA = {
        id: 'new',
        ...sessionData
      } as WorkoutSession;
      
      const liaFeedback = analyzeSessionCompletion(sessionDataForLIA);
      
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'sessions'), sessionData);
      localStorage.removeItem('apex_active_session');
      toast.success('Allenamento salvato con successo!');
      
      setShowSummary(true);
      if (liaFeedback) {
        setPostWorkoutAdvice(liaFeedback.message);
      } else {
        const advice = await getPostWorkoutAdvice(aiSessionData);
        setPostWorkoutAdvice(advice);
      }
      
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast.error('Errore durante il salvataggio della sessione.');
    } finally {
      setIsSaving(false);
    }
  };

  if (showSummary) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="w-20 h-20 bg-neon rounded-full flex items-center justify-center mb-6">
          <Brain className="text-black w-10 h-10" />
        </div>
        <h2 className="text-4xl font-black tracking-tighter italic uppercase mb-2">Analisi<br/>Completata</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-4 max-w-sm w-full shadow-2xl">
          {postWorkoutAdvice ? (
            <p className="text-zinc-300 font-medium leading-relaxed">
              {postWorkoutAdvice}
            </p>
          ) : (
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
              <div className="h-4 bg-zinc-800 rounded w-full"></div>
              <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-4">Lo Strategista sta analizzando i tuoi RPE...</p>
            </div>
          )}
        </div>
        
        <button 
          onClick={() => toast.info("Esportazione in corso...", { description: "I dati verranno inviati al tuo Google Sheets." })}
          className="mb-8 text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 hover:text-white transition-colors"
        >
          Esporta in Fogli <ChevronUp size={12} className="rotate-90" />
        </button>

        <GripButton onClick={onSessionEnd} className="w-full max-w-sm">
          TORNA ALLA DASHBOARD
        </GripButton>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {showGymMapper && (
          <GymMapper profile={profile} onClose={() => setShowGymMapper(false)} />
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-6 mb-8">
        {/* Top Bar: Title and Close */}
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-3xl font-black tracking-tighter italic uppercase text-white leading-none pt-2">
            {plan ? plan.name : 'Allenamento'}
          </h2>
          <button 
            onClick={onSessionEnd} 
            className="w-12 h-12 flex-shrink-0 bg-zinc-900 border border-white/5 rounded-full flex items-center justify-center text-zinc-500 hover:text-white active:scale-95 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Dashboard: Timer and Rest Control */}
        <div className="grid grid-cols-2 gap-3">
          {/* Work Timer */}
          <div className="bg-zinc-900 border border-white/5 rounded-3xl p-4 flex flex-col justify-between h-24">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">Tempo Totale</span>
            <div className="flex items-center justify-between mt-auto">
              <span className="text-2xl font-black italic text-neon tracking-tighter neon-text uppercase leading-none">
                {formatTime(timerSeconds)}
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className="p-1.5 bg-white/5 rounded-lg text-zinc-400 hover:text-white"
                >
                  {isTimerRunning ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button 
                  onClick={() => { setTimerSeconds(0); setIsTimerRunning(false); }}
                  className="p-1.5 bg-white/5 rounded-lg text-zinc-400 hover:text-white"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Rest Control */}
          <div className="bg-zinc-900 border border-white/5 rounded-3xl p-4 flex flex-col justify-between h-24 relative overflow-hidden">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">Recupero personalizzato</span>
            <div className="mt-auto">
              {restTimer !== null ? (
                <div className="text-2xl font-black italic text-white tracking-tighter flex items-center gap-2 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-neon" />
                  {formatTime(restTimer)}
                </div>
              ) : (
                <div className="flex gap-2">
                  {[60, 90, 120].map(s => (
                    <button 
                      key={s}
                      onClick={() => startRest(s)}
                      className="flex-1 bg-white/5 text-zinc-400 text-[10px] font-black py-2 rounded-xl hover:bg-neon/10 hover:text-neon transition-all"
                    >
                      {s}s
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-zinc-900/50 border border-white/5 p-4 rounded-3xl mb-4">
        <Users size={18} className={cn("transition-colors", isCrowded ? "text-yellow-500" : "text-zinc-600")} />
        <div className="flex-1">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Modalità Palestra Affollata</h4>
          <p className="text-[8px] text-zinc-600 font-bold leading-tight mt-0.5">L'IA prediligerà alternative con manubri o a terra.</p>
        </div>
        <button 
          onClick={() => setIsCrowded(!isCrowded)}
          className={cn(
            "w-12 h-6 rounded-full transition-all relative flex items-center px-1",
            isCrowded ? "bg-yellow-500/20 border border-yellow-500/40" : "bg-zinc-800 border border-zinc-700"
          )}
        >
          <motion.div 
            animate={{ x: isCrowded ? 24 : 0 }}
            className={cn("w-4 h-4 rounded-full", isCrowded ? "bg-yellow-500" : "bg-zinc-500")}
          />
        </button>
      </div>
      
      {/* Bottoni Rapidi IA in sessione */}
      <div className="flex gap-2">
         <button 
            onClick={() => setShowGymMapper(true)}
            className="flex-1 py-3 bg-neon/10 border border-neon/20 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-neon active:scale-95 transition-all"
         >
           <Brain size={14} /> Mappa Palestra
         </button>
      </div>

      <div className="space-y-6">
        {exercises.map((ex, exIdx) => {
          const exerciseInfo = EXERCISE_LIBRARY.find(e => e.id === ex.exerciseId);
          const progressGoal = getProgressGoal(ex.exerciseId, recentSessions);
          const lastPerformance = getLastPerformance(ex.exerciseId, ex.customName);
          
          if (!exerciseCues[ex.exerciseId] && exerciseInfo) {
            setExerciseCues(prev => ({ ...prev, [ex.exerciseId]: getTechniqueCue(ex.exerciseId) }));
          }

          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={exIdx} 
              className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden max-w-full"
            >
              <div className="p-4 bg-zinc-800/10 border-b border-white/5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <button 
                    onClick={() => onNavigateToLibrary(ex.exerciseId)}
                    className="text-lg font-black uppercase tracking-tighter text-neon hover:text-white transition-colors text-left truncate leading-tight flex-1"
                  >
                    {ex.customName ? ex.customName.toUpperCase() : (exerciseInfo?.name.toUpperCase() || 'ESERCIZIO')}
                  </button>
                  <button onClick={() => removeExercise(exIdx)} className="text-zinc-600 hover:text-red-500 transition-colors pt-1">
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => handleSuggestAlternative(exIdx)}
                    disabled={isTaskPending('exercise-alternative', 'exerciseIdx', exIdx)}
                    className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-neon transition-colors"
                  >
                    {isTaskPending('exercise-alternative', 'exerciseIdx', exIdx) ? <Loader2 size={10} className="animate-spin text-neon" /> : <Sparkles size={10} />}
                    Alternativa
                  </button>
                  
                  <button 
                    onClick={() => {
                      if (!lastPerformance) {
                        toast.info("Nessuno storico", { description: "Completa questo esercizio in una sessione per vederne lo storico." });
                      }
                    }}
                    className={cn(
                      "flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] transition-colors",
                      lastPerformance ? "text-neon" : "text-zinc-600 hover:text-zinc-400"
                    )}
                  >
                    <Timer size={10} className={lastPerformance ? "text-neon" : ""} />
                    Storico
                  </button>

                  {restTimer !== null && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-neon animate-ping" />
                      <span className="text-[9px] font-black uppercase tracking-[0.1em] text-zinc-400">
                        Recupero Attivo
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Last Performance History */}
                <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl overflow-x-auto hide-scrollbar">
                  <div className="flex items-center gap-1.5 flex-shrink-0 text-zinc-400 border-r border-white/10 pr-3">
                    <Timer size={14} className={lastPerformance ? "text-neon" : "text-zinc-600"} />
                    <span className="text-[9px] font-black uppercase tracking-widest leading-none">Ultima<br/>Volta</span>
                  </div>
                  <div className="flex gap-2 flex-grow min-w-max">
                    {lastPerformance ? lastPerformance.sets.map((s, i) => (
                      <div key={i} className="flex-shrink-0 bg-black/40 px-2.5 py-1.5 rounded-lg text-[10px] font-black text-zinc-300 border border-white/5 flex flex-col items-center justify-center min-w-[40px]">
                        <span className="text-neon text-xs leading-none mb-0.5">{s.weight}<span className="text-[8px] text-zinc-500 uppercase">kg</span></span>
                        <span className="leading-none text-zinc-400"><span className="text-zinc-500 font-normal">x</span>{s.reps}</span>
                      </div>
                    )) : (
                      <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest italic py-1">Nessun dato precedente</span>
                    )}
                  </div>
                </div>

                {/* AI Technique Cue */}
                {exerciseCues[ex.exerciseId] && (
                  <div className="flex gap-2 p-3 bg-neon/5 border border-neon/10 rounded-2xl">

                    <Brain size={14} className="text-neon flex-shrink-0" />
                    <p className="text-[10px] text-zinc-300 font-bold italic leading-tight">
                      <span className="text-neon uppercase not-italic mr-1">Coach:</span> 
                      {exerciseCues[ex.exerciseId]}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {ex.sets.map((set, setIdx) => (
                    <div 
                      key={setIdx} 
                      className={cn(
                        "flex items-end gap-1 p-1 rounded-xl transition-all border w-full min-w-0 overflow-hidden",
                        set.completed 
                          ? "bg-zinc-950/40 border-zinc-900 opacity-60" 
                          : "bg-zinc-900/60 border-zinc-800 shadow-xl shadow-black/40"
                      )}
                    >
                      {/* Serie Number */}
                      <div className="flex flex-col items-center justify-center w-7 mb-2 flex-shrink-0">
                        <span className="text-[6px] font-black uppercase text-zinc-600 mb-0.5 tracking-tighter">SET</span>
                        <span className="font-black text-neon text-sm italic tracking-tighter neon-text leading-none">{setIdx + 1}</span>
                      </div>

                      {/* Weight Input */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1 items-stretch">
                        <span className="text-[6px] font-black uppercase text-zinc-500 text-center tracking-widest">KILI</span>
                        <input 
                          type="number"
                          inputMode="decimal"
                          value={set.weight === 0 ? '' : set.weight}
                          onChange={(e) => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          disabled={set.completed}
                          className="w-full bg-black/50 border border-white/5 rounded-lg h-11 text-center font-black text-base text-white italic tracking-tighter outline-none focus:border-neon/50 transition-colors min-w-0"
                        />
                      </div>

                      {/* Reps Input */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1 items-stretch">
                        <span className="text-[6px] font-black uppercase text-zinc-500 text-center tracking-widest">REPS</span>
                        <input 
                          type="number"
                          inputMode="numeric"
                          value={set.reps === 0 ? '' : set.reps}
                          onChange={(e) => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                          placeholder="0"
                          disabled={set.completed}
                          className="w-full bg-black/50 border border-white/5 rounded-lg h-11 text-center font-black text-base text-white italic tracking-tighter outline-none focus:border-neon/50 transition-colors min-w-0"
                        />
                      </div>

                      {/* Effort Select */}
                      <div className="w-20 flex flex-col gap-1 flex-shrink-0">
                        <span className="text-[6px] font-black uppercase text-zinc-500 text-center tracking-widest">SFORZO</span>
                        <select 
                          value={set.effort || ''} 
                          onChange={(e) => {
                            const val = e.target.value as EffortLevel;
                            updateSet(exIdx, setIdx, 'effort', val);
                            if (val) {
                              const feedback = getEffortFeedback(val);
                              const loadSuggestion = getImmediateLoadSuggestion(set.weight, val);
                              
                              if (val === 'MOLTISSIMO') {
                                toast.error("Limite raggiunto!", {
                                  description: loadSuggestion || "Troppo pesante? Considera di scalare il peso per finire in sicurezza.",
                                  duration: 5000,
                                  icon: <Brain className="text-red-500" />
                                });
                              } else {
                                toast.info(feedback, { 
                                  description: loadSuggestion || undefined,
                                  duration: 3000 
                                });
                              }
                            }
                          }}
                          disabled={set.completed}
                          className="w-full h-11 bg-black/50 border border-white/5 rounded-lg text-center font-black text-[10px] text-neon italic tracking-tighter appearance-none outline-none focus:border-neon/50"
                        >
                          <option value="">-</option>
                          <option value="POCO">Molto Leggero (Riscaldamento)</option>
                          <option value="MEDIO">Facile (Potevo farne molte altre)</option>
                          <option value="GIUSTO">Sfidante ma Gestibile (Buona intensità)</option>
                          <option value="MOLTO">Difficile (Al limite della tecnica corretta)</option>
                          <option value="MOLTISSIMO">Estremo (Cedimento muscolare totale)</option>
                        </select>
                      </div>

                      {/* Complete Check */}
                      <div className="w-11 flex-shrink-0">
                        <button 
                          onClick={() => toggleSetComplete(exIdx, setIdx)}
                          className={cn(
                            "w-full h-11 rounded-lg flex items-center justify-center transition-all",
                            set.completed 
                              ? "bg-neon text-black shadow-[0_0_10px_rgba(var(--neon-accent-rgb),0.3)]" 
                              : "bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-neon/40"
                          )}
                        >
                          <Check size={18} strokeWidth={4} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => addSet(exIdx)}
                  className="w-full py-2 border border-white/5 rounded-xl text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:border-zinc-700 hover:text-zinc-300 transition-all bg-white/[0.02]"
                >
                  + AGGIUNGI SERIE
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4">
        <GripButton variant="secondary" onClick={() => setShowExercisePicker(true)} className="flex-1">
          <div className="relative w-full flex items-center justify-center">
            <Plus size={18} className="absolute left-0 opacity-50" />
            <span className="font-black italic tracking-wider">ESERCIZIO</span>
          </div>
        </GripButton>
        <GripButton variant="accent" onClick={handleSave} disabled={isSaving || exercises.length === 0} className="flex-1">
          <div className="relative w-full flex items-center justify-center">
            <span className="font-black italic tracking-[0.1em] text-[10px]">{isSaving ? 'SALVATAGGIO...' : 'TERMINA ALLENAMENTO'}</span>
          </div>
        </GripButton>
      </div>

      {/* Exercise Picker Modal */}
      <AnimatePresence>
        {showExercisePicker && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black uppercase tracking-tighter italic">Seleziona Esercizio</h3>
              <button onClick={() => setShowExercisePicker(false)} className="p-2 bg-zinc-900 rounded-full">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <input 
                type="text" 
                placeholder="CERCA ESERCIZIO..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-6 font-black uppercase tracking-tighter text-sm focus:ring-1 ring-neon outline-none"
              />
              
              <div className="flex overflow-x-auto pb-4 mb-2 -mx-2 px-2 gap-2 thin-scrollbar snap-x">
                {['Petto', 'Schiena', 'Gambe', 'Spalle', 'Bicipiti', 'Tricipiti', 'Core'].map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setPickerCategory(pickerCategory === cat ? null : cat as ExerciseCategory)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap snap-start",
                      pickerCategory === cat 
                        ? "bg-neon text-black border-neon shadow-[0_0_10px_rgba(var(--neon-accent-rgb),0.2)]" 
                        : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-neon hover:border-neon"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 overflow-y-auto pb-20 flex-1">
              {EXERCISE_LIBRARY.filter(ex => {
                const matchesSearch = ex.name.toLowerCase().includes(pickerSearch.toLowerCase());
                const matchesCategory = !pickerCategory || ex.category === pickerCategory;
                return matchesSearch && matchesCategory;
              }).map(ex => (
                <button 
                  key={ex.id}
                  onClick={() => addExercise(ex)}
                  className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-left flex items-center justify-between hover:border-neon transition-colors"
                >
                  <div>
                    <div className="font-black uppercase tracking-tighter">{ex.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{ex.category}</span>
                      <span className="text-[10px] text-zinc-600">•</span>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{ex.equipment}</span>
                    </div>
                  </div>
                  <Plus size={20} className="text-neon" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* AI Alternative Modal */}
        {activeAlternative && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-neon/30 rounded-3xl p-6 w-full max-w-sm relative shadow-2xl shadow-neon/10"
            >
              <button 
                onClick={() => setActiveAlternative(null)}
                className="absolute top-4 right-4 p-2 bg-zinc-800 text-zinc-400 rounded-full hover:text-white"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-neon/10 rounded-xl flex items-center justify-center text-neon">
                  <Sparkles size={20} />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tighter italic">Consiglio IA</h3>
              </div>
              
              <h4 className="text-xl font-bold text-white mb-2 leading-tight uppercase tracking-tighter">{activeAlternative.alternative}</h4>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6 font-medium">
                {activeAlternative.reason}
              </p>
              
              {activeAlternative.alternative !== 'Nessuna alternativa disponibile' && (
                <GripButton 
                  onClick={() => {
                    const newEx = [...exercises];
                    if (newEx[activeAlternative.idx]) {
                      newEx[activeAlternative.idx] = {
                        ...newEx[activeAlternative.idx],
                        customName: activeAlternative.alternative,
                        exerciseId: 'AI_REPLACEMENT'
                      };
                      setExercises(newEx);
                    }
                    setActiveAlternative(null);
                  }}
                  className="w-full text-xs"
                >
                  APPLICA VARIANTE
                </GripButton>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
