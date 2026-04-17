import React, { useState, useEffect } from 'react';
import { UserProfile, WorkoutSession } from '../types';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, where, setDoc, getDocs } from 'firebase/firestore';
import { Plus, Target, Calendar, Droplets, Activity, Zap, X, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { calculateBMR, calculateTDEE, calculateTargetKcal, calculateMacros, calculateBMI } from '../lib/calculations';
import { WorkoutPlan } from '../types';

export default function Dashboard({ profile, aiStatus }: { profile: UserProfile | null, aiStatus: 'loading' | 'ready' | 'error' }) {
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [todayPlans, setTodayPlans] = useState<WorkoutPlan[]>([]);
  const [tomorrowPlans, setTomorrowPlans] = useState<WorkoutPlan[]>([]);

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState('');

  const handleSaveCustomTarget = async () => {
    if (!profile?.uid) return;
    const newTarget = parseInt(tempTarget);
    if (isNaN(newTarget) || newTarget < 500) return;
    
    await setDoc(doc(db, 'users', profile.uid), {
      customTargets: {
        ...profile.customTargets,
        kcal: newTarget
      }
    }, { merge: true });
    setIsEditingTarget(false);
  };

  const handleResetTarget = async () => {
    if (!profile?.uid) return;
    await setDoc(doc(db, 'users', profile.uid), {
      customTargets: null
    }, { merge: true });
    setIsEditingTarget(false);
  };

  useEffect(() => {
    if (!profile?.uid) return;
    
    const weekDays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const today = weekDays[new Date().getDay()];
    const tomorrow = weekDays[(new Date().getDay() + 1) % 7];

    const qToday = query(collection(db, 'users', profile.uid, 'plans'), where('dayOfWeek', '==', today));
    const qTomorrow = query(collection(db, 'users', profile.uid, 'plans'), where('dayOfWeek', '==', tomorrow));

    const unsubToday = onSnapshot(qToday, (snap) => {
      setTodayPlans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutPlan)));
    });

    const unsubTomorrow = onSnapshot(qTomorrow, (snap) => {
      setTomorrowPlans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutPlan)));
    });

    return () => {
      unsubToday();
      unsubTomorrow();
    };
  }, [profile]);

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
  const [nutritionHistory, setNutritionHistory] = useState<any[]>([]);
  const [activeChart, setActiveChart] = useState<'trend' | 'radar'>('trend');
  const [chartRange, setChartRange] = useState<7 | 30>(7);
  const [radarOffset, setRadarOffset] = useState(0); // 0 = oggi, -1 = ieri, ecc.

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
    
    const fetchHistory = async () => {
      try {
        // Fetch up to last 30 documents (days) to allow toggling between 7 and 30 without re-fetching
        const q = query(
          collection(db, `users/${profile.uid}/nutrition`),
          orderBy('__name__', 'desc'),
          limit(30)
        );
        
        onSnapshot(q, (snap) => {
          const history = snap.docs.map(docSnap => {
            const data = docSnap.data();
            const meals = data.meals || {};
            let totalKcal = 0;
            let totalPro = 0;
            let totalCarbs = 0;
            let totalFat = 0;
            Object.values(meals).forEach((mealArray: any) => {
              if (Array.isArray(mealArray)) {
                mealArray.forEach((item: any) => {
                  totalKcal += (item.kcal || 0);
                  totalPro += (item.protein || 0);
                  totalCarbs += (item.carbs || 0);
                  totalFat += (item.fat || 0);
                });
              }
            });
            
            // Format date strictly (docSnap.id is YYYY-MM-DD)
            const dateObj = new Date(docSnap.id);
            const formattedDate = dateObj.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
            
            return {
              dateStr: docSnap.id,
              date: formattedDate,
              kcal: totalKcal,
              protein: totalPro,
              carbs: totalCarbs,
              fat: totalFat
            };
          }).reverse(); // Chronological order
          
          setNutritionHistory(history);
        });
      } catch (error) {
        console.error('Error fetching nutrition history:', error);
      }
    };
    
    fetchHistory();
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
  const bmi = calculateBMI(weight, height);

  // Helper per riempire le date vuote in modo che il grafico cambi asse X a seconda di chartRange
  const generateChartData = (range: number) => {
    const data = [];
    const today = new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = nutritionHistory.find(h => h.dateStr === dateStr);
      
      data.push({
        date: d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
        kcal: existing ? existing.kcal : 0
      });
    }
    return data;
  };

  const chartData = generateChartData(chartRange);

  // Helper per il Radar Chart dei Nutrienti
  const getRadarDateStr = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };

  const getRadarDisplayDate = (offset: number) => {
    if (offset === 0) return 'Oggi';
    if (offset === -1) return 'Ieri';
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };

  const radarDateStr = getRadarDateStr(radarOffset);
  const existingRadarDay = nutritionHistory.find(h => h.dateStr === radarDateStr) || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  
  // Percentuali max a 100% per non rompere il grafico, ma memorizziamo l'actual per il tooltip
  const radarData = [
    { subject: 'Kcal', percent: targetKcal ? Math.min((existingRadarDay.kcal / targetKcal) * 100, 100) : 0, actual: existingRadarDay.kcal, target: targetKcal },
    { subject: 'Pro', percent: macros.protein ? Math.min((existingRadarDay.protein / macros.protein) * 100, 100) : 0, actual: existingRadarDay.protein, target: macros.protein },
    { subject: 'Carb', percent: macros.carbs ? Math.min((existingRadarDay.carbs / macros.carbs) * 100, 100) : 0, actual: existingRadarDay.carbs, target: macros.carbs },
    { subject: 'Fat', percent: macros.fat ? Math.min((existingRadarDay.fat / macros.fat) * 100, 100) : 0, actual: existingRadarDay.fat, target: macros.fat },
  ];

  const CustomRadarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-black/90 backdrop-blur border border-white/10 p-2 rounded-xl text-xs">
          <p className="font-bold text-white mb-1">{data.subject}</p>
          <p className="text-neon">{Math.round(data.actual)} <span className="text-zinc-500 text-[10px]">/ {Math.round(data.target)}</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      
      {/* Workout Preview */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="glass rounded-3xl p-5 border border-white/5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-neon" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Oggi</span>
          </div>
          <div className="font-black uppercase italic tracking-tighter text-lg leading-tight">
            {todayPlans.length > 0 ? todayPlans[0].name : 'Riposo'}
          </div>
          <div className="text-[10px] text-zinc-600 font-bold uppercase mt-1">
            {todayPlans.length > 0 ? `${todayPlans[0].exercises.length} Esercizi` : 'Recupero attivo'}
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="glass rounded-3xl p-5 border border-white/5 opacity-60"
        >
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-zinc-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Domani</span>
          </div>
          <div className="font-black uppercase italic tracking-tighter text-lg leading-tight">
            {tomorrowPlans.length > 0 ? tomorrowPlans[0].name : 'Riposo'}
          </div>
          <div className="text-[10px] text-zinc-600 font-bold uppercase mt-1">
            {tomorrowPlans.length > 0 ? `${tomorrowPlans[0].exercises.length} Esercizi` : 'Recupero attivo'}
          </div>
        </motion.div>
      </div>

      {/* Metabolic Hub - Compact & Schematic */}
      <motion.section 
        whileHover={{ scale: 1.01 }}
        className="glass rounded-3xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="text-neon" size={18} />
            <h3 className="font-black uppercase tracking-tighter text-xs italic">Hub Metabolico</h3>
          </div>
          
          <div 
            className="bg-neon/5 border border-neon/20 px-3 py-1 rounded-xl flex items-center gap-2 cursor-pointer"
            onClick={() => {
              setTempTarget(targetKcal.toString());
              setIsEditingTarget(true);
            }}
          >
            <span className="text-[8px] font-black uppercase tracking-widest text-neon">Target</span>
            {isEditingTarget ? (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <input 
                  type="number" 
                  value={tempTarget} 
                  onChange={(e) => setTempTarget(e.target.value)}
                  className="bg-black/40 border border-neon/50 rounded px-1 py-0.5 text-neon w-12 text-[10px] outline-none font-bold"
                  autoFocus
                />
                <button onClick={handleSaveCustomTarget} className="text-neon"><Zap size={10} /></button>
              </div>
            ) : (
              <span className="text-xs font-bold text-neon font-mono">{Math.round(targetKcal)}</span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/20 border border-white/5 p-3 rounded-2xl flex flex-col items-center">
            <span className="text-[8px] uppercase tracking-widest text-zinc-600 mb-0.5 font-black">Assunte</span>
            <span className="text-2xl font-black text-white font-mono">{Math.round(totalConsumed)}</span>
          </div>
          <div className="bg-black/20 border border-white/5 p-3 rounded-2xl flex flex-col items-center relative overflow-hidden">
            <span className="text-[8px] uppercase tracking-widest text-zinc-600 mb-0.5 font-black">Rimanenti</span>
            <span className="text-2xl font-black text-neon font-mono">{remainingKcal}</span>
            <div className="absolute bottom-0 left-0 h-1 bg-white/5 w-full">
              <motion.div 
                className="h-full bg-neon"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (totalConsumed / targetKcal) * 100)}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Pro', current: totalProtein, target: macros.protein, color: 'text-white' },
            { label: 'Carb', current: totalCarbs, target: macros.carbs, color: 'text-white' },
            { label: 'Fat', current: totalFat, target: macros.fat, color: 'text-white' }
          ].map(m => (
            <div key={m.label} className="bg-black/20 border border-white/5 rounded-xl p-2 flex flex-col items-center">
              <span className="text-[7px] font-black uppercase tracking-widest text-zinc-600">{m.label}</span>
              <span className="text-xs font-black font-mono">
                {Math.round(m.current)}<span className="text-[8px] text-zinc-600">/{m.target}g</span>
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-around pt-2 border-t border-white/5">
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-black uppercase tracking-widest text-zinc-700">BMR</span>
            <span className="text-[10px] font-bold text-zinc-500 font-mono">{Math.round(bmr)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-black uppercase tracking-widest text-zinc-700">TDEE</span>
            <span className="text-[10px] font-bold text-zinc-500 font-mono">{Math.round(tdee)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-black uppercase tracking-widest text-zinc-700">BMI</span>
            <span className="text-[10px] font-bold text-zinc-500 font-mono">{bmi.toFixed(1)}</span>
          </div>
        </div>

        {profile?.customTargets?.kcal && Math.abs(calculatedTargetKcal - profile.customTargets.kcal) > 50 && !isEditingTarget && (
          <button 
            onClick={handleResetTarget}
            className="w-full text-[8px] text-black font-black uppercase tracking-widest bg-neon py-1.5 rounded-xl mt-1 hover:bg-neon/80 transition-colors"
          >
            Sincronizza a {Math.round(calculatedTargetKcal)} kcal
          </button>
        )}
      </motion.section>

      {/* Analytics Compact Insights */}
      <motion.section 
        whileHover={{ scale: 1.01 }}
        className="glass rounded-3xl p-5 border border-white/5"
      >
        {/* Unified Header & Toggles */}
        <div className="flex flex-col gap-4 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-neon" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Analisi Nutrizionali</span>
            </div>
            
            {/* Dynamic Controls based on selected tab */}
            {activeChart === 'trend' ? (
              <div className="flex gap-1 bg-black/40 p-1 rounded-xl">
                <button 
                  onClick={() => setChartRange(7)}
                  className={`px-2 py-1 text-[8px] font-black uppercase rounded-lg transition-colors ${chartRange === 7 ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                  7g
                </button>
                <button 
                  onClick={() => setChartRange(30)}
                  className={`px-2 py-1 text-[8px] font-black uppercase rounded-lg transition-colors ${chartRange === 30 ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                  30g
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl">
                <button 
                  onClick={() => setRadarOffset(prev => prev - 1)}
                  className="px-2 py-1 text-zinc-500 hover:text-white transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[9px] font-black uppercase text-neon w-8 text-center truncate">
                  {getRadarDisplayDate(radarOffset)}
                </span>
                <button 
                  onClick={() => setRadarOffset(prev => Math.min(0, prev + 1))}
                  disabled={radarOffset === 0}
                  className={`px-2 py-1 transition-colors ${radarOffset === 0 ? 'text-zinc-800' : 'text-zinc-500 hover:text-white'}`}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Segmented Control */}
          <div className="flex p-1 bg-black/40 rounded-xl">
            <button 
              onClick={() => setActiveChart('trend')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-[9px] font-black uppercase rounded-lg transition-colors ${activeChart === 'trend' ? 'bg-zinc-800 text-neon' : 'text-zinc-600'}`}
            >
              <TrendingUp size={12} /> Trend Kcal
            </button>
            <button 
              onClick={() => setActiveChart('radar')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-[9px] font-black uppercase rounded-lg transition-colors ${activeChart === 'radar' ? 'bg-zinc-800 text-neon' : 'text-zinc-600'}`}
            >
              <Target size={12} /> Bilancio
            </button>
          </div>
        </div>

        {/* Dynamic Chart Container */}
        <div className="h-44 w-full mt-2 relative">
          {activeChart === 'trend' ? (
             nutritionHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorKcal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--neon-accent)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--neon-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    stroke="#52525b" 
                    fontSize={8} 
                    tickLine={false} 
                    axisLine={false}
                    tickMargin={10}
                    interval={chartRange === 7 ? 0 : 'preserveEnd'}
                  />
                  <YAxis hide domain={['dataMin - 200', 'dataMax + 200']} />
                  <Tooltip 
                    cursor={false}
                    contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px', color: '#fff', fontWeight: 'bold' }}
                    itemStyle={{ color: 'var(--neon-accent)' }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="kcal" 
                    stroke="var(--neon-accent)" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorKcal)" 
                    activeDot={{ r: 4, fill: 'var(--neon-accent)', stroke: '#000', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
             ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center px-4">
                Dati non ancora sufficienti per mostrare il trend.
              </div>
             )
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Tooltip cursor={false} content={<CustomRadarTooltip />} />
                  <Radar 
                    name="Nutrienti" 
                    dataKey="percent" 
                    stroke="var(--neon-accent)"
                    strokeWidth={2}
                    fill="var(--neon-accent)" 
                    fillOpacity={0.4} 
                  />
                </RadarChart>
              </ResponsiveContainer>
              {existingRadarDay.kcal === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px] rounded-2xl">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center px-4">
                    Nessun pasto tracciato
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </motion.section>

      {/* Quick Action */}
      <div className="pt-2">
        {todayPlans.length > 0 ? (
          <motion.button 
            whileHover={{ scale: 1.02, boxShadow: `0 0 30px rgba(var(--neon-accent-rgb),0.3)` }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-8 text-2xl bg-neon text-black font-black uppercase italic tracking-tighter rounded-3xl shadow-xl transition-all flex items-center justify-center gap-4 group"
            onClick={() => {
              const event = new CustomEvent('start-workout', { 
                detail: { planId: todayPlans[0].id } 
              });
              window.dispatchEvent(event);
            }}
          >
            <div className="w-12 h-12 bg-black/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus size={32} strokeWidth={3} />
            </div>
            INIZIA ALLENAMENTO
          </motion.button>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full py-8 glass rounded-3xl flex flex-col items-center justify-center text-center px-6 border-white/10 bg-white/[0.03]"
          >
            <div className="w-12 h-12 bg-neon/10 rounded-full flex items-center justify-center mb-3 text-neon/50">
              <Activity size={24} />
            </div>
            <h4 className="text-lg font-black italic uppercase text-white/90 leading-tight">
              Oggi riposo muscolare
            </h4>
            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-2 px-8 leading-relaxed">
              Il prossimo allenamento arriverà presto. Dormi 7-9 ore per un recupero cellulare ottimale.
            </p>
          </motion.div>
        )}
      </div>

    </div>
  );
}
