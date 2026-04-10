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

export default function WorkoutHub() {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [activeSessionPlan, setActiveSessionPlan] = useState<WorkoutPlan | 'free' | null>(null);
  
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
      where('date', '==', selectedDate)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutPlan)));
    });
    return unsubscribe;
  }, [selectedDate]);

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
        date: selectedDate,
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

  // Generate next 7 days for the date picker
  const dates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) return 'Oggi';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Domani';
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
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
          <button onClick={() => setIsBuildingPlan(false)} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white">
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
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lime-400"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Data</label>
            <div className="text-lime-400 font-mono font-bold text-lg">{formatDateLabel(selectedDate)} ({selectedDate})</div>
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
                    <input 
                      type="number" 
                      value={pe.targetSets}
                      onChange={(e) => updatePlannedExercise(idx, 'targetSets', parseInt(e.target.value) || 0)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Reps</label>
                    <input 
                      type="text" 
                      value={pe.targetReps}
                      onChange={(e) => updatePlannedExercise(idx, 'targetReps', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">RPE</label>
                    <input 
                      type="number" 
                      value={pe.targetRpe}
                      onChange={(e) => updatePlannedExercise(idx, 'targetRpe', parseInt(e.target.value) || 0)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-center font-mono"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <button 
            onClick={() => setShowExercisePicker(true)}
            className="w-full py-4 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-500 font-bold uppercase tracking-widest hover:border-lime-400 hover:text-lime-400 transition-colors flex items-center justify-center gap-2"
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
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed inset-0 z-50 bg-zinc-950 p-4 overflow-y-auto pb-24"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black italic uppercase">Seleziona Esercizio</h3>
                <button onClick={() => setShowExercisePicker(false)} className="p-2 bg-zinc-900 rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-4 mb-4 hide-scrollbar">
                {(['Petto', 'Schiena', 'Gambe', 'Spalle', 'Bicipiti', 'Tricipiti', 'Core'] as ExerciseCategory[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setPickerCategory(pickerCategory === cat ? null : cat)}
                    className={`px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm transition-colors ${pickerCategory === cat ? 'bg-lime-400 text-black' : 'bg-zinc-900 text-zinc-400'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {EXERCISE_LIBRARY
                  .filter(ex => !pickerCategory || ex.category === pickerCategory)
                  .map(ex => (
                  <div key={ex.id} onClick={() => addExerciseToPlan(ex)} className="bg-zinc-900 p-4 rounded-2xl flex items-center justify-between active:scale-95 transition-transform">
                    <div>
                      <div className="font-bold">{ex.name}</div>
                      <div className="text-xs text-zinc-500">{ex.targetMuscles.join(', ')}</div>
                    </div>
                    <Plus className="text-lime-400" size={20} />
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
        
        {/* Date Selector */}
        <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar">
          {dates.map(dateStr => {
            const isSelected = dateStr === selectedDate;
            const d = new Date(dateStr);
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex flex-col items-center justify-center min-w-[70px] h-[80px] rounded-2xl transition-colors ${isSelected ? 'bg-lime-400 text-black' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}
              >
                <span className="text-xs font-bold uppercase tracking-widest mb-1">
                  {d.toLocaleDateString('it-IT', { weekday: 'short' })}
                </span>
                <span className="text-2xl font-black">
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black italic uppercase">Schede per {formatDateLabel(selectedDate)}</h3>
        </div>

        {plans.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="text-zinc-500 w-8 h-8" />
            </div>
            <p className="text-zinc-400 font-medium">Nessuna scheda programmata per questo giorno.</p>
            <button 
              onClick={() => setIsBuildingPlan(true)}
              className="bg-lime-400 text-black font-bold px-6 py-3 rounded-full uppercase tracking-widest text-sm w-full"
            >
              Crea Scheda
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map(plan => (
              <div key={plan.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-lime-400/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
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

      <div className="pt-8 border-t border-zinc-800">
        <h3 className="text-xl font-black italic uppercase mb-4">Sessione Rapida</h3>
        <p className="text-zinc-500 text-sm mb-4">Inizia un allenamento senza una scheda preimpostata.</p>
        <GripButton onClick={() => setActiveSessionPlan('free')} icon={<Dumbbell size={20} />} variant="secondary">
          Sessione Libera
        </GripButton>
      </div>
    </div>
  );
}
