import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, orderBy, limit, setDoc } from 'firebase/firestore';
import { WorkoutPlan, PlannedExercise, Exercise, ExerciseCategory, UserProfile, WorkoutSession } from '../types';
import { Calendar, Plus, Play, Dumbbell, X, ChevronRight, Save, Activity, Brain, AlertCircle, Info, Loader2, Zap, Pencil } from 'lucide-react';
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
      const exercisesArray = Array.isArray(workout?.exercises) ? workout.exercises : [];
      
      if (exercisesArray.length > 0) {
        const tempPlan: WorkoutPlan = {
          id: 'instant-' + Date.now(),
          userId: profile.uid,
          name: workout.name || `Allenamento Personalizzato`,
          date: new Date().toISOString().split('T')[0],
          exercises: exercisesArray.map((ex: any) => ({
            exerciseId: 'CUSTOM',
            customName: ex.name || 'Esercizio',
            targetSets: ex.sets || 3,
            targetReps: ex.reps || '10-12',
            targetEffort: 'MEDIO'
          }))
        };
        setActiveSessionPlan(tempPlan);
      } else {
        toast.error("Formato allenamento generato non valido.");
      }
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
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<ExerciseCategory | null>(null);
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);
  const [loadVideo, setLoadVideo] = useState(false);
  const [missedWorkout, setMissedWorkout] = useState<WorkoutPlan | null>(null);

  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('apex_active_session');
    if (saved) {
      setActiveSessionPlan('free'); 
    }
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const qPlans = query(
      collection(db, 'users', auth.currentUser.uid, 'plans'),
      where('dayOfWeek', '==', selectedDay)
    );
    const unsubPlans = onSnapshot(qPlans, (snapshot) => {
      setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutPlan)));
    });

    // MISSING: Fetch ALL plans for missed workout check
    const qAllPlans = query(collection(db, 'users', auth.currentUser.uid, 'plans'));
    const unsubAllPlans = onSnapshot(qAllPlans, (snapshot) => {
      setAllPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutPlan)));
    });

    const qSessions = query(
      collection(db, 'users', auth.currentUser.uid, 'sessions'),
      orderBy('startTime', 'desc'),
      limit(3)
    );
    const unsubSessions = onSnapshot(qSessions, (snapshot) => {
      setRecentSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutSession)));
    });

    return () => {
      unsubPlans();
      unsubAllPlans();
      unsubSessions();
    };
  }, [selectedDay]);

  // And also need to add allPlans state
  const [allPlans, setAllPlans] = useState<WorkoutPlan[]>([]);
  // ... and update the missed workout useEffect to use allPlans instead of plans


  useEffect(() => {
    if (!auth.currentUser || allPlans.length === 0) return;

    const today = new Date();
    const currentDayIndex = today.getDay(); // 0 (Sun) to 6 (Sat)
    const daysMap: Record<string, number> = {
      'Lunedì': 0, 'Martedì': 1, 'Mercoledì': 2, 'Giovedì': 3,
      'Venerdì': 4, 'Sabato': 5, 'Domenica': 6
    };

    const normalizeDay = (idx: number) => (idx === 0 ? 6 : idx - 1); // Converting Sun=0 into Mon=0...Sun=6
    const todayIndexNormalized = normalizeDay(currentDayIndex);

    // Check days before today in the current week
    const missed = allPlans.find(plan => {
      if (!plan.dayOfWeek) return false;
      const planDayNumNormalized = daysMap[plan.dayOfWeek];
      
      const isBeforeToday = planDayNumNormalized < todayIndexNormalized;
      console.log(`Checking plan ${plan.name} (${plan.dayOfWeek}): beforeToday=${isBeforeToday}, todayNorm=${todayIndexNormalized}, planNorm=${planDayNumNormalized}`);
      
      if (isBeforeToday) {
        // Check if a session for this plan exists in the last 7 days
        const wasCompleted = recentSessions.some(session => 
          session.planId === plan.id && 
          new Date(session.startTime).getTime() > today.getTime() - 7 * 24 * 60 * 60 * 1000
        );
        console.log(`Checking session for ${plan.name}: wasCompleted=${wasCompleted}`);
        return !wasCompleted;
      }
      return false;
    });

    setMissedWorkout(missed || null);
  }, [allPlans, recentSessions]);

  const openPlanBuilder = (plan?: WorkoutPlan) => {
    window.history.pushState({ modal: 'planBuilder' }, '');
    if (plan) {
      setEditingPlanId(plan.id);
      setPlanName(plan.name);
      setPlannedExercises(plan.exercises);
      setSelectedDay(plan.dayOfWeek || selectedDay);
    } else {
      setEditingPlanId(null);
      setPlanName('');
      setPlannedExercises([]);
    }
    setIsBuildingPlan(true);
  };

  const openExercisePicker = () => {
    window.history.pushState({ modal: 'exercisePicker' }, '');
    setShowExercisePicker(true);
  };

  const closeExercisePicker = () => {
    setShowExercisePicker(false);
    setPreviewExercise(null);
    setLoadVideo(false);
    if (window.history.state?.modal === 'exercisePicker') {
      window.history.back();
    }
  };

  const closePlanBuilder = () => {
    setIsBuildingPlan(false);
    setEditingPlanId(null);
    setPlanName('');
    setPlannedExercises([]);
    if (window.history.state?.modal === 'planBuilder') {
      window.history.back();
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (previewExercise) {
        setPreviewExercise(null);
        setLoadVideo(false);
      } else if (showExercisePicker) {
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

      const planData = {
        userId: auth.currentUser.uid,
        name: planName,
        dayOfWeek: selectedDay,
        exercises: sanitizedPlannedExercises
      };

      if (editingPlanId) {
        await setDoc(doc(db, 'users', auth.currentUser.uid, 'plans', editingPlanId), planData, { merge: true });
        toast.success('Scheda aggiornata con successo!');
      } else {
        await addDoc(collection(db, 'users', auth.currentUser.uid, 'plans'), planData);
        toast.success('Scheda salvata con successo!');
      }

      setIsBuildingPlan(false);
      setEditingPlanId(null);
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

  const getVideoId = (url?: string) => {
    if (!url) return null;
    return url.split('/').pop();
  };

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
          <h2 className="text-3xl font-black tracking-tighter italic uppercase">{editingPlanId ? 'Modifica Scheda' : 'Crea Scheda'}</h2>
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
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{pe.customName || ex?.name || 'Esercizio'}</span>
                    <button 
                      onClick={() => ex && setPreviewExercise(ex)}
                      className="text-zinc-500 hover:text-neon transition-colors"
                    >
                      <Info size={16} />
                    </button>
                  </div>
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
                  <div key={ex.id} className="glass p-4 rounded-2xl flex items-center justify-between transition-all">
                    <div className="flex-1" onClick={() => addExerciseToPlan(ex)}>
                      <div className="font-black uppercase tracking-tighter text-sm italic">{ex.name}</div>
                      <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                        {ex.targetMuscles.join(', ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewExercise(ex);
                        }}
                        className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white"
                      >
                        <Info size={20} />
                      </button>
                      <button 
                        onClick={() => addExerciseToPlan(ex)}
                        className="w-10 h-10 bg-neon/10 rounded-xl flex items-center justify-center border border-neon/20 active:scale-95 transition-all"
                      >
                        <Plus className="text-neon" size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Preview Modal for Exercise details (accessible from builder and picker) */}
        <AnimatePresence>
          {previewExercise && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex flex-col justify-end sm:p-6"
            >
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-zinc-900 border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 w-full max-w-lg mx-auto relative overflow-hidden max-h-[92vh] overflow-y-auto no-scrollbar"
              >
                {/* Mobile Handle */}
                <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6 sm:hidden" />
                
                <div className="absolute top-0 right-0 w-32 h-32 bg-neon/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                
                <button 
                  onClick={() => {
                    setPreviewExercise(null);
                    setLoadVideo(false);
                  }}
                  className="absolute top-6 sm:top-10 right-6 p-2.5 bg-zinc-800/80 rounded-full text-zinc-400 hover:text-white z-10 transition-colors"
                >
                  <X size={20} />
                </button>

                <div className="mb-6 mt-2 sm:mt-4">
                  <div className="text-neon text-[10px] font-black uppercase tracking-[0.2em] mb-2">{previewExercise.category}</div>
                  <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter italic leading-none pr-10">{previewExercise.name}</h3>
                  {previewExercise.type && (
                    <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                      <Activity size={12} className="text-neon" />
                      <span>Focus: {previewExercise.type}</span>
                    </div>
                  )}
                </div>

                {/* Video Player Module - Optimized for mobile aspect ratio */}
                {previewExercise.videoUrl && (
                  <div className="mb-6">
                    <div className="w-full aspect-video bg-zinc-950 rounded-2xl overflow-hidden border border-white/5 relative group shadow-2xl">
                      {loadVideo ? (
                        <iframe 
                          key={previewExercise.id}
                          src={`${previewExercise.videoUrl.replace('youtube.com', 'youtube-nocookie.com')}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
                          className="w-full h-full border-0"
                          title={previewExercise.name}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                          allowFullScreen
                        ></iframe>
                      ) : (
                        <div 
                          onClick={() => setLoadVideo(true)}
                          className="w-full h-full cursor-pointer relative flex items-center justify-center p-2"
                        >
                          <img 
                            src={`https://img.youtube.com/vi/${getVideoId(previewExercise.videoUrl)}/mqdefault.jpg`}
                            alt={previewExercise.name}
                            className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-all duration-300 rounded-xl"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                          <motion.div 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="absolute w-14 h-14 bg-neon rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(var(--neon-accent-rgb),0.6)] z-10"
                          >
                            <Play size={28} className="text-black fill-current ml-1" />
                          </motion.div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Muscoli Target</h4>
                    <div className="flex flex-wrap gap-2">
                      {previewExercise.targetMuscles.map(m => (
                        <span key={m} className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-xl text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  {previewExercise.instructions && (
                    <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Esecuzione</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                        {previewExercise.instructions}
                      </p>
                    </div>
                  )}

                  {previewExercise.proNote && (
                    <div className="bg-neon/5 border border-neon/10 rounded-2xl p-4 flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neon/10 flex items-center justify-center flex-shrink-0">
                        <Brain size={18} className="text-neon" />
                      </div>
                      <div>
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-neon mb-1">AI Pro Tip</h5>
                        <p className="text-[11px] text-zinc-300 font-bold leading-normal">
                          {previewExercise.proNote}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 pb-8 sm:pb-4">
                  <button 
                    onClick={() => {
                      addExerciseToPlan(previewExercise);
                      setPreviewExercise(null);
                      setLoadVideo(false);
                    }}
                    className="w-full py-4.5 bg-neon text-black font-black uppercase italic tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-95 shadow-[0_10px_20px_rgba(var(--neon-accent-rgb),0.2)]"
                  >
                    <Plus size={20} />
                    <span className="text-[11px]">Aggiungi alla Scheda</span>
                  </button>
                </div>
              </motion.div>
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
                  disabled={isTaskPending('instant-workout')}
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
        
        {/* Missed Workout Recovery Alert */}
        <AnimatePresence>
          {missedWorkout && selectedDay === today && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 p-1 rounded-[2rem] bg-gradient-to-r from-orange-500/20 via-orange-500/10 to-transparent border border-orange-500/20"
            >
              <div className="bg-zinc-900/40 backdrop-blur-xl rounded-[1.8rem] p-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="text-orange-500" size={24} />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-orange-500/70 mb-1">Recupero Suggerito</div>
                  <h4 className="text-sm font-black uppercase tracking-tighter italic leading-tight">Recupero allenamento di {missedWorkout.dayOfWeek}</h4>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mt-0.5">{missedWorkout.name}</p>
                </div>
                <button 
                  onClick={() => setActiveSessionPlan(missedWorkout)}
                  className="px-4 py-2.5 bg-orange-500 text-black text-[10px] font-black uppercase italic rounded-xl hover:bg-orange-400 transition-colors shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                >
                  Recupera
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
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
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => openPlanBuilder(plan)} 
                      className="p-2 bg-white/5 rounded-lg text-zinc-400 hover:text-neon hover:bg-neon/10 transition-colors"
                      title="Modifica"
                    >
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDeletePlan(plan.id)} className="text-zinc-600 hover:text-red-400 p-2 bg-white/5 rounded-lg transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2 mb-6">
                  {plan.exercises.slice(0, 3).map((ex, i) => {
                    const exerciseDetails = EXERCISE_LIBRARY.find(e => e.id === ex.exerciseId);
                    return (
                      <div key={i} className="text-sm text-zinc-400 flex justify-between">
                        <span>{ex.customName || exerciseDetails?.name || 'Esercizio'}</span>
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

      {/* Storico Recenti */}
      {recentSessions.length > 0 && (
        <div className="pt-10">
          <h3 className="text-xl font-black italic uppercase mb-4 text-zinc-400 border-l-4 border-zinc-600 pl-4">Ultime Sessioni</h3>
          <div className="space-y-3">
            {recentSessions.map(session => (
              <div key={session.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-black text-white italic tracking-widest uppercase">{session.planName || 'Sessione Libera'}</span>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase">{new Date(session.startTime).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                  <span>{session.exercises.length} Esercizi</span>
                  <span>{Math.floor((session.duration || 0) / 60)} min</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
