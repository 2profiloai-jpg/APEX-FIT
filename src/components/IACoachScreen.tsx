import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { WorkoutSession, WorkoutPlan, UserProfile } from '../types';
import { Brain, Sparkles, AlertTriangle, TrendingUp, Activity, ShieldCheck, ArrowUpCircle, RefreshCcw, Radar } from 'lucide-react';
import { getReadyToTrainAdvice } from '../services/smartCoachService';
import { getProactiveFeedback } from '../services/liaService';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function IACoachScreen({ profile }: { profile: UserProfile | null }) {
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [todayPlans, setTodayPlans] = useState<WorkoutPlan[]>([]);
  
  useEffect(() => {
    if (!auth.currentUser) return;
    
    // Fetch recent sessions
    const sessionsQ = query(
      collection(db, 'users', auth.currentUser.uid, 'sessions'),
      orderBy('startTime', 'desc'),
      limit(5)
    );
    const unsubSessions = onSnapshot(sessionsQ, snap => {
      setRecentSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutSession)));
    });

    // Fetch today's plans
    const weekDays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const today = weekDays[new Date().getDay()];
    const plansQ = query(
      collection(db, 'users', auth.currentUser.uid, 'plans'),
      where('dayOfWeek', '==', today)
    );
    const unsubPlans = onSnapshot(plansQ, snap => {
      setTodayPlans(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutPlan)));
    });

    return () => {
      unsubSessions();
      unsubPlans();
    };
  }, []);

  const proactiveFeedback = getProactiveFeedback(recentSessions);

  const getCategoryDetails = (type: string) => {
    switch(type) {
      case 'progression': return { title: 'Promozioni e Level Up', Icon: ArrowUpCircle, iconColors: 'text-neon bg-neon/20 border-neon/30', cardColors: 'border-neon/20 bg-neon/5', titleColor: 'text-neon/70' };
      case 'balancing': return { title: 'Recupero e Correzione Rotta', Icon: RefreshCcw, iconColors: 'text-yellow-400 bg-yellow-400/20 border-yellow-400/30', cardColors: 'border-yellow-400/20 bg-yellow-400/5', titleColor: 'text-yellow-400/70' };
      case 'technical': return { title: 'Consigli del Coach', Icon: Radar, iconColors: 'text-red-500 bg-red-500/20 border-red-500/30', cardColors: 'border-red-500/20 bg-red-500/5', titleColor: 'text-red-500/70' };
      default: return { title: 'Insight Prestazionale', Icon: Sparkles, iconColors: 'text-purple-400 bg-purple-500/20 border-purple-500/30', cardColors: 'border-purple-500/20 bg-purple-500/5', titleColor: 'text-purple-300' };
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Brain className="text-neon w-8 h-8" />
          <h2 className="text-3xl font-black tracking-tighter italic uppercase">IA Assistant</h2>
        </div>
        <p className="text-zinc-400 text-sm font-medium">Il tuo hub di analisi biomeccanica e programmazione predittiva.</p>
      </div>

      {/* IA Analysis */}
      <section className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <TrendingUp size={16} /> FEED FEEDBACK DEL COACH
        </h3>
        
        {proactiveFeedback.length > 0 ? (
          <div className="space-y-4">
            {proactiveFeedback.map((fb, idx) => {
              const details = getCategoryDetails(fb.type);
              const Icon = details.Icon;
              
              return (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={cn("p-6 rounded-3xl border flex gap-4", details.cardColors)}
                >
                  <div className={cn("w-10 h-10 shrink-0 rounded-full flex items-center justify-center border", details.iconColors)}>
                    <Icon size={20} />
                  </div>
                  <div className="space-y-2">
                    <h4 className={cn("text-xs font-black uppercase tracking-widest", details.titleColor)}>
                      {details.title}
                    </h4>
                    <p className="text-sm text-zinc-300 font-bold leading-relaxed">{fb.message}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
           <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center justify-center gap-3 text-center">
             <ShieldCheck className="text-zinc-600" size={24} />
             <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
               Nessun dato sufficiente per l'analisi. Completa alcune sessioni.
             </span>
           </div>
        )}
      </section>
    </div>
  );
}
