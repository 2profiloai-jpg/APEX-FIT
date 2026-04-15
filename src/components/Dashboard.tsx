import React, { useState, useEffect } from 'react';
import { UserProfile, WorkoutSession } from '../types';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { Plus, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { calculateBMR, calculateTDEE, calculateTargetKcal, calculateMacros } from '../lib/calculations';

export default function Dashboard({ profile, aiStatus }: { profile: UserProfile | null, aiStatus: 'loading' | 'ready' | 'error' }) {
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);

  useEffect(() => {
    if (aiStatus === 'error') {
      toast.error("IA non configurata", {
        description: "Se sei su Vercel, aggiungi VITE_GEMINI_API_KEY nelle Environment Variables e fai un Redeploy. In AI Studio, usa i Secrets.",
        duration: 8000
      });
    }
  }, [aiStatus]);
  
  // Nutrition State
  const [totalConsumed, setTotalConsumed] = useState(0);
  const [totalProtein, setTotalProtein] = useState(0);
  const [totalCarbs, setTotalCarbs] = useState(0);
  const [totalFat, setTotalFat] = useState(0);

  useEffect(() => {
    if (!profile) return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const docRef = doc(db, `users/${profile.uid}/nutrition/${todayStr}`);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const meals = data.meals || {};
        let todayConsumed = 0;
        let todayPro = 0;
        let todayCarbs = 0;
        let todayFat = 0;
        
        Object.values(meals).forEach((mealArray: any) => {
          if (Array.isArray(mealArray)) {
            mealArray.forEach((item: any) => {
              todayConsumed += (item.kcal || 0);
              todayPro += (item.protein || 0);
              todayCarbs += (item.carbs || 0);
              todayFat += (item.fat || 0);
            });
          }
        });
        
        setTotalConsumed(todayConsumed);
        setTotalProtein(todayPro);
        setTotalCarbs(todayCarbs);
        setTotalFat(todayFat);
      } else {
        setTotalConsumed(0);
        setTotalProtein(0);
        setTotalCarbs(0);
        setTotalFat(0);
      }
    }, (error) => {
      console.error('Firestore Error in Dashboard Nutrition:', error);
    });

    return unsubscribe;
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

  // Calculations
  const weight = profile?.weight || 0;
  const height = profile?.height || 0;
  const age = profile?.age || 0;
  const gender = profile?.gender || 'male';
  const activityLevel = profile?.activityLevel || 1.2;
  const goal = profile?.goal || 'maintain';
  const bodyFat = profile?.bodyFat;

  const bmr = weight && height && age ? calculateBMR(weight, height, age, gender, bodyFat) : 0;
  const tdee = calculateTDEE(bmr, activityLevel);
  const calculatedTargetKcal = calculateTargetKcal(tdee, goal);
  const targetKcal = profile?.customTargets?.kcal || calculatedTargetKcal;
  const macros = calculateMacros(weight, targetKcal);
  const remainingKcal = Math.round(targetKcal - totalConsumed);

  return (
    <div className="space-y-8">
      
      {/* Nutrition Balance Section */}
      <motion.section 
        whileHover={{ scale: 1.01 }}
        className="glass rounded-3xl p-6 space-y-6"
      >
        <div className="flex items-center gap-2 mb-2">
          <Target className="text-blue-500" size={20} />
          <h3 className="font-black uppercase tracking-tighter text-sm italic">Bilancio Giornaliero</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/20 border border-white/10 p-4 rounded-2xl flex flex-col justify-center items-center">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-black">Assunte</span>
            <span className="text-4xl font-black text-white font-mono" style={{ textShadow: '0 0 20px rgba(59,130,246,0.3)' }}>{Math.round(totalConsumed)}</span>
          </div>
          <div className="bg-black/20 border border-white/10 p-4 rounded-2xl flex flex-col justify-center items-center relative overflow-hidden">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-black">Rimanenti</span>
            <span className="text-4xl font-black text-blue-500 font-mono" style={{ textShadow: '0 0 20px rgba(59,130,246,0.5)' }}>{remainingKcal}</span>
            <div className="absolute bottom-0 left-0 h-1.5 bg-white/5 w-full">
              <motion.div 
                className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (totalConsumed / targetKcal) * 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>

        {/* Macros */}
        <div className="bg-black/20 border border-white/10 rounded-2xl p-4 grid grid-cols-3 gap-4 divide-x divide-white/10">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Proteine</span>
            <span className="text-xl font-black text-white font-mono">{Math.round(totalProtein)}<span className="text-xs text-zinc-500">/{macros.protein}g</span></span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Carbo</span>
            <span className="text-xl font-black text-white font-mono">{Math.round(totalCarbs)}<span className="text-xs text-zinc-500">/{macros.carbs}g</span></span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Grassi</span>
            <span className="text-xl font-black text-white font-mono">{Math.round(totalFat)}<span className="text-xs text-zinc-500">/{macros.fat}g</span></span>
          </div>
        </div>
      </motion.section>

      {/* Quick Action */}
      <motion.button 
        whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(59,130,246,0.3)" }}
        whileTap={{ scale: 0.95 }}
        className="w-full py-8 text-2xl bg-blue-500 text-black font-black uppercase italic tracking-tighter rounded-3xl shadow-xl transition-all flex items-center justify-center gap-4"
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
