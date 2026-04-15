import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Plus, X, Camera, Brain, Activity, Target, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { parseFoodInput } from '../services/geminiService';
import { calculateBMR, calculateTDEE, calculateTargetKcal, calculateMacros, calculateBMI } from '../lib/calculations';

export default function NutritionHub({ profile }: { profile: UserProfile | null }) {
  const [meals, setMeals] = useState<{ [key: string]: { id: string, name: string, kcal: number, carbs?: number, protein?: number, fat?: number }[] }>({
    Colazione: [],
    Pranzo: [],
    Cena: [],
    Spuntini: []
  });
  const [newFood, setNewFood] = useState({ meal: '', name: '', kcal: '', carbs: '', protein: '', fat: '' });
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [parsingMeal, setParsingMeal] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ meal: string, dataUrl: string } | null>(null);

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
  const bmi = calculateBMI(weight, height);

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(targetKcal.toString());

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

  // Totals
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

  useEffect(() => {
    if (!profile?.uid) return;
    const today = new Date().toISOString().split('T')[0];
    const docRef = doc(db, `users/${profile.uid}/nutrition/${today}`);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setMeals(docSnap.data().meals || { Colazione: [], Pranzo: [], Cena: [], Spuntini: [] });
      }
    }, (error) => {
      console.error('Firestore Error in NutritionHub:', error);
    });
    return () => unsubscribe();
  }, [profile?.uid]);

  const saveMeals = async (updatedMeals: any) => {
    if (!profile?.uid) return;
    const today = new Date().toISOString().split('T')[0];
    await setDoc(doc(db, `users/${profile.uid}/nutrition/${today}`), { meals: updatedMeals }, { merge: true });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, meal: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setSelectedImage({ meal, dataUrl });
          } catch (err) {
            toast.error("Errore nell'elaborazione dell'immagine.");
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAIFoodParse = async (meal: string) => {
    const hasImage = selectedImage && selectedImage.meal === meal;
    if (!newFood.name.trim() && !hasImage) return;
    
    setParsingMeal(meal);
    try {
      const imageToPass = hasImage ? selectedImage.dataUrl : undefined;
      const result = await parseFoodInput(newFood.name, imageToPass);
      if (result && result.name && result.kcal) {
        const foodItem = {
          id: Date.now().toString(),
          name: result.name,
          kcal: result.kcal,
          carbs: result.carbs || 0,
          protein: result.protein || 0,
          fat: result.fat || 0
        };
        const updatedMeals = { ...meals, [meal]: [...meals[meal], foodItem] };
        setMeals(updatedMeals);
        await saveMeals(updatedMeals);
        toast.success(`${result.name} aggiunto!`);
        setIsAdding(null);
        setNewFood({ meal: '', name: '', kcal: '', carbs: '', protein: '', fat: '' });
        setSelectedImage(null);
      }
    } catch (error: any) {
      toast.error(error.message || "Errore durante l'analisi");
    } finally {
      setParsingMeal(null);
    }
  };

  const addFood = async (meal: string) => {
    if (!newFood.name || !newFood.kcal) return;
    const foodItem = {
      id: Date.now().toString(),
      name: newFood.name,
      kcal: parseInt(newFood.kcal),
      carbs: parseInt(newFood.carbs) || 0,
      protein: parseInt(newFood.protein) || 0,
      fat: parseInt(newFood.fat) || 0
    };
    const updatedMeals = { ...meals, [meal]: [...meals[meal], foodItem] };
    setMeals(updatedMeals);
    await saveMeals(updatedMeals);
    setIsAdding(null);
    setNewFood({ meal: '', name: '', kcal: '', carbs: '', protein: '', fat: '' });
  };

  const removeFood = async (meal: string, id: string) => {
    const updatedMeals = { ...meals, [meal]: meals[meal].filter(item => item.id !== id) };
    setMeals(updatedMeals);
    await saveMeals(updatedMeals);
  };

  const remainingKcal = Math.round(targetKcal - totalKcal);

  return (
    <div className="space-y-8 pb-24">
      
      {/* Header Stats */}
      <motion.section 
        whileHover={{ scale: 1.01 }}
        className="glass rounded-3xl p-6 space-y-6"
      >
        <div className="flex items-center gap-2 mb-2">
          <Target className="text-cyan-400" size={20} />
          <h3 className="font-black uppercase tracking-tighter text-sm italic">Bilancio Giornaliero</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/20 border border-white/10 p-4 rounded-2xl flex flex-col justify-center items-center">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-black">Assunte</span>
            <span className="text-4xl font-black text-white font-mono" style={{ textShadow: '0 0 20px rgba(34,211,238,0.3)' }}>{Math.round(totalKcal)}</span>
          </div>
          <div className="bg-black/20 border border-white/10 p-4 rounded-2xl flex flex-col justify-center items-center relative overflow-hidden">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-black">Rimanenti</span>
            <span className="text-4xl font-black text-cyan-400 font-mono" style={{ textShadow: '0 0 20px rgba(34,211,238,0.5)' }}>{remainingKcal}</span>
            <div className="absolute bottom-0 left-0 h-1.5 bg-white/5 w-full">
              <motion.div 
                className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (totalKcal / targetKcal) * 100)}%` }}
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

      {/* Scientific Data */}
      <motion.section 
        whileHover={{ scale: 1.01 }}
        className="glass rounded-3xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className="text-cyan-400" size={20} />
          <h3 className="font-black uppercase tracking-tighter text-sm italic">Dati Metabolici</h3>
        </div>
        
        <div className="space-y-3 font-mono text-sm">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <span className="text-xs font-black uppercase tracking-widest text-zinc-500">BMR (Mifflin-St Jeor{bodyFat ? ' / Katch-McArdle' : ''})</span>
            <span className="font-bold text-white">{Math.round(bmr)} kcal</span>
          </div>
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <span className="text-xs font-black uppercase tracking-widest text-zinc-500">TDEE (PAL: {activityLevel})</span>
            <span className="font-bold text-white">{Math.round(tdee)} kcal</span>
          </div>
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Target ({goal})</span>
            {isEditingTarget ? (
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  value={tempTarget} 
                  onChange={(e) => setTempTarget(e.target.value)}
                  className="bg-black/40 border border-cyan-400/50 rounded px-2 py-1 text-cyan-400 w-20 text-right outline-none font-bold focus:ring-1 ring-cyan-400"
                  autoFocus
                />
                <button onClick={handleSaveCustomTarget} className="text-cyan-400 hover:text-cyan-300 p-1 bg-cyan-400/10 rounded"><Zap size={14} /></button>
                <button onClick={handleResetTarget} className="text-red-500 hover:text-red-400 p-1 bg-red-500/10 rounded"><X size={14} /></button>
              </div>
            ) : (
              <div className="flex flex-col items-end">
                <span 
                  className="font-bold cursor-pointer text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                  onClick={() => {
                    setTempTarget(targetKcal.toString());
                    setIsEditingTarget(true);
                  }}
                >
                  {Math.round(targetKcal)} kcal
                  {profile?.customTargets?.kcal && <span className="text-[8px] text-cyan-400/50 uppercase">(Custom)</span>}
                </span>
                {profile?.customTargets?.kcal && Math.abs(calculatedTargetKcal - profile.customTargets.kcal) > 50 && (
                  <button 
                    onClick={handleResetTarget}
                    className="text-[8px] text-black font-black uppercase tracking-widest bg-cyan-400 px-2 py-1 rounded mt-1 hover:bg-cyan-300 transition-colors"
                  >
                    Sincronizza a {Math.round(calculatedTargetKcal)}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-black uppercase tracking-widest text-zinc-500">BMI</span>
            <span className="font-bold text-white">{bmi.toFixed(1)}</span>
          </div>
        </div>
      </motion.section>

      {/* Meals List */}
      <div className="space-y-4">
        {Object.keys(meals).map((meal) => {
          const mealKcal = meals[meal].reduce((sum, item) => sum + (item.kcal || 0), 0);
          
          return (
            <motion.div 
              key={meal} 
              whileHover={{ scale: 1.01 }}
              className="glass rounded-3xl overflow-hidden"
            >
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                <span className="font-black uppercase tracking-widest text-sm text-white">{meal}</span>
                <span className="text-xs font-black text-cyan-400 font-mono">{mealKcal} kcal</span>
              </div>
              
              <div className="p-4 space-y-3">
                <AnimatePresence>
                  {meals[meal].map(item => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex justify-between items-center text-sm border-b border-white/5 pb-3 last:border-0 last:pb-0"
                    >
                      <div>
                        <div className="font-bold text-white">{item.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono font-bold uppercase tracking-widest mt-0.5">Pro: {item.protein}g | Carbo: {item.carbs}g | Fat: {item.fat}g</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-black text-cyan-400 font-mono">{item.kcal}</span>
                        <button onClick={() => removeFood(meal, item.id)} className="text-zinc-600 hover:text-red-500 transition-colors p-1 bg-white/5 rounded-full">
                          <X size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isAdding === meal ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-4 bg-black/20 border border-white/10 p-4 rounded-2xl">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Descrivi o scansiona..."
                        value={newFood.name}
                        onChange={(e) => setNewFood({ ...newFood, name: e.target.value })}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 outline-none text-sm font-bold focus:ring-2 ring-cyan-400/50 transition-all"
                      />
                      <label className="cursor-pointer p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center">
                        <Camera size={20} className="text-cyan-400" />
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, meal)} disabled={parsingMeal === meal} />
                      </label>
                      <button 
                        onClick={() => handleAIFoodParse(meal)}
                        disabled={parsingMeal === meal}
                        className="p-3 bg-cyan-400 text-black rounded-xl font-black disabled:opacity-50 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                      >
                        {parsingMeal === meal ? <Activity size={20} className="animate-spin" /> : <Brain size={20} />}
                      </button>
                    </div>

                    {selectedImage && selectedImage.meal === meal && (
                      <div className="relative h-24 rounded-xl overflow-hidden border border-white/10">
                        <img src={selectedImage.dataUrl} alt="Preview" className="w-full h-full object-cover opacity-70" />
                        <button onClick={() => setSelectedImage(null)} className="absolute top-2 right-2 bg-black/80 p-1.5 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-colors"><X size={14} /></button>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <div className="h-px bg-white/10 flex-1"></div>
                      <div className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Oppure Manuale</div>
                      <div className="h-px bg-white/10 flex-1"></div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 ml-1">Kcal</label>
                        <input type="number" placeholder="0" value={newFood.kcal} onChange={(e) => setNewFood({ ...newFood, kcal: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-2 text-white outline-none text-xs text-center font-mono focus:ring-1 ring-cyan-400/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 ml-1">Pro</label>
                        <input type="number" placeholder="0" value={newFood.protein} onChange={(e) => setNewFood({ ...newFood, protein: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-2 text-white outline-none text-xs text-center font-mono focus:ring-1 ring-cyan-400/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 ml-1">Carb</label>
                        <input type="number" placeholder="0" value={newFood.carbs} onChange={(e) => setNewFood({ ...newFood, carbs: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-2 text-white outline-none text-xs text-center font-mono focus:ring-1 ring-cyan-400/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 ml-1">Fat</label>
                        <input type="number" placeholder="0" value={newFood.fat} onChange={(e) => setNewFood({ ...newFood, fat: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-2 text-white outline-none text-xs text-center font-mono focus:ring-1 ring-cyan-400/50" />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button onClick={() => { setIsAdding(null); setSelectedImage(null); }} className="flex-1 py-3 text-xs font-black uppercase tracking-widest bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white transition-colors">Annulla</button>
                      <button onClick={() => addFood(meal)} disabled={!newFood.name || !newFood.kcal} className="flex-1 py-3 text-xs font-black uppercase tracking-widest bg-cyan-400 text-black rounded-xl disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(34,211,238,0.2)]">Salva</button>
                    </div>
                  </motion.div>
                ) : (
                  <button 
                    onClick={() => { setIsAdding(meal); setNewFood({ meal, name: '', kcal: '', carbs: '', protein: '', fat: '' }); }}
                    className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-cyan-400 hover:border-cyan-400/50 transition-colors flex items-center justify-center gap-2 bg-white/5"
                  >
                    <Plus size={16} /> Aggiungi Alimento
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
