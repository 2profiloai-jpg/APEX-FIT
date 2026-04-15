import React, { useState, useEffect } from 'react';
import { UserProfile, WorkoutSession, BiometricLog } from '../types';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Zap, TrendingUp, Clock, ChevronRight, Brain, Dumbbell, Plus, Calculator, Save, User as UserIcon, Target, Flame, X, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import { getStrategistAdvice, parseFoodInput, isAIReady } from '../services/geminiService';
import GripButton from './ui/GripButton';

export default function Dashboard({ profile, aiStatus }: { profile: UserProfile | null, aiStatus: 'loading' | 'ready' | 'error' }) {
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [advice, setAdvice] = useState<{ readinessScore: number; intensity: string; tip: string } | null>(null);

  useEffect(() => {
    if (aiStatus === 'error') {
      toast.error("Chiave API Gemini non trovata.", {
        description: "Se l'hai appena aggiunta, ricarica. Se usi il link condiviso, devi ricondividere l'app per aggiornarla.",
        duration: 8000
      });
    }
  }, [aiStatus]);
  
  // Biometric State
  const [weight, setWeight] = useState(profile?.weight || 0);
  const [height, setHeight] = useState(profile?.height || 0);
  const [age, setAge] = useState(profile?.age || 0);
  const [gender, setGender] = useState<'male' | 'female'>(profile?.gender || 'male');
  const [activityLevel, setActivityLevel] = useState(profile?.activityLevel || 1.2);
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>(profile?.goal || 'maintain');
  const [bodyFat, setBodyFat] = useState(profile?.bodyFat || 0);
  const [isSaving, setIsSaving] = useState(false);

  const [totalConsumed, setTotalConsumed] = useState(0);

  useEffect(() => {
    if (!profile) return;
    
    // We only need today's consumed calories for the Strategist
    const todayStr = new Date().toISOString().split('T')[0];
    const docRef = doc(db, `users/${profile.uid}/nutrition/${todayStr}`);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const meals = data.meals || {};
        let todayConsumed = 0;
        
        Object.values(meals).forEach((mealArray: any) => {
          if (Array.isArray(mealArray)) {
            todayConsumed += mealArray.reduce((sum: number, item: any) => sum + (item.kcal || 0), 0);
          }
        });
        
        setTotalConsumed(todayConsumed);
      } else {
        setTotalConsumed(0);
      }
    }, (error) => {
      console.error('Firestore Error in Dashboard Nutrition:', error);
    });

    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    if (profile) {
      if (profile.weight) setWeight(profile.weight);
      if (profile.height) setHeight(profile.height);
      if (profile.age) setAge(profile.age);
      if (profile.gender) setGender(profile.gender);
      if (profile.activityLevel) setActivityLevel(profile.activityLevel);
      if (profile.goal) setGoal(profile.goal);
      if (profile.bodyFat) setBodyFat(profile.bodyFat);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(
      collection(db, 'users', profile.uid, 'sessions'),
      orderBy('startTime', 'desc'),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutSession)));
    }, (error) => {
      console.error('Firestore Error in Dashboard Sessions:', error);
    });
    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    if (profile && recentSessions.length >= 0) {
      const timer = setTimeout(() => {
        const mockBiometrics: BiometricLog = {
          userId: profile.uid,
          date: new Date().toISOString().split('T')[0],
          hrv: 65,
          sleepHours: 7.5,
          stressLevel: 4
        };
        
        let bmr = 0;
        if (gender === 'male') {
          bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
        } else {
          bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
        }
        const tdee = Math.round(bmr * activityLevel);
        const target = goal === 'lose' ? tdee - 500 : goal === 'gain' ? tdee + 300 : tdee;

        getStrategistAdvice(recentSessions, mockBiometrics, {
          consumed: totalConsumed,
          target: target,
          goal: goal
        }).then(setAdvice);
      }, 2000); // Debounce di 2 secondi

      return () => clearTimeout(timer);
    }
  }, [profile, recentSessions, totalConsumed, weight, height, age, gender, activityLevel, goal]);

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
        goal,
        bodyFat
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

  return (
    <div className="space-y-8">
      {/* Biometric Entry Section */}
      <motion.section 
        whileHover={{ scale: 1.01 }}
        className="glass rounded-3xl p-6 space-y-6"
      >
        <div className="flex items-center gap-2 mb-2">
          <UserIcon className="text-cyan-400" size={20} />
          <h3 className="font-black uppercase tracking-tighter text-sm italic">Parametri Biometrici</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Peso (kg)</label>
            <input 
              type="number" 
              value={weight || ''} 
              onChange={(e) => setWeight(parseFloat(e.target.value))}
              className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 font-mono font-bold text-white focus:ring-2 ring-cyan-400/50 outline-none transition-all"
              placeholder="0.0"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Altezza (cm)</label>
            <input 
              type="number" 
              value={height || ''} 
              onChange={(e) => setHeight(parseFloat(e.target.value))}
              className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 font-mono font-bold text-white focus:ring-2 ring-cyan-400/50 outline-none transition-all"
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Età</label>
            <input 
              type="number" 
              value={age || ''} 
              onChange={(e) => setAge(parseInt(e.target.value))}
              className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 font-mono font-bold text-white focus:ring-2 ring-cyan-400/50 outline-none transition-all"
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Body Fat (%)</label>
            <input 
              type="number" 
              value={bodyFat || ''} 
              onChange={(e) => setBodyFat(parseFloat(e.target.value))}
              className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 font-mono font-bold text-white focus:ring-2 ring-cyan-400/50 outline-none transition-all"
              placeholder="Opzionale"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Genere</label>
            <div className="flex bg-black/20 border border-white/10 rounded-xl p-1">
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setGender('male')}
                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${gender === 'male' ? 'bg-cyan-400 text-black shadow-lg' : 'text-zinc-500'}`}
              >
                M
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setGender('female')}
                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${gender === 'female' ? 'bg-cyan-400 text-black shadow-lg' : 'text-zinc-500'}`}
              >
                F
              </motion.button>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Livello di Attività</label>
          <select 
            value={activityLevel}
            onChange={(e) => setActivityLevel(parseFloat(e.target.value))}
            className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 font-bold text-white focus:ring-2 ring-cyan-400/50 outline-none appearance-none transition-all"
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
              <motion.button 
                key={g.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setGoal(g.id as any)}
                className={`py-2.5 rounded-xl text-[10px] font-black uppercase border transition-all ${goal === g.id ? 'bg-cyan-400 text-black border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)]' : 'bg-black/20 border-white/5 text-zinc-500'}`}
              >
                {g.label}
              </motion.button>
            ))}
          </div>
        </div>

        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSaveBiometrics}
          disabled={isSaving}
          className="w-full py-4 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-cyan-400 transition-all disabled:opacity-50"
        >
          {isSaving ? <Clock className="animate-spin" size={16} /> : <Save size={16} />}
          {isSaving ? 'SALVATAGGIO...' : 'SALVA PARAMETRI'}
        </motion.button>
      </motion.section>

      {/* Strategist Advice */}
      <motion.section 
        whileHover={{ scale: 1.01 }}
        className="glass rounded-3xl p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <div className="flex items-center gap-2 mb-3 relative z-10">
          <Brain size={20} className="text-purple-400" />
          <h3 className="font-black uppercase tracking-tighter text-sm italic text-zinc-400">Consiglio dello Strategista</h3>
        </div>
        <p className="font-bold text-lg leading-tight text-zinc-100 italic relative z-10">
          "{advice?.tip || 'Analizzando le tue performance recenti per ottimizzare la sessione di oggi...'}"
        </p>
      </motion.section>

      {/* Quick Action */}
      <motion.button 
        whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(34,211,238,0.3)" }}
        whileTap={{ scale: 0.95 }}
        className="w-full py-8 text-2xl bg-cyan-400 text-black font-black uppercase italic tracking-tighter rounded-3xl shadow-xl transition-all flex items-center justify-center gap-4"
        onClick={() => {
          const event = new CustomEvent('start-workout');
          window.dispatchEvent(event);
        }}
      >
        <Plus size={32} strokeWidth={3} />
        INIZIA ALLENAMENTO
      </motion.button>
    </div>
  );
}
