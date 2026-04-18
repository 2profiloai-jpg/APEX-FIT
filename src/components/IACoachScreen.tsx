import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { WorkoutSession, WorkoutPlan, UserProfile } from '../types';
import { Brain, Sparkles, AlertTriangle, TrendingUp, Activity, ShieldCheck, ArrowUpCircle, RefreshCcw, Radar, Apple, Settings } from 'lucide-react';
import { getReadyToTrainAdvice } from '../services/smartCoachService';
import { getProactiveFeedback } from '../services/liaService';
import { suggestMealForRemainingMacros } from '../services/geminiService';
import AIPrefModal from './AIPrefModal';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function IACoachScreen({ profile }: { profile: UserProfile | null }) {
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [todayPlans, setTodayPlans] = useState<WorkoutPlan[]>([]);
  const [showAIPref, setShowAIPref] = useState(false);
  
  // Nutrition States
  const [meals, setMeals] = useState<{ [key: string]: { id: string, name: string, kcal: number, carbs?: number, protein?: number, fat?: number }[] }>({
    Colazione: [], Pranzo: [], Spuntino: [], Cena: []
  });
  const [suggestedMeal, setSuggestedMeal] = useState<{ text: string, items: any[] } | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

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
    const selectedDate = new Date().toISOString().split('T')[0];
    const today = weekDays[new Date().getDay()];
    const plansQ = query(
      collection(db, 'users', auth.currentUser.uid, 'plans'),
      where('dayOfWeek', '==', today)
    );
    const unsubPlans = onSnapshot(plansQ, snap => {
      setTodayPlans(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutPlan)));
    });

    // Fetch Nutrition
    const docRef = doc(db, `users/${auth.currentUser.uid}/nutrition/${selectedDate}`);
    const unsubNutrition = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setMeals(docSnap.data().meals || { Colazione: [], Pranzo: [], Spuntino: [], Cena: [] });
      } else {
        setMeals({ Colazione: [], Pranzo: [], Spuntino: [], Cena: [] });
      }
    }, (error) => {
      console.error('Firestore Error:', error);
    });

    return () => {
      unsubSessions();
      unsubPlans();
      unsubNutrition();
    };
  }, []);

  const proactiveFeedback = getProactiveFeedback(recentSessions);

  // Totals for Nutrition
  let totalKcal = 0;
  let totalCarbs = 0;
  let totalProtein = 0;
  let totalFat = 0;

  Object.values(meals).forEach((mealArray: any[]) => {
    mealArray.forEach(item => {
      totalKcal += item.kcal || 0;
      totalCarbs += item.carbs || 0;
      totalProtein += item.protein || 0;
      totalFat += item.fat || 0;
    });
  });

  const weight = profile?.weight || 70;
  const height = profile?.height || 175;
  const age = profile?.age || 30;
  const isFemale = profile?.gender === 'female';
  const bmr = 10 * weight + 6.25 * height - 5 * age + (isFemale ? -161 : 5);
  const activityMultiplier = profile?.activityLevel || 1.55;
  const goalMult = profile?.goal === 'lose' ? 0.8 : profile?.goal === 'gain' ? 1.15 : 1;
  const targetKcal = profile?.customTargets?.kcal || Math.round(bmr * activityMultiplier * goalMult);
  const targetPro = profile?.customTargets?.protein || Math.round(weight * 2.2);
  const targetFat = profile?.customTargets?.fat || Math.round((targetKcal * 0.25) / 9);
  const targetCarbs = profile?.customTargets?.carbs || Math.round((targetKcal - (targetPro * 4) - (targetFat * 9)) / 4);

  const handleAddSuggestedItems = async () => {
    if (!suggestedMeal || !suggestedMeal.items.length || !auth.currentUser) return;
    
    const updatedMeals = { ...meals };

    suggestedMeal.items.forEach(item => {
      const target = item.mealType || 'Spuntino';
      const newItem = {
        id: (Date.now() + Math.random()).toString(),
        name: item.name,
        amount: item.amount,
        kcal: item.kcal,
        carbs: item.carbs || 0,
        protein: item.protein || 0,
        fat: item.fat || 0
      };
      
      if (!updatedMeals[target]) updatedMeals[target] = [];
      updatedMeals[target] = [...updatedMeals[target], newItem];
    });
    
    const selectedDate = new Date().toISOString().split('T')[0];
    await setDoc(doc(db, `users/${auth.currentUser.uid}/nutrition/${selectedDate}`), { meals: updatedMeals }, { merge: true });
    
    setSuggestedMeal(null);
    toast.success(`Suggerimento salvato correttamente nelle varie sezioni!`);
  };

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
        <p className="text-zinc-400 text-sm font-medium">Il tuo hub di analisi biomeccanica e raccomandazioni nutrizionali.</p>
      </div>

      {/* Nutrition Coach */}
      <section className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <Apple size={16} /> ASSISTENTE NUTRIZIONALE
        </h3>
        <div className="p-4 rounded-3xl border border-purple-500/20 bg-purple-500/5 space-y-3 relative overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/0 via-purple-500/5 to-purple-500/0 pointer-events-none" />
           <div className="flex justify-between items-center relative z-10">
             <div className="space-y-1">
               <h3 className="text-xs font-black uppercase tracking-widest text-purple-300 flex items-center gap-2">
                 <Sparkles size={16} /> Raggiungi Le Calorie
               </h3>
             </div>
             
             <button 
               onClick={async () => {
                 setIsSuggesting(true);
                 try {
                   const remKcal = Math.max(0, targetKcal - totalKcal);
                   const remPro = Math.max(0, targetPro - totalProtein);
                   const remCarb = Math.max(0, targetCarbs - totalCarbs);
                   const remFat = Math.max(0, targetFat - totalFat);
                   
                   const pantry = profile?.preferences?.pantry || [];
                   const portions = profile?.preferences?.typicalPortions || '';
                   const favs: any[] = []; 

                   const eatenSummary = Object.entries(meals)
                     .map(([name, list]) => `${name}: ${(list as any[]).length > 0 ? (list as any[]).map(i => i.name).join(', ') : 'Vuoto'}`)
                     .join('\n');

                   const workoutContext = `L'utente è nella schermata coach. Pasti già inseriti oggi: \n${eatenSummary}. \nSuggerisci un pasto logico per l'orario attuale (es. Spuntino o Cena se pomeriggio/sera).`;

                   const suggestion = await suggestMealForRemainingMacros(remKcal, remPro, remCarb, remFat, pantry, favs, workoutContext, targetKcal, portions);
                   setSuggestedMeal(suggestion);
                 } catch (err: any) {
                   toast.error(err.message || "Errore nel generare suggerimenti.");
                 } finally {
                   setIsSuggesting(false);
                 }
               }}
               disabled={isSuggesting}
               className={cn(
                 "text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all flex items-center gap-2",
                 "bg-purple-500 text-black hover:bg-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]" 
               )}
             >
               {isSuggesting ? <Activity size={14} className="animate-spin" /> : 'Suggerisci pasto'}
             </button>
           </div>
           
           {suggestedMeal && (
             <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 relative z-10">
               <div className="text-sm text-zinc-300 font-medium whitespace-pre-line bg-black/40 p-4 rounded-2xl border border-white/5 leading-relaxed shadow-inner">
                 {typeof suggestedMeal === 'string' ? suggestedMeal : suggestedMeal.text}
                 
                 {typeof suggestedMeal !== 'string' && suggestedMeal.items.length > 0 && (
                   <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-widest text-purple-300 mb-2">Lista della spesa / Ingredienti:</div>
                      {suggestedMeal.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white/5 p-2 rounded-xl text-xs">
                          <span className="font-bold text-white">{item.name}</span>
                          <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-lg text-[10px] uppercase font-black">{item.amount || 'q.b.'}</span>
                        </div>
                      ))}
                   </div>
                 )}
               </div>

               {typeof suggestedMeal !== 'string' && suggestedMeal.items.length > 0 && (
                 <div className="flex flex-col gap-2">
                   <button 
                     onClick={() => handleAddSuggestedItems()}
                     className="w-full bg-neon text-black font-black uppercase tracking-widest text-xs px-4 py-3 rounded-xl hover:bg-white transition-all shadow-lg flex items-center justify-center gap-2"
                   >
                     Aggiungi tutto al diario
                   </button>
                 </div>
               )}
             </motion.div>
           )}
        </div>
        <button 
          onClick={() => setShowAIPref(true)}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold uppercase tracking-widest text-[10px] py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <Settings size={14} /> Imposta preferenze cibo
        </button>
      </section>

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

      {/* Modals */}
      <AnimatePresence>
        {showAIPref && (
          <AIPrefModal 
            profile={profile} 
            onClose={() => setShowAIPref(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
