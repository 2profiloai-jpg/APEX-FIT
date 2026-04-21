import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Plus, X, Camera, Brain, Activity, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { parseFoodInput, suggestMealForRemainingMacros } from '../services/geminiService';
import { cn } from '../lib/utils';
import { useBackgroundAI } from '../contexts/BackgroundAIContext';
import { calculateBMR, calculateTDEE, calculateTargetKcal, calculateMacros } from '../lib/calculations';

export default function NutritionHub({ profile }: { profile: UserProfile | null }) {
  const { runMealSuggestion, runFoodParse, getTask, clearTask, isTaskPending, tasks } = useBackgroundAI();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [meals, setMeals] = useState<{ [key: string]: { id: string, name: string, kcal: number, carbs?: number, protein?: number, fat?: number }[] }>({
    Colazione: [],
    Pranzo: [],
    Spuntino: [],
    Cena: []
  });
  const [newFood, setNewFood] = useState({ meal: '', name: '', amount: '', kcal: '', carbs: '', protein: '', fat: '' });
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ meal: string, dataUrl: string } | null>(null);
  const [suggestedMeal, setSuggestedMeal] = useState<{ text: string, items: any[] } | null>(null);

  // Totals
  let totalKcal = 0;
  let totalCarbs = 0;
  let totalProtein = 0;
  let totalFat = 0;

  Object.values(meals).forEach((mealArray: any[]) => {
    if (Array.isArray(mealArray)) {
      mealArray.forEach(item => {
        totalKcal += item.kcal || 0;
        totalCarbs += item.carbs || 0;
        totalProtein += item.protein || 0;
        totalFat += item.fat || 0;
      });
    }
  });

  // Calculate estimated target if custom is not set
  const weight = profile?.weight || 70;
  const height = profile?.height || 175;
  const age = profile?.age || 30;
  const gender = profile?.gender || 'male';
  const activityLevel = profile?.activityLevel || 1.2;
  const goal = profile?.goal || 'maintain';
  const bodyFat = profile?.bodyFat;

  const bmr = calculateBMR(weight, height, age, gender, bodyFat);
  const tdee = calculateTDEE(bmr, activityLevel);
  const calculatedTargetKcal = calculateTargetKcal(tdee, goal);
  
  const targetKcal = profile?.customTargets?.kcal || Math.round(calculatedTargetKcal);
  const macros = calculateMacros(weight, targetKcal);

  const targetPro = profile?.customTargets?.protein || macros.protein;
  const targetFat = profile?.customTargets?.fat || macros.fat;
  const targetCarbs = profile?.customTargets?.carbs || macros.carbs;

  useEffect(() => {
    if (!profile?.uid) return;
    const docRef = doc(db, `users/${profile.uid}/nutrition/${selectedDate}`);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setMeals(docSnap.data().meals || { Colazione: [], Pranzo: [], Spuntino: [], Cena: [] });
      } else {
        setMeals({ Colazione: [], Pranzo: [], Spuntino: [], Cena: [] });
      }
    }, (error) => {
      console.error('Firestore Error in NutritionHub:', error);
    });
    return () => unsubscribe();
  }, [profile?.uid, selectedDate]);

  useEffect(() => {
    // Sync suggested meal from background tasks if any
    const taskId = `meal-${selectedDate}`;
    const task = getTask(taskId);
    if (task && task.status === 'completed') {
      setSuggestedMeal(task.result);
    } else {
      setSuggestedMeal(null);
    }
  }, [selectedDate, getTask]);

  useEffect(() => {
    // Process completed food parsing tasks
    const completedParseTasks = tasks.filter(t => t.type === 'food-parse' && t.status === 'completed' && t.metadata?.date === selectedDate);
    
    if (completedParseTasks.length > 0) {
      let updatedMeals = { ...meals };
      let changed = false;

      completedParseTasks.forEach(t => {
        const meal = t.metadata?.meal;
        const result = t.result;
        if (result && result.items && Array.isArray(result.items)) {
          const newItems = result.items.map((item: any) => ({
            id: (Date.now() + Math.random()).toString(),
            name: item.name,
            kcal: item.kcal,
            carbs: item.carbs || 0,
            protein: item.protein || 0,
            fat: item.fat || 0
          }));
          updatedMeals[meal] = [...(updatedMeals[meal] || []), ...newItems];
          changed = true;
          clearTask(t.id);
        }
      });

      if (changed) {
        setMeals(updatedMeals);
        saveMeals(updatedMeals);
      }
    }
  }, [tasks, selectedDate, meals]);

  const saveMeals = async (updatedMeals: any) => {
    if (!profile?.uid) return;
    await setDoc(doc(db, `users/${profile.uid}/nutrition/${selectedDate}`), { meals: updatedMeals }, { merge: true });
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
    
    const imageToPass = hasImage ? selectedImage.dataUrl : undefined;
    
    await runFoodParse({
      meal,
      input: newFood.name,
      image: imageToPass,
      date: selectedDate
    });
    
    setIsAdding(null);
    setNewFood({ meal: '', name: '', amount: '', kcal: '', carbs: '', protein: '', fat: '' });
    setSelectedImage(null);
  };

  const addFood = async (meal: string) => {
    if (!newFood.name || !newFood.kcal) return;
    const foodItem = {
      id: Date.now().toString(),
      name: newFood.name,
      amount: newFood.amount,
      kcal: parseInt(newFood.kcal),
      carbs: parseInt(newFood.carbs) || 0,
      protein: parseInt(newFood.protein) || 0,
      fat: parseInt(newFood.fat) || 0
    };
    const updatedMeals = { ...meals, [meal]: [...meals[meal], foodItem] };
    setMeals(updatedMeals);
    await saveMeals(updatedMeals);
    setIsAdding(null);
    setNewFood({ meal: '', name: '', amount: '', kcal: '', carbs: '', protein: '', fat: '' });
  };

  const removeFood = async (meal: string, id: string) => {
    const updatedMeals = { ...meals, [meal]: meals[meal].filter(item => item.id !== id) };
    setMeals(updatedMeals);
    await saveMeals(updatedMeals);
  };

  const changeDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleAddSuggestedItems = async () => {
    if (!suggestedMeal || !Array.isArray(suggestedMeal.items) || !suggestedMeal.items.length) return;
    
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
    
    setMeals(updatedMeals);
    await saveMeals(updatedMeals);
    setSuggestedMeal(null);
    toast.success(`Suggerimento salvato correttamente nelle varie sezioni!`);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-8">
      
      {/* Date Selector */}
      <div className="flex items-center justify-between bg-black/20 border border-white/10 rounded-2xl p-2">
        <button 
          onClick={() => changeDate(-1)}
          className="p-3 hover:bg-white/5 rounded-xl text-zinc-400 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-neon">
            {isToday ? 'Oggi' : new Date(selectedDate).toLocaleDateString('it-IT', { weekday: 'long' })}
          </span>
          <span className="text-sm font-bold text-white">
            {new Date(selectedDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
          </span>
        </div>
        <button 
          onClick={() => changeDate(1)}
          className="p-3 hover:bg-white/5 rounded-xl text-zinc-400 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      
      {/* Meals List */}
      <div className="space-y-4">
        {/* Suggestion Section */}
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
                 const remKcal = Math.max(0, targetKcal - totalKcal);
                 const remPro = Math.max(0, targetPro - totalProtein);
                 const remCarb = Math.max(0, targetCarbs - totalCarbs);
                 const remFat = Math.max(0, targetFat - totalFat);
                 
                 const eatenSummary = Object.entries(meals)
                   .map(([name, list]) => `${name}: ${(list as any[]).length > 0 ? (list as any[]).map(i => i.name).join(', ') : 'Vuoto'}`)
                   .join('\n');

                 const workoutContext = `Oggi. Pasti già fatti: \n${eatenSummary}. \nConsidera l'orario attuale per suggerire se fare uno spuntino o passare direttamente alla cena.`;

                 await runMealSuggestion({
                   remKcal, remPro, remCarb, remFat,
                   pantry: profile?.preferences?.pantry || [],
                   favs: [], // favs not implemented yet
                   context: workoutContext,
                   targetKcal,
                   portions: profile?.preferences?.typicalPortions || '',
                   date: selectedDate
                 });
               }}
               disabled={isTaskPending('meal-suggestion', 'date', selectedDate)}
               className={cn(
                 "text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all flex items-center gap-2",
                 "bg-purple-500 text-black hover:bg-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]" 
               )}
             >
               {isTaskPending('meal-suggestion', 'date', selectedDate) ? <Activity size={14} className="animate-spin" /> : 'Suggerisci pasto'}
             </button>
           </div>
           
           {suggestedMeal && (
             <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 relative z-10">
               <div className="text-sm text-zinc-300 font-medium whitespace-pre-line bg-black/40 p-4 rounded-2xl border border-white/5 leading-relaxed shadow-inner">
                 {typeof suggestedMeal === 'string' ? suggestedMeal : suggestedMeal.text}
                 
                 {typeof suggestedMeal !== 'string' && suggestedMeal.items?.length > 0 && (
                   <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                     <div className="text-[10px] font-black uppercase tracking-widest text-purple-300 mb-2">Lista della spesa / Ingredienti:</div>
                     {suggestedMeal.items.map((item, idx) => (
                       <div key={idx} className="flex justify-between items-center bg-white/5 p-2 rounded-xl text-xs gap-3">
                         <span className="font-bold text-white truncate">{item.name}</span>
                         <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-lg text-[10px] uppercase font-black flex-shrink-0">{item.amount || 'q.b.'}</span>
                       </div>
                     ))}
                   </div>
                 )}
               </div>

               {typeof suggestedMeal !== 'string' && suggestedMeal.items?.length > 0 && (
                 <div className="flex flex-col gap-2">
                   <button 
                     onClick={() => handleAddSuggestedItems()}
                     className="bg-neon text-black font-black uppercase tracking-widest text-xs px-4 py-3 rounded-xl hover:bg-white transition-all shadow-lg flex items-center justify-center gap-2"
                   >
                     Aggiungi a Diario
                   </button>
                 </div>
               )}
             </motion.div>
           )}
        </div>

        {['Colazione', 'Pranzo', 'Spuntino', 'Cena'].map((meal) => {
          const mealItems = meals[meal] || [];
          const mealKcal = mealItems.reduce((sum, item) => sum + (item.kcal || 0), 0);
          
          return (
            <motion.div 
              key={meal} 
              whileHover={{ scale: 1.01 }}
              className="glass rounded-3xl overflow-hidden"
            >
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                <span className="font-black uppercase tracking-widest text-sm text-white">{meal}</span>
                <span className="text-xs font-black text-neon italic tracking-tighter neon-text uppercase">{mealKcal} kcal</span>
              </div>
              
              <div className="p-4 space-y-3">
                <AnimatePresence>
                  {mealItems.map(item => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex justify-between items-center text-sm border-b border-white/5 pb-3 last:border-0 last:pb-0 gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span className="truncate">{item.name}</span>
                          {item.amount && (
                            <span className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-zinc-400 font-black uppercase tracking-widest flex-shrink-0">
                              {item.amount}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Pro: {item.protein}g | Carbo: {item.carbs}g | Fat: {item.fat}g</div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-black text-neon text-base italic tracking-tighter neon-text">{item.kcal}</span>
                        <button onClick={() => removeFood(meal, item.id)} className="text-zinc-600 hover:text-red-500 transition-colors p-1 bg-white/5 rounded-full">
                          <X size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isAdding === meal ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-4 bg-black/20 border border-white/10 p-4 rounded-2xl">
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                          type="text" 
                          placeholder="Nome alimento..."
                          value={newFood.name}
                          onChange={(e) => setNewFood({ ...newFood, name: e.target.value })}
                          className="flex-[3] bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-zinc-600 outline-none text-sm font-bold focus:ring-2 ring-neon/50 transition-all"
                        />
                        <input 
                          type="text" 
                          placeholder="Quantità (es: 100g)..."
                          value={newFood.amount}
                          onChange={(e) => setNewFood({ ...newFood, amount: e.target.value })}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 outline-none text-xs font-bold focus:ring-2 ring-neon/50 transition-all"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <label className="flex-1 cursor-pointer p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                          <Camera size={20} className="text-zinc-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Foto</span>
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, meal)} disabled={isTaskPending('food-parse', 'meal', meal)} />
                        </label>
                        
                        <button 
                          onClick={() => handleAIFoodParse(meal)}
                          disabled={isTaskPending('food-parse', 'meal', meal)}
                          className="flex-[2] p-4 bg-neon text-black rounded-xl font-black disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(var(--neon-accent-rgb),0.4)] hover:bg-neon/80 transition-all active:scale-95"
                        >
                          {isTaskPending('food-parse', 'meal', meal) ? (
                            <Activity size={20} className="animate-spin" />
                          ) : (
                            <>
                              <Brain size={20} />
                              <span className="text-[10px] font-black uppercase tracking-widest">Analizza con IA</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {selectedImage && selectedImage.meal === meal && (
                      <div className="relative h-24 rounded-xl overflow-hidden border border-white/10">
                        <img src={selectedImage.dataUrl} alt="Preview" className="w-full h-full object-cover opacity-70" referrerPolicy="no-referrer" />
                        <button onClick={() => setSelectedImage(null)} className="absolute top-2 right-2 bg-black/80 p-1.5 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-colors"><X size={14} /></button>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <div className="h-px bg-white/10 flex-1"></div>
                      <div className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Oppure Manuale</div>
                      <div className="h-px bg-white/10 flex-1"></div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 ml-1">Kcal</label>
                        <input type="number" placeholder="0" value={newFood.kcal} onChange={(e) => setNewFood({ ...newFood, kcal: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-2 text-white outline-none text-base text-center font-bold focus:ring-1 ring-neon/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 ml-1">Pro</label>
                        <input type="number" placeholder="0" value={newFood.protein} onChange={(e) => setNewFood({ ...newFood, protein: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-2 text-white outline-none text-base text-center font-bold focus:ring-1 ring-neon/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 ml-1">Carb</label>
                        <input type="number" placeholder="0" value={newFood.carbs} onChange={(e) => setNewFood({ ...newFood, carbs: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-2 text-white outline-none text-base text-center font-bold focus:ring-1 ring-neon/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 ml-1">Fat</label>
                        <input type="number" placeholder="0" value={newFood.fat} onChange={(e) => setNewFood({ ...newFood, fat: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-2 text-white outline-none text-base text-center font-bold focus:ring-1 ring-neon/50" />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button onClick={() => { setIsAdding(null); setSelectedImage(null); }} className="flex-1 py-3 text-xs font-black uppercase tracking-widest bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white transition-colors">Annulla</button>
                      <button onClick={() => addFood(meal)} disabled={!newFood.name || !newFood.kcal} className="flex-1 py-3 text-xs font-black uppercase tracking-widest bg-neon text-black rounded-xl disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(var(--neon-accent-rgb),0.2)]">Salva</button>
                    </div>
                  </motion.div>
                ) : (
          <button 
            onClick={() => { setIsAdding(meal); setNewFood({ meal, name: '', amount: '', kcal: '', carbs: '', protein: '', fat: '' }); }}
            className="w-full py-4 border border-white/5 rounded-2xl text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-neon hover:border-neon/30 transition-colors flex items-center justify-center gap-2 bg-white/[0.02]"
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
