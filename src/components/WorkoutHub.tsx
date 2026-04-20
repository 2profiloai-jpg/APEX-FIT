import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { WorkoutPlan, PlannedExercise, Exercise, ExerciseCategory, UserProfile } from '../types';
import { Calendar, Plus, Play, Dumbbell, X, ChevronRight, Save, Activity, Brain, AlertCircle, Info, Loader2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EXERCISE_LIBRARY } from './ExerciseLibrary';
import WorkoutSessionView from './WorkoutSessionView';
import GymMapper from './GymMapper';
import GripButton from './ui/GripButton';
import { useBackgroundAI } from '../contexts/BackgroundAIContext';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { getPlanBalanceAnalysis, BalanceScore } from '../services/smartCoachService';
import { generateInstantWorkout } from '../services/geminiService';

export default function WorkoutHub({ profile, requestedPlanId, onClearRequest, onNavigateToLibrary }: { profile: UserProfile | null, requestedPlanId?: string | null, onClearRequest?: () => void, onNavigateToLibrary: (id: string) => void }) {
  const { runInstantWorkout, isTaskPending, tasks, clearTask } = useBackgroundAI();
  const weekDays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const today = weekDays[new Date().getDay()];
  const [selectedDay, setSelectedDay] = useState<string>(today);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [activeSessionPlan, setActiveSessionPlan] = useState<WorkoutPlan | 'free' | null>(null);
  const [showGymMapper, setShowGymMapper] = useState(false);
  const [showFocusPicker, setShowFocusPicker] = useState(false);
  
  useEffect(() => {
    // Listen for completed instant workout generation
    const completedTask = tasks.find(t => t.type === 'instant-workout' && t.status === 'completed' && t.result);
    if (completedTask && profile) {
      const workout = completedTask.result;
      const tempPlan: WorkoutPlan = {
        id: 'instant-' + Date.now(),
        userId: profile.uid,
        name: workout.name || `Allenamento Personalizzato`,
        date: new Date().toISOString().split('T')[0],
        exercises: workout.exercises.map((ex: any) => ({
          exerciseId: 'CUSTOM',
          customName: ex.name,
          targetSets: ex.sets || 3,
          targetReps: ex.reps || '10-12',
          targetEffort: 'MEDIO'
        }))
      };
      setActiveSessionPlan(tempPlan);
      clearTask(completedTask.id);
    }
  }, [tasks, profile, clearTask]);
  
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

  // Recovery of active session
  useEffect(() => {
    const saved = localStorage.getItem('apex_active_session');
    if (saved) {
      // If we have saved session data, jump directly to active session
      setActiveSessionPlan('free'); 
    }
  }, []);

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
      const sanitizedPlannedExercises = plannedExercises.map(pe => {
        const cleaned: any = {
          exerciseId: pe.exerciseId,
          targetSets: pe.targetSets,
          targetReps: pe.targetReps
        };
        if (pe.customName) cleaned.customName = pe.customName;
        if (pe.targetRpe !== undefined) cleaned.targetRpe = pe.targetRpe;
        if (pe.targetEffort !== undefined) cleaned.targetEffort = pe.targetEffort;
        return cleaned;
      });

      await addDoc(collection(db, 'users', auth.currentUser.uid, 'plans'), {
        userId: auth.currentUser.uid,
        name: planName,
        dayOfWeek: selectedDay,
        exercises: sanitizedPlannedExercises
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

  const balance = getPlanBalanceAnalysis(plannedExercises);

  if (activeSessionPlan) {
    return (
      <WorkoutSessionView 
        profile={profile}
        plan={activeSessionPlan === 'free' ? null : activeSessionPlan} 
        onSessionEnd={() => setActiveSessionPlan(null)} 
        onNavigateToLibrary={onNavigateToLibrary}
      />
    );
  }

  if (isBuildingPlan) {
    return (
      <div className="space-y-6">
        <AnimatePresence>
          {showGymMapper && (
            <GymMapper profile={profile} onClose={() => setShowGymMapper(false)} />
          )}
        </AnimatePresence>
        
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
            <div className="text-neon font-bold text-lg">{selectedDay}</div>
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
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-center appearance-none"
                    >
                      {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Reps</label>
                    <select 
                      value={pe.targetReps}
                      onChange={(e) => updatePlannedExercise(idx, 'targetReps', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-center appearance-none"
                    >
                      {['1-5', '6-8', '8-12', '12-15', '15-20', 'Max'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Affaticamento</label>
                    <select 
                      value={pe.targetEffort || 'MEDIO'}
                      onChange={(e) => updatePlannedExercise(idx, 'targetEffort', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-center appearance-none text-[10px] font-black italic text-neon"
                    >
                      <option value="POCO">POCO</option>
                      <option value="MEDIO">MEDIO</option>
                      <option value="GIUSTO">GIUSTO</option>
                      <option value="MOLTO">MOLTO</option>
                      <option value="MOLTISSIMO">MAX</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}

          <button 
            onClick={openExercisePicker}
            className="w-full py-4 border border-white/5 rounded-2xl text-zinc-500 font-bold uppercase tracking-widest hover:border-neon hover:text-neon transition-colors flex items-center justify-center gap-2 bg-white/[0.02]"
          >
            <Plus size={20} /> Aggiungi Esercizio
          </button>
        </div>

        {/* Balance Analyzer */}
        {plannedExercises.length > 0 && (
          <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain size={16} className="text-neon" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Balance Analyzer</h4>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Push', val: balance.pushes },
                { label: 'Pull', val: balance.pulls },
                { label: 'Legs', val: balance.legs },
                { label: 'Core', val: balance.core }
              ].map(b => (
                <div key={b.label} className="bg-black/40 rounded-xl p-2 flex flex-col items-center">
                  <span className="text-[7px] font-black uppercase text-zinc-600 mb-0.5">{b.label}</span>
                  <span className="text-xs font-black text-white italic">{b.val} <span className="text-[8px] not-italic text-zinc-600">set</span></span>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <div className="flex justify-between items-end mb-1">
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Indice Carico Metabolico (ICM)</span>
                <span className={cn(
                  "text-xs font-black italic",
                  balance.metabolicLevel > 4 ? "text-red-500" : balance.metabolicLevel > 2.5 ? "text-yellow-500" : "text-neon"
                )}>
                  {balance.metabolicLevel.toFixed(1)}
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (balance.metabolicLevel / 6) * 100)}%` }}
                  className={cn(
                    "h-full transition-colors",
                    balance.metabolicLevel > 4 ? "bg-red-500" : balance.metabolicLevel > 2.5 ? "bg-yellow-500" : "bg-neon"
                  )}
                />
              </div>
            </div>

            {balance.suggestions.length > 0 && (
              <div className="space-y-2 mt-2">
                {balance.suggestions.map((s, i) => (
                  <div key={i} className="flex gap-2 text-[9px] text-zinc-400 font-bold leading-relaxed bg-white/[0.02] p-2 rounded-lg border border-white/5">
                    <AlertCircle size={10} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
              className="fixed inset-0 z-50 bg-black p-6 flex flex-col thin-scrollbar"
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
              
              <div className="flex gap-2 overflow-x-auto pb-4 mb-4 thin-scrollbar snap-x -mx-2 px-2">
                {(['Petto', 'Schiena', 'Gambe', 'Spalle', 'Bicipiti', 'Tricipiti', 'Core', 'Cardio'] as ExerciseCategory[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setPickerCategory(pickerCategory === cat ? null : cat)}
                    className={cn(
                      "px-5 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap snap-start",
                      pickerCategory === cat 
                        ? "bg-neon text-black border-neon shadow-[0_0_20px_rgba(var(--neon-accent-rgb),0.3)]" 
                        : "bg-white/5 border-white/5 text-zinc-400"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto thin-scrollbar pb-10 cursor-pointer">
                {EXERCISE_LIBRARY
                  .filter(ex => !pickerCategory || ex.category === pickerCategory)
                  .map(ex => (
                  <div key={ex.id} onClick={() => addExerciseToPlan(ex)} className="glass p-4 rounded-2xl flex items-center justify-between active:scale-95 transition-all">
                    <div>
                      <div className="font-black uppercase tracking-tighter text-sm italic">{ex.name}</div>
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

  const handleInstantWorkout = async (focus: string) => {
    if (!profile?.gymInventory || profile.gymInventory.length === 0) {
      toast.error("Mappa prima la tua palestra per usare l'IA!");
      setShowGymMapper(true);
      return;
    }

    const inventoryNames = profile.gymInventory.map(i => i.name);
    await runInstantWorkout({
      focus,
      duration: 45,
      inventory: inventoryNames
    });
    
    setShowFocusPicker(false);
  };

  return (
    <div className="space-y-10 pb-20">
      <AnimatePresence>
        {showGymMapper && (
          <GymMapper profile={profile} onClose={() => setShowGymMapper(false)} />
        )}
      </AnimatePresence>

      {/* LIA RADAR SECTION - COMPACT */}
      <section id="lia-gym-mapping" className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-neon via-blue-500 to-neon rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
        <div className="relative bg-zinc-900 border border-white/5 rounded-[1.8rem] p-4 overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Zap size={60} className="text-neon" />
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neon rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(var(--neon-accent-rgb),0.3)]">
                  <Brain size={22} className="text-black" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-lg font-black italic uppercase tracking-tighter text-white leading-none">Lia Gym IQ</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse flex-shrink-0 shadow-[0_0_8px_rgba(var(--neon-accent-rgb),0.6)]" />
                    <span className="text-[7px] text-neon font-black uppercase tracking-[0.2em] whitespace-nowrap">
                      {profile?.gymInventory?.length ? 'Sistema Online' : 'Configurazione'}
                    </span>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setShowGymMapper(true)}
                className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all flex-shrink-0"
              >
                <Plus size={18} />
              </button>
            </div>

            {!profile?.gymInventory?.length ? (
              <div className="space-y-3">
                <p className="text-[9px] text-zinc-500 font-bold leading-tight uppercase tracking-widest">
                  Mappa la tua palestra per sbloccare le schede.
                </p>
                <GripButton onClick={() => setShowGymMapper(true)} variant="primary" className="w-full h-11 text-xs">
                  MAPPA ORA
                </GripButton>
              </div>
            ) : (
              <div className="space-y-2">
                <GripButton 
                  disabled={isGeneratingInstant}
                  onClick={() => setShowFocusPicker(true)}
                  className="w-full h-12 text-xs flex items-center justify-center gap-3 bg-white/5 border-white/10"
                >
                  <Zap size={18} className="text-neon" />
                  GENERA SCHEDA IA
                </GripButton>
              </div>
            )}
            
            <AnimatePresence>
              {showFocusPicker && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 30 }}
                    animate={{ scale: 1, y: 0 }}
                    className="bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-sm relative"
                  >
                    <button 
                      onClick={() => setShowFocusPicker(false)}
                      className="absolute top-6 right-6 p-2 bg-zinc-800 rounded-full text-zinc-400"
                    >
                      <X size={20} />
                    </button>

                    <div className="mb-8 text-center pt-4">
                      <div className="w-16 h-16 bg-neon/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-neon/30">
                        <Brain size={32} className="text-neon" />
                      </div>
                      <h3 className="text-2xl font-black uppercase tracking-tighter italic">Cosa vuoi allenare?</h3>
                      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">Dimmelo e genererò la scheda ideale</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { label: 'Total Body Mix', focus: 'Corpo Completo (Mix)' },
                        { label: 'Parte Superiore', focus: 'Upper Body (Petto, Dorso, Spalle)' },
                        { label: 'Parte Inferiore', focus: 'Lower Body (Gambe e Polpacci)' },
                        { label: 'Push Day (Spinta)', focus: 'Push Day (Petto, Spalle, Tricipiti)' },
                        { label: 'Pull Day (Trazione)', focus: 'Pull Day (Dorso, Bicipiti)' },
                        { label: 'Addominali & Core', focus: 'Focus Core e Addome' }
                      ].map((opt) => (
                        <button 
                          key={opt.label}
                          onClick={() => handleInstantWorkout(opt.focus)}
                          disabled={isTaskPending('instant-workout')}
                          className="w-full py-5 px-6 rounded-2xl bg-white/[0.03] border border-white/5 text-left flex items-center justify-between hover:bg-neon/10 hover:border-neon/30 active:scale-95 transition-all group disabled:opacity-50"
                        >
                          <span className="text-sm font-black uppercase tracking-tight italic group-hover:text-neon">{opt.label}</span>
                          {isTaskPending('instant-workout') ? (
                            <Activity size={18} className="text-neon animate-spin" />
                          ) : (
                            <ChevronRight size={18} className="text-zinc-700 group-hover:text-neon" />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="mt-8">
                       <p className="text-[10px] text-zinc-600 text-center font-bold uppercase leading-relaxed font-mono">
                         Lia incrocerà i tuoi dati biometrici con la mappa della tua palestra.
                       </p>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {isTaskPending('instant-workout') && (
              <div className="flex items-center justify-center gap-3 py-3 bg-neon/10 rounded-2xl border border-neon/20">
                <Loader2 size={16} className="text-neon animate-spin" />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-neon">Analizzando biomeccanica...</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div>
        <h2 className="text-4xl font-black tracking-tighter italic uppercase mb-8 border-l-4 border-neon pl-4">Programmazione</h2>
        
        {selectedDay === today && plans.length > 0 && (
          <div className="mb-6">
            <div />
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
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{plan.exercises.length} Esercizi</p>
                      <div className="flex items-center gap-1">
                        <Activity size={10} className="text-neon" />
                        <span className="text-[10px] font-black text-neon italic">ICM {getPlanBalanceAnalysis(plan.exercises).metabolicLevel.toFixed(1)}</span>
                      </div>
                    </div>
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
                        <span>{ex.targetSets}x{ex.targetReps}</span>
                      </div>
                    );
                  })}
                  {plan.exercises.length > 3 && (
                    <div className="text-xs text-zinc-600 font-bold uppercase tracking-widest mt-2">
                      + altri {plan.exercises.length - 3} esercizi
                    </div>
                  )}
                </div>

                <motion.button 
                  whileHover={{ scale: 1.01, boxShadow: `0 0 15px rgba(var(--neon-accent-rgb),0.2)` }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveSessionPlan(plan)}
                  className="w-full py-4 bg-neon text-black font-black uppercase italic tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-3 group neon-led"
                >
                  <Play size={18} className="fill-current group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] drop-shadow-sm">Inizia Scheda</span>
                </motion.button>
              </div>
            ))}
          </div>
        )}
      </div>

      {plans.length > 0 && (
        <div className="pt-8">
          <button 
            onClick={() => setActiveSessionPlan('free')}
            className="w-full py-4 border border-white/5 rounded-2xl text-zinc-500 font-bold uppercase tracking-widest hover:border-neon hover:text-neon transition-colors flex items-center justify-center gap-2 bg-white/[0.02]"
          >
            <Dumbbell size={20} /> Inizia Sessione Libera
          </button>
        </div>
      )}
    </div>
  );
}
