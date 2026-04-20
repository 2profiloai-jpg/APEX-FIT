import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Plus, X, Search, Trash2, CheckCircle, Zap, Loader2, List, Info, Sparkles } from 'lucide-react';
import { GymEquipment, UserProfile } from '../types';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { analyzeGymEquipment } from '../services/geminiService';
import { toast } from 'sonner';
import GripButton from './ui/GripButton';
import { cn } from '../lib/utils';

interface GymMapperProps {
  profile: UserProfile | null;
  onClose: () => void;
}

export default function GymMapper({ profile, onClose }: GymMapperProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [inventory, setInventory] = useState<GymEquipment[]>(profile?.gymInventory || []);
  const [photoQueue, setPhotoQueue] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const newBase64s: string[] = [];
    for (const file of files) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newBase64s.push(base64);
    }
    
    setPhotoQueue(prev => [...prev, ...newBase64s]);
    if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
  };

  const processPhotoQueue = async () => {
    if (photoQueue.length === 0) return;
    setIsScanning(true);
    try {
      const result = await analyzeGymEquipment(photoQueue);
      if (result.equipment && Array.isArray(result.equipment)) {
        const newEquip: GymEquipment[] = result.equipment.map((eq: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          name: eq.name,
          category: eq.category,
          targetMuscles: eq.targetMuscles,
          equipmentType: eq.equipmentType,
          addedAt: new Date().toISOString()
        }));
        
        await updateInventory(newEquip);
        toast.success(`Identificati ${newEquip.length} macchinari dalle foto!`);
        setPhotoQueue([]); // Clear queue after success
      }
    } catch (err) {
      toast.error("Errore durante l'analisi delle immagini");
    } finally {
      setIsScanning(false);
    }
  };

  const handleManualAdd = async () => {
    if (!textInput.trim()) return;
    setIsScanning(true);
    try {
      const result = await analyzeGymEquipment(undefined, textInput);
      if (result.equipment && Array.isArray(result.equipment)) {
        const newEquip: GymEquipment[] = result.equipment.map((eq: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          name: eq.name,
          category: eq.category,
          targetMuscles: eq.targetMuscles,
          equipmentType: eq.equipmentType,
          addedAt: new Date().toISOString()
        }));
        await updateInventory(newEquip);
        setTextInput('');
        toast.success("Attrezzatura aggiunta!");
      }
    } catch (err) {
      toast.error("Errore nell'aggiunta manuale");
    } finally {
      setIsScanning(false);
    }
  };

  const updateInventory = async (newItems: GymEquipment[]) => {
    if (!profile) return;
    try {
      const userRef = doc(db, 'users', profile.uid);
      const updatedInventory = [...inventory, ...newItems];
      await updateDoc(userRef, {
        gymInventory: updatedInventory
      });
      setInventory(updatedInventory);
    } catch (err) {
      console.error("Errore aggiornamento inventario:", err);
    }
  };

  const removeItem = async (item: GymEquipment) => {
    if (!profile) return;
    try {
      const userRef = doc(db, 'users', profile.uid);
      const updatedInventory = inventory.filter(i => i.id !== item.id);
      await updateDoc(userRef, {
        gymInventory: updatedInventory
      });
      setInventory(updatedInventory);
      toast.success(`${item.name} rimosso`);
    } catch (err) {
      toast.error("Errore nella rimozione");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 bg-black flex flex-col pt-safe"
    >
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-neon/10 rounded-xl flex items-center justify-center">
            <List size={20} className="text-neon" />
          </div>
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter">Mappa Palestra</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Digitalizza la tua attrezzatura</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full text-zinc-400">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 thin-scrollbar">
        {/* Input Methods */}
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="h-32 bg-white/[0.03] border border-white/5 rounded-3xl flex flex-col items-center justify-center gap-3 active:scale-95 transition-all group relative overflow-hidden"
            >
              {isScanning ? (
                <Loader2 size={24} className="text-neon animate-spin" />
              ) : (
                <>
                  <div className="absolute top-0 right-0 w-full h-full bg-neon/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <Camera size={24} className={cn("transition-colors", photoQueue.length > 0 ? "text-neon" : "text-zinc-400 group-hover:text-neon")} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center px-2">
                    {photoQueue.length > 0 ? 'Aggiungi Altra Foto' : 'Scansiona Foto'}
                  </span>
                  {photoQueue.length > 0 && (
                     <span className="absolute top-2 right-2 bg-neon text-black text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full">
                       {photoQueue.length}
                     </span>
                  )}
                </>
              )}
            </button>
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImageCapture}
            />
            
            <div className="h-32 bg-white/[0.03] border border-white/5 rounded-3xl p-4 flex flex-col justify-between relative overflow-hidden">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">Inserimento Veloce</span>
              <div className="w-full mt-2 relative z-10">
                <input 
                  type="text" 
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
                  placeholder="SCRIVI QUI..."
                  className="w-full bg-black/60 border border-white/5 rounded-xl pl-3 pr-10 py-3 text-[10px] font-black uppercase tracking-tighter focus:ring-1 focus:ring-neon focus:border-neon outline-none transition-all placeholder:text-zinc-700"
                />
                <button 
                  onClick={handleManualAdd}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-neon/10 rounded-lg flex items-center justify-center text-neon active:scale-90 transition-transform"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          {photoQueue.length > 0 && (
            <motion.div 
               initial={{ opacity: 0, height: 0 }}
               animate={{ opacity: 1, height: 'auto' }}
               className="bg-neon/10 border border-neon/20 rounded-[2rem] p-4 flex flex-col gap-4"
            >
              <div className="flex gap-2 overflow-x-auto thin-scrollbar pb-2">
                {photoQueue.map((photo, i) => (
                   <div key={i} className="relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-neon/30">
                     <img src={photo} alt="" className="w-full h-full object-cover" />
                     <button 
                       onClick={() => setPhotoQueue(q => q.filter((_, idx) => idx !== i))}
                       className="absolute top-1 right-1 bg-black/50 p-1 rounded-full text-white hover:text-red-500"
                     >
                       <X size={10} />
                     </button>
                   </div>
                ))}
              </div>
              <GripButton onClick={processPhotoQueue} disabled={isScanning} className="w-full text-xs h-12">
                 {isScanning ? <Loader2 size={16} className="animate-spin inline mr-2" /> : `ANALIZZA ${photoQueue.length} FOTO ORA`}
              </GripButton>
            </motion.div>
          )}
          
          <div className="bg-zinc-900/50 border border-white/5 p-5 rounded-[2rem] flex items-center gap-4">
            <div className="w-12 h-12 bg-neon rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(var(--neon-accent-rgb),0.2)]">
              <Sparkles size={24} className="text-black" />
            </div>
            <div className="flex-1">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white italic">Intelligenza Biomeccanica</h4>
              <p className="text-[9px] text-zinc-500 font-bold leading-tight mt-1">
                L'IA mapperà ogni macchina per offrirti alternative perfette quando la palestra è piena.
              </p>
            </div>
          </div>
        </section>

        {/* Inventory List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Il tuo Inventario ({inventory.length})</h3>
            {inventory.length > 0 && (
              <span className="text-[9px] font-bold text-neon uppercase tracking-widest">Digitale e Pronto</span>
            )}
          </div>

          {inventory.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
              <Search size={40} className="text-zinc-600" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Nessuna macchina censita.<br/>Inizia a mappare per sbloccare l'IA.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inventory.map((item) => (
                <motion.div 
                  layout
                  key={item.id}
                  className="p-4 glass rounded-2xl flex items-center justify-between border-white/5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center border border-white/5">
                      <Zap size={16} className="text-neon" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-tighter italic">{item.name}</h4>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-neon/60">{item.category}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{item.equipmentType}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeItem(item)}
                    className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="p-6 border-t border-white/5 bg-black/80 backdrop-blur-xl">
        <GripButton onClick={onClose} variant="primary">
          CONFERMA INVENTARIO
        </GripButton>
      </div>
    </motion.div>
  );
}
