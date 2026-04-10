import React, { useState, useEffect } from 'react';
import { UserProfile, WorkoutSession, BiometricLog } from '../types';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Zap, TrendingUp, Clock, ChevronRight, Brain, Dumbbell, Plus, Calculator, Save, User as UserIcon, Target, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { getStrategistAdvice } from '../services/geminiService';
import GripButton from './ui/GripButton';

export default function Dashboard({ profile }: { profile: UserProfile | null }) {
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [advice, setAdvice] = useState<{ readinessScore: number; intensity: string; tip: string } | null>(null);
  
  // Biometric State
  const [weight, setWeight] = useState(profile?.weight || 0);
  const [height, setHeight] = useState(profile?.height || 0);
  const [age, setAge] = useState(profile?.age || 0);
  const [gender, setGender] = useState<'male' | 'female'>(profile?.gender || 'male');
  const [activityLevel, setActivityLevel] = useState(profile?.activityLevel || 1.2);
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>(profile?.goal || 'maintain');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'users', profile.uid, 'sessions'),
      orderBy('startTime', 'desc'),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutSession)));
    });
    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    if (profile && recentSessions.length >= 0) {
      const mockBiometrics: BiometricLog = {
        userId: profile.uid,
        date: new Date().toISOString().split('T')[0],
        hrv: 65,
        sleepHours: 7.5,
        stressLevel: 4
      };
      getStrategistAdvice(recentSessions, mockBiometrics).then(setAdvice);
    }
  }, [profile, recentSessions]);

  const handleSaveBiometrics = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        weight,
        height,
        age,
        gender,
        activityLevel,
        goal
      });
      toast.success('Parametri salvati correttamente!');
    } catch (error) {
      console.error("Errore salvataggio biometria:", error);
      toast.error('Errore durante il salvataggio.');
    } finally {
      setIsSaving(false);
    }
  };

  const calculateCalories = () => {
    if (!weight || !height || !age) return null;
    
    let bmr = 0;
    if (gender === 'male') {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }
    
    const tdee = bmr * activityLevel;
    
    let target = tdee;
    if (goal === 'lose') target = tdee - 500;
    if (goal === 'gain') target = tdee + 500;
    
    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      target: Math.round(target)
    };
  };

  const results = calculateCalories();

  return (
    <div className="space-y-8">
      {/* Biometric Entry Section */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <UserIcon className="text-lime-400" size={20} />
          <h3 className="font-black uppercase tracking-tighter text-sm italic">Parametri Biometrici</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Peso (kg)</label>
            <input 
              type="number" 
              value={weight || ''} 
              onChange={(e) => setWeight(parseFloat(e.target.value))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 font-mono font-bold text-white focus:ring-1 ring-lime-400 outline-none"
              placeholder="0.0"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Altezza (cm)</label>
            <input 
              type="number" 
              value={height || ''} 
              onChange={(e) => setHeight(parseFloat(e.target.value))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 font-mono font-bold text-white focus:ring-1 ring-lime-400 outline-none"
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Età</label>
            <input 
              type="number" 
              value={age || ''} 
              onChange={(e) => setAge(parseInt(e.target.value))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 font-mono font-bold text-white focus:ring-1 ring-lime-400 outline-none"
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Genere</label>
            <div className="flex bg-zinc-800 border border-zinc-700 rounded-xl p-1">
              <button 
                onClick={() => setGender('male')}
                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${gender === 'male' ? 'bg-lime-400 text-black' : 'text-zinc-500'}`}
              >
                M
              </button>
              <button 
                onClick={() => setGender('female')}
                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${gender === 'female' ? 'bg-lime-400 text-black' : 'text-zinc-500'}`}
              >
                F
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Livello di Attività</label>
          <select 
            value={activityLevel}
            onChange={(e) => setActivityLevel(parseFloat(e.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 font-bold text-white focus:ring-1 ring-lime-400 outline-none appearance-none"
          >
            <option value={1.2}>Sedentario (Ufficio)</option>
            <option value={1.375}>Leggero (1-3 allenamenti)</option>
            <option value={1.55}>Moderato (3-5 allenamenti)</option>
            <option value={1.725}>Intenso (6-7 allenamenti)</option>
            <option value={1.9}>Atleta (Lavoro fisico + sport)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Obiettivo</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'lose', label: 'Perdere' },
              { id: 'maintain', label: 'Mantenere' },
              { id: 'gain', label: 'Crescere' }
            ].map(g => (
              <button 
                key={g.id}
                onClick={() => setGoal(g.id as any)}
                className={`py-2.5 rounded-xl text-[10px] font-black uppercase border transition-all ${goal === g.id ? 'bg-lime-400 text-black border-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.2)]' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <GripButton 
          variant="secondary" 
          className="w-full" 
          onClick={handleSaveBiometrics}
          disabled={isSaving}
        >
          <Save size={18} /> {isSaving ? 'SALVATAGGIO...' : 'SALVA PARAMETRI'}
        </GripButton>
      </section>

      {/* Calorie Results Section */}
      <AnimatePresence>
        {results && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 gap-4"
          >
            <div className="bg-lime-400 text-black rounded-3xl p-6 flex items-center justify-between shadow-xl shadow-lime-400/10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Target size={16} />
                  <h3 className="font-black uppercase tracking-tighter text-xs">Target Calorico</h3>
                </div>
                <div className="text-5xl font-black tracking-tighter italic uppercase">
                  {results.target} <span className="text-sm font-bold">kcal</span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-2 opacity-70">
                  Basato sul tuo obiettivo di {goal === 'lose' ? 'dimagrimento' : goal === 'gain' ? 'ipertrofia' : 'mantenimento'}
                </p>
              </div>
              <div className="w-16 h-16 bg-black/10 rounded-2xl flex items-center justify-center">
                <Flame size={32} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Metabolismo Base</div>
                <div className="text-xl font-black italic uppercase tracking-tighter">{results.bmr} <span className="text-[10px] text-zinc-500">kcal</span></div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Fabbisogno TDEE</div>
                <div className="text-xl font-black italic uppercase tracking-tighter">{results.tdee} <span className="text-[10px] text-zinc-500">kcal</span></div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Strategist Advice */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={20} className="text-lime-400" />
          <h3 className="font-black uppercase tracking-tighter text-sm italic text-zinc-400">Consiglio dello Strategista</h3>
        </div>
        <p className="font-bold text-lg leading-tight text-zinc-100 italic">
          "{advice?.tip || 'Analizzando le tue performance recenti per ottimizzare la sessione di oggi...'}"
        </p>
      </section>

      {/* Quick Action */}
      <GripButton 
        variant="accent" 
        className="w-full py-8 text-2xl"
        onClick={() => {
          const event = new CustomEvent('start-workout');
          window.dispatchEvent(event);
        }}
      >
        <Plus size={32} strokeWidth={3} />
        INIZIA ALLENAMENTO
      </GripButton>
    </div>
  );
}
