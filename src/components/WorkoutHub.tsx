import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { WorkoutPlan, PlannedExercise, Exercise, ExerciseCategory } from '../types';
import { Calendar, Plus, Play, Dumbbell, X, ChevronRight, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EXERCISE_LIBRARY } from './ExerciseLibrary';
import WorkoutSessionView from './WorkoutSessionView';
import GripButton from './ui/GripButton';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export default function WorkoutHub({ requestedPlanId, onClearRequest }: { requestedPlanId?: string | null, onClearRequest?: () => void }) {
  const weekDays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const today = weekDays[new Date().getDay()];
  const [selectedDay, setSelectedDay] = useState<string>(today);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [activeSessionPlan, setActiveSessionPlan] = useState<WorkoutPlan | 'free' | null>(null);
  
  useEffect(() => {
    if (requestedPlanId && plans.length > 0) {
      const plan = plans.find(p => p.id === requestedPlanId);
      if (plan) {
        setActiveSessionPlan(plan);
        onClearRequest?.();
      }
    }
  }, [requestedPlanId, plans, onClearRequest]);
  
  // Plan Builder State
  const [isBuildingPlan, setIsBuildingPlan] = useState(false);
  const [planName, setPlanName] = useState('');
  const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<ExerciseCategory | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'users', auth.currentUser.uid, 'plans'),
      where('dayOfWeek', '==', selectedDay)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutPlan)));
    }, (error) => {
      console.error('Firestore Error in WorkoutHub Plans:', error);
    });
    return unsubscribe;
  }, [selectedDay]);

  const openPlanBuilder = () => {
    window.history.pushState({ modal: 'planBuilder' }, '');
    setIsBuildingPlan(true);
  };

  const openExercisePicker = () => {
    window.history.pushState({ modal: 'exercisePicker' }, '');
    setShowExercisePicker(true);
  };

  const closeExercisePicker = () => {
    setShowExercisePicker(false);
    if (window.history.state?.modal === 'exercisePicker') {
      window.history.back();
    }
  };

  const closePlanBuilder = () => {
    setIsBuildingPlan(false);
    if (window.history.state?.modal === 'planBuilder') {
      window.history.back();
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (showExercisePicker) {
        setShowExercisePicker(false);
      } else if (isBuildingPlan) {
        setIsBuildingPlan(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showExercisePicker, isBuildingPlan]);

  const handleSavePlan = async () => {
    if (!auth.currentUser) return;
    if (!planName.trim()) {
      toast.error('Inserisci un nome per la scheda');
      return;
    }
    if (plannedExercises.length === 0) {
      toast.error('Aggiungi almeno un esercizio');
      return;
    }

    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'plans'), {
        userId: auth.currentUser.uid,
        name: planName,
        dayOfWeek: selectedDay,
        exercises: plannedExercises
      });
      toast.success('Scheda salvata con successo!');
      setIsBuildingPlan(false);
      setPlanName('');
      setPlannedExercises([]);
    } catch (error) {
      console.error("Errore salvataggio scheda:", error);
      toast.error('Errore durante il salvataggio della scheda.');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'plans', planId));
      toast.success('Scheda eliminata');
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast.error('Errore durante l\'eliminazione');
    }
  };

  const addExerciseToPlan = (exercise: Exercise) => {
    setPlannedExercises([...plannedExercises, {
      exerciseId: exercise.id,
      targetSets: 3,
      targetReps: '8-12',
      targetRpe: 8
    }]);
    setShowExercisePicker(false);
  };

  const updatePlannedExercise = (index: number, field: keyof PlannedExercise, value: any) => {
    const newEx = [...plannedExercises];
    newEx[index] = { ...newEx[index], [field]: value };
    setPlannedExercises(newEx);
  };

  const removePlannedExercise = (index: number) => {
    setPlannedExercises(plannedExercises.filter((_, i) => i !== index));
  };

  if (activeSessionPlan) {
    return (
      <WorkoutSessionView 
        plan={activeSessionPlan === 'free' ? null : activeSessionPlan} 
        onSessionEnd={() => setActiveSessionPlan(null)} 
      />
    );
  }

  if (isBuildingPlan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-black tracking-tighter italic uppercase">Crea Scheda</h2>
          <button onClick={closePlanBuilder} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Nome Scheda</label>
            <input 
              type="text" 
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="es. Push Day, Total Body..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Giorno</label>
            <div className="text-neon font-mono font-bold text-lg">{selectedDay}</div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-black italic uppercase">Esercizi</h3>
          {plannedExercises.map((pe, idx) => {
            const ex = EXERCISE_LIBRARY.find(e => e.id === pe.exerciseId);
            return (
              <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">{ex?.name}</span>
                  <button onClick={() => removePlannedExercise(idx)} className="text-red-400 hover:text-red-300">
                    <X size={20} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Serie</label>
                    <select 
                      value={pe.targetSets}
                      onChange={(e) => updatePlannedExercise(idx, 'targetSets', parseInt(e.target.value) || 0)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-center font-mono appearance-none"
                    >
                      {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Reps</label>
                    <select 
                      value={pe.targetReps}
                      onChange={(e) => updatePlannedExercise(idx, 'targetReps', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-center font-mono appearance-none"
                    >
                      {['1-5', '6-8', '8-12', '12-15', '15-20', 'Max'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">RPE</label>
                    <select 
                      value={pe.targetRpe || 8}
                      onChange={(e) => updatePlannedExercise(idx, 'targetRpe', parseInt(e.target.value) || 0)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-center font-mono appearance-none"
                    >
                      {[1,2,3,4,5,6,7,8,9,10].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}

          <button 
            onClick={openExercisePicker}
            className="w-full py-4 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-500 font-bold uppercase tracking-widest hover:border-neon hover:text-neon transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={20} /> Aggiungi Esercizio
          </button>
        </div>

        <GripButton onClick={handleSavePlan} icon={<Save size={20} />} variant="primary">
          Salva Scheda
        </GripButton>

        {/* Exercise Picker Modal */}
        <AnimatePresence>
          {showExercisePicker && (
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 bg-black p-6 flex flex-col no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Plus className="text-neon" size={24} />
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic">Seleziona Esercizio</h3>
                </div>
                <button 
                  onClick={closeExercisePicker}
                  className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-4 mb-4 no-scrollbar -mx-2 px-2">
                {(['Petto', 'Schiena', 'Gambe', 'Spalle', 'Bicipiti', 'Tricipiti', 'Core', 'Cardio'] as ExerciseCategory[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setPickerCategory(pickerCategory === cat ? null : cat)}
                    className={cn(
                      "px-5 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                      pickerCategory === cat 
                        ? "bg-neon text-black border-neon shadow-[0_0_20px_rgba(var(--neon-accent-rgb),0.3)]" 
                        : "bg-white/5 border-white/5 text-zinc-400"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar pb-10">
                {EXERCISE_LIBRARY
                  .filter(ex => !pickerCategory || ex.category === pickerCategory)
                  .map(ex => (
                  <div key={ex.id} onClick={() => addExerciseToPlan(ex)} className="glass p-4 rounded-2xl flex items-center justify-between active:scale-95 transition-all">
                    <div>
                      <div className="font-black uppercase tracking-tighter text-sm italic">{ex.name}</div>
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{ex.targetMuscles.slice(0, 2).join(', ')}...</div>
                    </div>
                    <div className="w-10 h-10 bg-neon/10 rounded-xl flex items-center justify-center border border-neon/20">
                      <Plus className="text-neon" size={20} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black tracking-tighter italic uppercase mb-6">Programmazione</h2>
        
        {selectedDay === today && plans.length > 0 && (
          <div className="mb-8">
            <button 
              onClick={() => setActiveSessionPlan(plans[0])}
              className="w-full bg-neon text-black p-6 rounded-3xl shadow-[0_0_40px_rgba(var(--neon-accent-rgb),0.3)] hover:scale-[1.02] active:scale-95 transition-all flex flex-col items-center justify-center gap-2 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              <Play size={32} className="fill-current relative z-10" />
              <span className="text-2xl font-black tracking-tighter italic uppercase relative z-10">Inizia Sessione</span>
              <span className="text-xs font-bold uppercase tracking-widest opacity-80 relative z-10">{plans[0].name}</span>
            </button>
          </div>
        )}

        {/* Date Selector */}
        <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar snap-x">
          {weekDays.map(day => {
            const isSelected = day === selectedDay;
            const isToday = day === today;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "flex-shrink-0 snap-center flex flex-col items-center justify-center min-w-[90px] h-[60px] rounded-2xl transition-colors border",
                  isSelected ? "bg-neon text-black border-neon" : "bg-zinc-900 text-zinc-400 border-zinc-800"
                )}
              >
                <span className="text-xs font-bold uppercase tracking-widest">
                  {day.substring(0, 3)}
                </span>
                {isToday && (
                  <span className={cn("text-[9px] font-black uppercase tracking-widest mt-1", isSelected ? "text-black/70" : "text-neon")}>
                    Oggi
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black italic uppercase">Schede per {selectedDay}</h3>
          {plans.length > 0 && (
            <button onClick={openPlanBuilder} className="text-neon hover:text-neon/80 flex items-center gap-1 text-xs font-bold uppercase tracking-widest">
              <Plus size={16} /> Nuova
            </button>
          )}
        </div>

        {plans.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto">
              <Dumbbell className="text-zinc-500 w-10 h-10" />
            </div>
            <div>
              <h4 className="text-xl font-black italic uppercase mb-2">Giorno di Riposo?</h4>
              <p className="text-zinc-400 text-sm">Nessuna scheda programmata per {selectedDay}. Puoi creare una nuova scheda o iniziare una sessione libera.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={openPlanBuilder}
                className="bg-neon text-black font-bold px-6 py-4 rounded-2xl uppercase tracking-widest text-sm w-full flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                <Plus size={18} /> Crea Scheda
              </button>
              <button 
                onClick={() => setActiveSessionPlan('free')}
                className="bg-zinc-800 text-white font-bold px-6 py-4 rounded-2xl uppercase tracking-widest text-sm w-full flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                <Play size={18} /> Sessione Libera
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map(plan => (
              <div key={plan.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-neon/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-2xl font-black italic uppercase">{plan.name}</h4>
                    <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">{plan.exercises.length} Esercizi</p>
                  </div>
                  <button onClick={() => handleDeletePlan(plan.id)} className="text-zinc-600 hover:text-red-400">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-2 mb-6">
                  {plan.exercises.slice(0, 3).map((ex, i) => {
                    const exerciseDetails = EXERCISE_LIBRARY.find(e => e.id === ex.exerciseId);
                    return (
                      <div key={i} className="text-sm text-zinc-400 flex justify-between">
                        <span>{exerciseDetails?.name || 'Esercizio'}</span>
                        <span className="font-mono">{ex.targetSets}x{ex.targetReps}</span>
                      </div>
                    );
                  })}
                  {plan.exercises.length > 3 && (
                    <div className="text-xs text-zinc-600 font-bold uppercase tracking-widest mt-2">
                      + altri {plan.exercises.length - 3} esercizi
                    </div>
                  )}
                </div>

                <GripButton onClick={() => setActiveSessionPlan(plan)} icon={<Play size={20} />} variant="primary">
                  Inizia Scheda
                </GripButton>
              </div>
            ))}
          </div>
        )}
      </div>

      {plans.length > 0 && (
        <div className="pt-8">
          <button 
            onClick={() => setActiveSessionPlan('free')}
            className="w-full py-4 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-500 font-bold uppercase tracking-widest hover:border-neon hover:text-neon transition-colors flex items-center justify-center gap-2"
          >
            <Dumbbell size={20} /> Inizia Sessione Libera
          </button>
        </div>
      )}
    </div>
  );
}
