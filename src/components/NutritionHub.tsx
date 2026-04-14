import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { Apple, Plus, X, Target, Flame, ChevronRight, Camera, Brain, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { parseFoodInput } from '../services/geminiService';

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

  useEffect(() => {
    if (!profile?.uid) return;
    const today = new Date().toISOString().split('T')[0];
    const docRef = doc(db, `users/${profile.uid}/nutrition/${today}`);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setMeals(docSnap.data().meals || { Colazione: [], Pranzo: [], Cena: [], Spuntini: [] });
      }
    });
    return () => unsubscribe();
  }, [profile?.uid]);

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
            console.error("Errore ridimensionamento immagine:", err);
            toast.error("Errore nell'elaborazione dell'immagine.");
          }
        };
        img.onerror = () => {
          toast.error("Impossibile leggere l'immagine.");
        };
        img.src = reader.result as string;
      };
      reader.onerror = () => {
        toast.error("Errore di lettura del file.");
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
          fat: result.fat || 0,
        };

        const updatedMeals = {
          ...meals,
          [meal]: [...(meals[meal] || []), foodItem]
        };

        setMeals(updatedMeals);
        setNewFood({ meal: '', name: '', kcal: '', carbs: '', protein: '', fat: '' });
        setSelectedImage(null);
        setIsAdding(null);

        if (profile?.uid) {
          const today = new Date().toISOString().split('T')[0];
          await setDoc(doc(db, `users/${profile.uid}/nutrition/${today}`), { meals: updatedMeals }, { merge: true });
        }
        toast.success(`Aggiunto: ${result.name} (${result.kcal} kcal)`);
      } else {
        toast.error("Errore: Dati nutrizionali non trovati.");
      }
    } catch (error: any) {
      console.error("Errore parseFoodInput:", error);
      toast.error(`Errore: ${error.message || "Analisi fallita. Riprova."}`);
    } finally {
      setParsingMeal(null);
    }
  };

  const addFood = async (meal: string) => {
    if (!profile?.uid || !newFood.name || !newFood.kcal) return;
    
    const foodItem = {
      id: Date.now().toString(),
      name: newFood.name,
      kcal: parseInt(newFood.kcal),
      carbs: newFood.carbs ? parseInt(newFood.carbs) : 0,
      protein: newFood.protein ? parseInt(newFood.protein) : 0,
      fat: newFood.fat ? parseInt(newFood.fat) : 0,
    };

    const updatedMeals = {
      ...meals,
      [meal]: [...(meals[meal] || []), foodItem]
    };

    setMeals(updatedMeals);
    setNewFood({ meal: '', name: '', kcal: '', carbs: '', protein: '', fat: '' });
    setIsAdding(null);

    const today = new Date().toISOString().split('T')[0];
    await setDoc(doc(db, `users/${profile.uid}/nutrition/${today}`), { meals: updatedMeals }, { merge: true });
    toast.success('Alimento aggiunto!');
  };

  const removeFood = async (meal: string, id: string) => {
    if (!profile?.uid) return;
    const updatedMeals = {
      ...meals,
      [meal]: meals[meal].filter(item => item.id !== id)
    };
    setMeals(updatedMeals);
    const today = new Date().toISOString().split('T')[0];
    await setDoc(doc(db, `users/${profile.uid}/nutrition/${today}`), { meals: updatedMeals }, { merge: true });
  };

  type MealItem = { id: string, name: string, kcal: number, carbs?: number, protein?: number, fat?: number };
  const allMeals = (Object.values(meals) as MealItem[][]).flat();
  
  const totalKcal = allMeals.reduce((sum, item) => sum + item.kcal, 0);
  const totalCarbs = allMeals.reduce((sum, item) => sum + (item.carbs || 0), 0);
  const totalProtein = allMeals.reduce((sum, item) => sum + (item.protein || 0), 0);
  const totalFat = allMeals.reduce((sum, item) => sum + (item.fat || 0), 0);

  const calculateCalories = () => {
    if (!profile || !profile.weight || !profile.height || !profile.age) return { bmr: 0, tdee: 0, target: 2500 };
    
    let bmr = 0;
    if (profile.gender === 'male') {
      bmr = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age) + 5;
    } else {
      bmr = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age) - 161;
    }
    
    const tdee = bmr * (profile.activityLevel || 1.2);
    
    let target = tdee;
    if (profile.goal === 'lose') target = tdee - 500;
    if (profile.goal === 'gain') target = tdee + 500;
    
    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      target: Math.round(target)
    };
  };

  const results = calculateCalories();
  const targetKcal = results.target;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-lime-400/10 flex items-center justify-center">
          <Apple className="text-lime-400 w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tighter italic uppercase">Nutrizione</h1>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Diario Alimentare Manuale</p>
        </div>
      </div>

      {/* Macros Summary */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Calorie Assunte</div>
            <div className="text-4xl font-black tracking-tighter italic uppercase text-white">
              {totalKcal} <span className="text-sm font-bold text-zinc-500">/ {targetKcal}</span>
            </div>
          </div>
          <div className="w-20 h-20 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Consumed', value: Math.min(totalKcal, targetKcal) },
                    { name: 'Remaining', value: Math.max(targetKcal - totalKcal, 0) }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={35}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill={totalKcal > targetKcal ? '#f87171' : '#a3e635'} />
                  <Cell fill="#27272a" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <Flame size={16} className={totalKcal > targetKcal ? 'text-red-400' : 'text-lime-400'} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-2xl p-3">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Carbo</div>
            <div className="text-lg font-black text-white">{totalCarbs}g</div>
          </div>
          <div className="glass rounded-2xl p-3">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Pro</div>
            <div className="text-lg font-black text-white">{totalProtein}g</div>
          </div>
          <div className="glass rounded-2xl p-3">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Grassi</div>
            <div className="text-lg font-black text-white">{totalFat}g</div>
          </div>
        </div>
      </div>

      {/* Meals List */}
      <div className="space-y-4">
        {['Colazione', 'Pranzo', 'Cena', 'Spuntini'].map(meal => {
          const mealTotal = meals[meal]?.reduce((sum, item) => sum + item.kcal, 0) || 0;
          return (
            <motion.div 
              key={meal} 
              whileHover={{ scale: 1.01 }}
              className="glass rounded-3xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black uppercase tracking-tighter text-lg italic">{meal}</h3>
                <span className="text-sm font-bold text-lime-400">{mealTotal} kcal</span>
              </div>
              
              <div className="space-y-2 mb-4">
                <AnimatePresence mode="popLayout">
                  {meals[meal]?.map(item => (
                    <motion.div 
                      key={item.id} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.08)" }}
                      className="glass-dark p-3 rounded-2xl flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-bold text-zinc-200">{item.name}</div>
                        <div className="text-[10px] font-mono text-zinc-500 mt-1">
                          C: {item.carbs}g • P: {item.protein}g • G: {item.fat}g
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black italic">{item.kcal}</span>
                        <motion.button 
                          whileHover={{ scale: 1.2, color: "#f87171" }}
                          whileTap={{ scale: 0.8 }}
                          onClick={() => removeFood(meal, item.id)} 
                          className="text-zinc-600 p-1"
                        >
                          <X size={16} />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {isAdding === meal ? (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass p-4 rounded-3xl space-y-4">
                  
                  {/* AI Input Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Input Intelligente (AI)</label>
                      <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-lime-400/10 text-lime-400 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-lime-400/20 transition-colors border border-lime-400/20 ios-button">
                        <Camera size={14} /> Foto
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          className="hidden" 
                          onChange={(e) => handleImageUpload(e, meal)}
                          disabled={parsingMeal === meal}
                        />
                      </label>
                    </div>
                    
                    {selectedImage && selectedImage.meal === meal && (
                      <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-white/10">
                        <img src={selectedImage.dataUrl} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => setSelectedImage(null)}
                          className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full text-white hover:bg-red-500 transition-colors ios-button"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Es: 200g petto di pollo..."
                        value={newFood.name}
                        onChange={(e) => setNewFood({ ...newFood, name: e.target.value })}
                        className="flex-1 bg-black/20 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:ring-2 ring-lime-400/50 outline-none"
                        disabled={parsingMeal === meal}
                      />
                      <button 
                        onClick={() => handleAIFoodParse(meal)}
                        disabled={parsingMeal === meal || (!newFood.name && !(selectedImage && selectedImage.meal === meal))}
                        className="bg-purple-500 text-white px-4 rounded-2xl font-bold flex items-center justify-center hover:bg-purple-600 disabled:opacity-50 transition-colors ios-button"
                      >
                        {parsingMeal === meal ? <Clock size={18} className="animate-spin" /> : <Brain size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="flex-shrink-0 mx-4 text-zinc-600 text-[10px] uppercase font-bold tracking-widest">Oppure Manuale</span>
                    <div className="flex-grow border-t border-white/10"></div>
                  </div>

                  {/* Manual Input Section */}
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="number" 
                      placeholder="Kcal"
                      value={newFood.kcal}
                      onChange={(e) => setNewFood({ ...newFood, kcal: e.target.value })}
                      className="w-full bg-black/20 border border-white/10 rounded-2xl px-4 py-3 text-sm font-mono text-white focus:ring-2 ring-lime-400/50 outline-none"
                    />
                    <input 
                      type="number" 
                      placeholder="Carbo (g)"
                      value={newFood.carbs}
                      onChange={(e) => setNewFood({ ...newFood, carbs: e.target.value })}
                      className="w-full bg-black/20 border border-white/10 rounded-2xl px-4 py-3 text-sm font-mono text-white focus:ring-2 ring-lime-400/50 outline-none"
                    />
                    <input 
                      type="number" 
                      placeholder="Pro (g)"
                      value={newFood.protein}
                      onChange={(e) => setNewFood({ ...newFood, protein: e.target.value })}
                      className="w-full bg-black/20 border border-white/10 rounded-2xl px-4 py-3 text-sm font-mono text-white focus:ring-2 ring-lime-400/50 outline-none"
                    />
                    <input 
                      type="number" 
                      placeholder="Grassi (g)"
                      value={newFood.fat}
                      onChange={(e) => setNewFood({ ...newFood, fat: e.target.value })}
                      className="w-full bg-black/20 border border-white/10 rounded-2xl px-4 py-3 text-sm font-mono text-white focus:ring-2 ring-lime-400/50 outline-none"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => { setIsAdding(null); setSelectedImage(null); }}
                      className="flex-1 py-3 rounded-2xl text-xs font-bold bg-white/5 text-white hover:bg-white/10 transition-colors ios-button"
                    >
                      ANNULLA
                    </button>
                    <button 
                      onClick={() => addFood(meal)}
                      disabled={!newFood.name || !newFood.kcal}
                      className="flex-1 py-3 rounded-2xl text-xs font-black bg-lime-400 text-black hover:bg-lime-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ios-button"
                    >
                      SALVA
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.button 
                  whileHover={{ scale: 1.02, backgroundColor: "rgba(163,230,53,0.1)", borderColor: "rgba(163,230,53,0.5)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setIsAdding(meal); setNewFood({ meal, name: '', kcal: '', carbs: '', protein: '', fat: '' }); }}
                  className="w-full py-3 rounded-3xl border border-dashed border-white/10 text-zinc-500 hover:text-lime-400 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest ios-button"
                >
                  <Plus size={16} /> Aggiungi Alimento
                </motion.button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
