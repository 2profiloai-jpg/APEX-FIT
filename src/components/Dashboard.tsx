import React, { useState, useEffect } from 'react';
import { UserProfile, WorkoutSession, BiometricLog } from '../types';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Zap, TrendingUp, Clock, ChevronRight, Brain, Dumbbell, Plus, Calculator, Save, User as UserIcon, Target, Flame, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import { getStrategistAdvice, parseFoodInput } from '../services/geminiService';
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

  // Meal Tracker State
  type MealItem = { id: string, name: string, kcal: number };
  const [meals, setMeals] = useState<{ [key: string]: MealItem[] }>({ Colazione: [], Pranzo: [], Cena: [], Spuntini: [] });
  const [newFood, setNewFood] = useState({ meal: '', name: '', kcal: '' });
  const todayDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users', profile.uid, 'meals'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const todayMeals = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(m => m.date === todayDate);
      
      const newMealsState: { [key: string]: MealItem[] } = { Colazione: [], Pranzo: [], Cena: [], Spuntini: [] };
      todayMeals.forEach(m => {
        if (newMealsState[m.type]) {
          newMealsState[m.type] = m.foods;
        }
      });
      setMeals(newMealsState);
    });
    return unsubscribe;
  }, [profile, todayDate]);

  const saveMealsToFirebase = async (updatedMeals: { [key: string]: MealItem[] }) => {
    if (!profile) return;
    try {
      for (const mealType of Object.keys(updatedMeals)) {
        const mealId = `${todayDate}_${mealType}`;
        await updateDoc(doc(db, 'users', profile.uid, 'meals', mealId), {
          date: todayDate,
          type: mealType,
          foods: updatedMeals[mealType]
        }).catch(async (e) => {
          // If document doesn't exist, create it
          const { setDoc } = await import('firebase/firestore');
          await setDoc(doc(db, 'users', profile.uid, 'meals', mealId), {
            userId: profile.uid,
            date: todayDate,
            type: mealType,
            foods: updatedMeals[mealType]
          });
        });
      }
    } catch (error) {
      console.error("Error saving meals:", error);
    }
  };

  const addFood = (meal: string) => {
    if (!newFood.name || !newFood.kcal) return;
    const updatedMeals = {
      ...meals,
      [meal]: [...meals[meal], { id: Date.now().toString(), name: newFood.name, kcal: parseInt(newFood.kcal) }]
    };
    setMeals(updatedMeals);
    saveMealsToFirebase(updatedMeals);
    setNewFood({ meal: '', name: '', kcal: '' });
  };

  const removeFood = (meal: string, id: string) => {
    const updatedMeals = {
      ...meals,
      [meal]: meals[meal].filter(f => f.id !== id)
    };
    setMeals(updatedMeals);
    saveMealsToFirebase(updatedMeals);
  };

  const [isParsingFood, setIsParsingFood] = useState(false);

  const handleAIFoodParse = async (meal: string, input: string) => {
    if (!input.trim()) return;
    setIsParsingFood(true);
    try {
      const result = await parseFoodInput(input);
      if (result && result.name && result.kcal) {
        const updatedMeals = {
          ...meals,
          [meal]: [...meals[meal], { id: Date.now().toString(), name: result.name, kcal: result.kcal }]
        };
        setMeals(updatedMeals);
        saveMealsToFirebase(updatedMeals);
        setNewFood({ meal: '', name: '', kcal: '' });
        toast.success(`Aggiunto: ${result.name} (${result.kcal} kcal)`);
      } else {
        toast.error("Non sono riuscito a stimare le calorie.");
      }
    } catch (error) {
      toast.error("Errore durante l'analisi del pasto.");
    } finally {
      setIsParsingFood(false);
    }
  };

  const totalConsumed = (Object.values(meals) as MealItem[][]).flat().reduce((sum, item) => sum + item.kcal, 0);

  // Weekly History State
  const [weeklyMeals, setWeeklyMeals] = useState<{ date: string, kcal: number }[]>([]);

  useEffect(() => {
    if (!profile) return;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDateStr = sevenDaysAgo.toISOString().split('T')[0];

    const q = query(
      collection(db, 'users', profile.uid, 'meals')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMeals = snapshot.docs.map(doc => doc.data() as any);
      
      // Group by date
      const dailyTotals: { [date: string]: number } = {};
      
      // Initialize last 7 days with 0
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyTotals[d.toISOString().split('T')[0]] = 0;
      }

      allMeals.forEach(meal => {
        if (dailyTotals[meal.date] !== undefined) {
          const mealTotal = meal.foods.reduce((sum: number, food: any) => sum + food.kcal, 0);
          dailyTotals[meal.date] += mealTotal;
        }
      });

      const chartData = Object.keys(dailyTotals).sort().map(date => ({
        date: date.substring(5).replace('-', '/'), // MM/DD
        kcal: dailyTotals[date]
      }));

      setWeeklyMeals(chartData);
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
    }
  }, [profile]);

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
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex items-center justify-between shadow-xl">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Target size={16} className="text-lime-400" />
                  <h3 className="font-black uppercase tracking-tighter text-xs text-zinc-400">Progresso Calorico</h3>
                </div>
                <div className="text-4xl font-black tracking-tighter italic uppercase text-white mt-2">
                  {totalConsumed} <span className="text-sm font-bold text-zinc-500">/ {results.target} kcal</span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-2 text-zinc-500">
                  {goal === 'lose' ? 'Deficit' : goal === 'gain' ? 'Surplus' : 'Mantenimento'}
                </p>
              </div>
              <div className="w-24 h-24 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Consumed', value: Math.min(totalConsumed, results.target) },
                        { name: 'Remaining', value: Math.max(results.target - totalConsumed, 0) }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={45}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill={totalConsumed > results.target ? '#f87171' : '#a3e635'} />
                      <Cell fill="#27272a" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <Flame size={20} className={totalConsumed > results.target ? 'text-red-400' : 'text-lime-400'} />
                </div>
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

            {/* Weekly History Chart */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mt-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-lime-400" />
                <h3 className="font-black uppercase tracking-tighter text-sm italic text-zinc-400">Andamento Settimanale</h3>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyMeals}>
                    <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: '#27272a' }}
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                      itemStyle={{ color: '#a3e635', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="kcal" fill="#a3e635" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Meal Tracker */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black uppercase tracking-tighter text-sm italic">Diario Alimentare</h3>
                <div className="text-right">
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Rimanenti</div>
                  <div className={`text-xl font-black italic ${results.target - totalConsumed < 0 ? 'text-red-400' : 'text-lime-400'}`}>
                    {results.target - totalConsumed} <span className="text-[10px]">kcal</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {['Colazione', 'Pranzo', 'Cena', 'Spuntini'].map(meal => {
                  const mealTotal = meals[meal].reduce((sum, item) => sum + item.kcal, 0);
                  return (
                    <div key={meal} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-zinc-300 uppercase tracking-widest">{meal}</span>
                        <span className="text-xs font-bold text-zinc-500">{mealTotal} kcal</span>
                      </div>
                      
                      <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-2 space-y-2">
                        {meals[meal].map(item => (
                          <div key={item.id} className="flex items-center justify-between bg-zinc-900 p-2 rounded-lg">
                            <span className="text-xs font-medium text-zinc-300 truncate pr-2">{item.name}</span>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-xs font-mono text-zinc-400">{item.kcal} kcal</span>
                              <button onClick={() => removeFood(meal, item.id)} className="text-zinc-600 hover:text-red-400">
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                        
                        <div className="flex flex-col gap-2 pt-2">
                          <textarea 
                            placeholder="Cosa hai mangiato? (es. 2 panini con crudo) oppure inserisci il nome e le kcal a destra..."
                            value={newFood.meal === meal ? newFood.name : ''}
                            onChange={(e) => setNewFood({ meal, name: e.target.value, kcal: newFood.meal === meal ? newFood.kcal : '' })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-sm text-white focus:ring-1 ring-lime-400 outline-none resize-none h-16"
                            disabled={isParsingFood}
                          />
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              placeholder="kcal (opzionale)"
                              value={newFood.meal === meal ? newFood.kcal : ''}
                              onChange={(e) => setNewFood({ meal, name: newFood.meal === meal ? newFood.name : '', kcal: e.target.value })}
                              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-center font-mono text-sm text-white focus:ring-1 ring-lime-400 outline-none"
                              disabled={isParsingFood}
                            />
                            <button 
                              onClick={() => {
                                if (newFood.name && !newFood.kcal) {
                                  handleAIFoodParse(meal, newFood.name);
                                } else if (newFood.name && newFood.kcal) {
                                  addFood(meal);
                                }
                              }}
                              disabled={isParsingFood || !newFood.name}
                              className={`px-4 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors ${
                                !newFood.kcal 
                                  ? 'bg-purple-500 text-white hover:bg-purple-600' 
                                  : 'bg-lime-400 text-black hover:bg-lime-500'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {isParsingFood ? (
                                <Clock size={18} className="animate-spin" />
                              ) : !newFood.kcal ? (
                                <><Brain size={18} /> IA Stima</>
                              ) : (
                                <><Plus size={18} /> Aggiungi</>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Strategist Advice */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <div className="flex items-center gap-2 mb-3 relative z-10">
          <Brain size={20} className="text-purple-400" />
          <h3 className="font-black uppercase tracking-tighter text-sm italic text-zinc-400">Consiglio dello Strategista</h3>
        </div>
        <p className="font-bold text-lg leading-tight text-zinc-100 italic relative z-10">
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
