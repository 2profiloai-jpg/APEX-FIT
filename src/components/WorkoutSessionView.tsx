import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { WorkoutSession, SessionExercise, WorkoutSet, Exercise, ExerciseCategory, WorkoutPlan } from '../types';
import { X, Plus, Save, Timer, ChevronDown, ChevronUp, Trash2, Play, Pause, RotateCcw, Brain, Check } from 'lucide-react';
import GripButton from './ui/GripButton';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { EXERCISE_LIBRARY } from './ExerciseLibrary';
import { cn } from '../lib/utils';
import { getPostWorkoutAdvice } from '../services/geminiService';

const Stepper = ({ value, onChange, step = 1, min = 0, label, disabled }: { value: number, onChange: (v: number) => void, step?: number, min?: number, label?: string, disabled?: boolean }) => {
  return (
    <div className={cn("flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg p-1 h-12 transition-all", !disabled && "focus-within:border-neon focus-within:ring-1 focus-within:ring-neon", disabled && "opacity-50 pointer-events-none")}>
      <button disabled={disabled} onClick={() => onChange(Math.max(min, value - step))} className="w-8 h-full flex items-center justify-center bg-zinc-900 rounded text-zinc-400 active:bg-zinc-800">-</button>
      <div className="flex flex-col items-center justify-center flex-1 h-full">
        <input 
          type="number" 
          value={value === 0 ? '' : value} 
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder="0"
          disabled={disabled}
          className="w-full bg-transparent text-center font-bold text-base leading-none outline-none text-white appearance-none m-0 p-0"
          style={{ WebkitAppearance: 'none', margin: 0 }}
        />
        {label && <span className="text-[8px] text-zinc-500 uppercase leading-none mt-0.5">{label}</span>}
      </div>
      <button disabled={disabled} onClick={() => onChange(value + step)} className="w-8 h-full flex items-center justify-center bg-zinc-900 rounded text-zinc-400 active:bg-zinc-800">+</button>
    </div>
  );
};

export default function WorkoutSessionView({ sessionId, plan, onSessionEnd }: { sessionId?: string | null, plan?: WorkoutPlan | null, onSessionEnd: () => void }) {
  const [exercises, setExercises] = useState<SessionExercise[]>(() => {
    if (plan && plan.exercises) {
      return plan.exercises.map(pe => ({
        exerciseId: pe.exerciseId,
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
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState<ExerciseCategory | null>(null);
  
  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Persistence
  useEffect(() => {
    if (!plan && sessionId === 'new') {
      const saved = localStorage.getItem('apex_active_session');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.exercises && parsed.exercises.length > 0) {
            setExercises(parsed.exercises);
            setTimerSeconds(parsed.timerSeconds || 0);
            toast.info('Sessione precedente recuperata');
          }
        } catch (e) {}
      }
    }
  }, [plan, sessionId]);

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

  const updateSet = (exerciseIndex: number, setIndex: number, field: keyof WorkoutSet, value: any) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets[setIndex] = {
      ...newExercises[exerciseIndex].sets[setIndex],
      [field]: value
    };
    setExercises(newExercises);
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
    
    if (isNowComplete) {
      startRest(90); // Default 90s rest
    }
  };

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      const sessionData = {
        userId: auth.currentUser.uid,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        exercises: exercises
      };
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'sessions'), sessionData);
      localStorage.removeItem('apex_active_session');
      toast.success('Allenamento salvato con successo!');
      
      // Fetch post workout advice
      setShowSummary(true);
      const advice = await getPostWorkoutAdvice(sessionData);
      setPostWorkoutAdvice(advice);
      
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-8 max-w-sm w-full shadow-2xl">
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
        <GripButton onClick={onSessionEnd} className="w-full max-w-sm">
          TORNA ALLA DASHBOARD
        </GripButton>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tighter italic uppercase">
            {plan ? plan.name : 'Sessione Attiva'}
          </h2>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2 text-neon text-xl font-black italic tracking-tighter neon-text">
              <Timer size={20} /> {formatTime(timerSeconds)}
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="p-1.5 bg-zinc-800 rounded-lg text-zinc-300 hover:text-white"
              >
                {isTimerRunning ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button 
                onClick={() => { setTimerSeconds(0); setIsTimerRunning(false); }}
                className="p-1.5 bg-zinc-800 rounded-lg text-zinc-300 hover:text-white"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Rest Timer UI */}
        <div className="flex flex-col items-end">
          {restTimer !== null ? (
            <div className="bg-neon text-black px-4 py-2 rounded-2xl font-black text-xl animate-pulse">
              REST: {formatTime(restTimer)}
            </div>
          ) : (
            <div className="flex gap-2">
              {[60, 90, 120].map(s => (
                <button 
                  key={s}
                  onClick={() => startRest(s)}
                  className="bg-zinc-800 text-zinc-400 text-[10px] font-black px-3 py-2 rounded-xl hover:bg-zinc-700 hover:text-white transition-colors"
                >
                  {s}s
                </button>
              ))}
            </div>
          )}
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mt-1">Recupero</span>
        </div>
        <button onClick={onSessionEnd} className="p-2 bg-zinc-900 rounded-full text-zinc-500 hover:text-white ml-2">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-6">
        {exercises.map((ex, exIdx) => {
          const exerciseInfo = EXERCISE_LIBRARY.find(e => e.id === ex.exerciseId);
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={exIdx} 
              className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden"
            >
              <div className="p-4 bg-zinc-800/50 flex items-center justify-between">
                <h3 className="font-black uppercase tracking-tighter text-neon">{exerciseInfo?.name}</h3>
                <button onClick={() => removeExercise(exIdx)} className="text-zinc-500 hover:text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="space-y-3">
                  {ex.sets.map((set, setIdx) => (
                    <div 
                      key={setIdx} 
                      className={cn(
                        "flex items-end gap-1.5 p-1.5 rounded-xl transition-all border",
                        set.completed 
                          ? "bg-zinc-950/40 border-zinc-900 opacity-60" 
                          : "bg-zinc-900/60 border-zinc-800 shadow-xl shadow-black/40"
                      )}
                    >
                      {/* Serie Number */}
                      <div className="flex flex-col items-center justify-center w-8 mb-2">
                        <span className="text-[6px] font-black uppercase text-zinc-600 mb-0.5 tracking-tighter">SET</span>
                        <span className="font-black text-neon text-sm italic tracking-tighter neon-text leading-none">{setIdx + 1}</span>
                      </div>

                      {/* Weight Input */}
                      <div className="flex-1 flex flex-col gap-1 items-stretch">
                        <span className="text-[6px] font-black uppercase text-zinc-500 text-center tracking-widest">KILI</span>
                        <input 
                          type="number"
                          inputMode="decimal"
                          value={set.weight === 0 ? '' : set.weight}
                          onChange={(e) => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          disabled={set.completed}
                          className="w-full bg-black/50 border border-white/5 rounded-lg h-11 text-center font-black text-base text-white italic tracking-tighter outline-none focus:border-neon/50 transition-colors"
                        />
                      </div>

                      {/* Reps Input */}
                      <div className="flex-1 flex flex-col gap-1 items-stretch">
                        <span className="text-[6px] font-black uppercase text-zinc-500 text-center tracking-widest">REPS</span>
                        <input 
                          type="number"
                          inputMode="numeric"
                          value={set.reps === 0 ? '' : set.reps}
                          onChange={(e) => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                          placeholder="0"
                          disabled={set.completed}
                          className="w-full bg-black/50 border border-white/5 rounded-lg h-11 text-center font-black text-base text-white italic tracking-tighter outline-none focus:border-neon/50 transition-colors"
                        />
                      </div>

                      {/* RPE Select */}
                      <div className="w-10 flex flex-col gap-1">
                        <span className="text-[6px] font-black uppercase text-zinc-500 text-center tracking-widest">RPE</span>
                        <select 
                          value={set.rpe || 0} 
                          onChange={(e) => updateSet(exIdx, setIdx, 'rpe', parseInt(e.target.value))}
                          disabled={set.completed}
                          className="w-full h-11 bg-black/50 border border-white/5 rounded-lg text-center font-black text-xs text-neon italic tracking-tighter appearance-none outline-none focus:border-neon/50"
                        >
                          <option value={0}>-</option>
                          {[1,2,3,4,5,6,7,8,9,10].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>

                      {/* Complete Check */}
                      <div className="w-11">
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
          <Plus size={20} /> ESERCIZIO
        </GripButton>
        <GripButton variant="accent" onClick={handleSave} disabled={isSaving || exercises.length === 0} className="flex-1">
          <Save size={20} /> {isSaving ? 'SALVATAGGIO...' : 'FINISCI'}
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
      </AnimatePresence>
    </div>
  );
}
