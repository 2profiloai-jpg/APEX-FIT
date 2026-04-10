import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { WorkoutSession, SessionExercise, WorkoutSet, Exercise, ExerciseCategory, WorkoutPlan } from '../types';
import { X, Plus, Save, Timer, ChevronDown, ChevronUp, Trash2, Play, Pause, RotateCcw } from 'lucide-react';
import GripButton from './ui/GripButton';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { EXERCISE_LIBRARY } from './ExerciseLibrary';
import { cn } from '../lib/utils';

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
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState<ExerciseCategory | null>(null);
  
  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'sessions'), {
        userId: auth.currentUser.uid,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        exercises: exercises
      });
      toast.success('Allenamento salvato con successo!');
      onSessionEnd();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast.error('Errore durante il salvataggio della sessione.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tighter italic uppercase">
            {plan ? plan.name : 'Sessione Attiva'}
          </h2>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2 text-lime-400 text-xl font-mono font-bold">
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
            <div className="bg-lime-400 text-black px-4 py-2 rounded-2xl font-black text-xl animate-pulse">
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
                <h3 className="font-black uppercase tracking-tighter text-lime-400">{exerciseInfo?.name}</h3>
                <button onClick={() => removeExercise(exIdx)} className="text-zinc-500 hover:text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-5 gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 px-2">
                  <div className="col-span-1">Serie</div>
                  <div className="col-span-1">Tipo</div>
                  <div className="col-span-1 text-center">KG</div>
                  <div className="col-span-1 text-center">Reps</div>
                  <div className="col-span-1 text-center">RPE</div>
                </div>

                {ex.sets.map((set, setIdx) => (
                  <div key={setIdx} className="grid grid-cols-5 gap-2 items-center">
                    <div className="col-span-1 font-mono text-sm font-bold text-zinc-600">{setIdx + 1}</div>
                    <div className="col-span-1">
                      <select 
                        value={set.tag}
                        onChange={(e) => updateSet(exIdx, setIdx, 'tag', e.target.value as any)}
                        className="bg-transparent text-[10px] font-bold uppercase text-zinc-400 focus:outline-none"
                      >
                        <option value="Warm-up">Risc.</option>
                        <option value="Working">Allen.</option>
                        <option value="Top">Top</option>
                        <option value="Drop">Drop</option>
                      </select>
                    </div>
                    <input 
                      type="number" 
                      value={set.weight || ''} 
                      onChange={(e) => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value))}
                      className="col-span-1 bg-zinc-800 rounded-lg py-2 text-center font-mono font-bold text-white focus:ring-1 ring-lime-400 outline-none"
                      placeholder="0"
                    />
                    <input 
                      type="number" 
                      value={set.reps || ''} 
                      onChange={(e) => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value))}
                      className="col-span-1 bg-zinc-800 rounded-lg py-2 text-center font-mono font-bold text-white focus:ring-1 ring-lime-400 outline-none"
                      placeholder="0"
                    />
                    <input 
                      type="number" 
                      value={set.rpe || ''} 
                      onChange={(e) => updateSet(exIdx, setIdx, 'rpe', parseInt(e.target.value))}
                      className="col-span-1 bg-zinc-800 rounded-lg py-2 text-center font-mono font-bold text-lime-400 focus:ring-1 ring-lime-400 outline-none"
                      placeholder="7"
                    />
                  </div>
                ))}

                <button 
                  onClick={() => addSet(exIdx)}
                  className="w-full py-2 border border-dashed border-zinc-700 rounded-xl text-zinc-500 text-xs font-bold hover:border-zinc-500 hover:text-zinc-300 transition-all"
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
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-6 font-black uppercase tracking-tighter text-sm focus:ring-1 ring-lime-400 outline-none"
              />
              
              <div className="flex overflow-x-auto pb-2 -mx-2 px-2 gap-2 no-scrollbar">
                {['Petto', 'Schiena', 'Gambe', 'Spalle', 'Bicipiti', 'Tricipiti', 'Core'].map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setPickerCategory(pickerCategory === cat ? null : cat as ExerciseCategory)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap",
                      pickerCategory === cat 
                        ? "bg-lime-400 text-black border-lime-400 shadow-[0_0_10px_rgba(163,230,53,0.2)]" 
                        : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-lime-400 hover:border-lime-400"
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
                  className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-left flex items-center justify-between hover:border-lime-400 transition-colors"
                >
                  <div>
                    <div className="font-black uppercase tracking-tighter">{ex.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{ex.category}</span>
                      <span className="text-[10px] text-zinc-600">•</span>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{ex.equipment}</span>
                    </div>
                  </div>
                  <Plus size={20} className="text-lime-400" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
