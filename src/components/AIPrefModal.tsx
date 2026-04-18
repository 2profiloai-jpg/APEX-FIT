import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Apple } from 'lucide-react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface AIPrefModalProps {
  profile: UserProfile | null;
  onClose: () => void;
}

export default function AIPrefModal({ profile, onClose }: AIPrefModalProps) {
  const [pantryText, setPantryText] = useState("");
  const [portionsText, setPortionsText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      if (profile.preferences?.pantry) {
        setPantryText(profile.preferences.pantry.join(', '));
      }
      if (profile.preferences?.typicalPortions) {
        setPortionsText(profile.preferences.typicalPortions);
      }
    }
    
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        preferences: {
          ...profile.preferences,
          pantry: pantryText.split(',').map(item => item.trim()).filter(Boolean),
          typicalPortions: portionsText.trim()
        }
      });
      toast.success('Impostazioni IA salvate correttamente!');
      onClose();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast.error('Errore durante il salvataggio.');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative bg-zinc-900 border border-zinc-700/50 rounded-3xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-2 text-neon">
            <Apple size={20} />
            <h3 className="font-black uppercase tracking-widest text-sm">Preferenze IA</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {/* Pantry Section */}
          <section className="space-y-3">
            <div className="flex flex-col">
              <h4 className="font-black uppercase tracking-widest text-[10px] text-zinc-400 mb-1">La tua Dispensa</h4>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                Gli alimenti che hai sempre in casa. L'IA li userà prioritariamente per i suggerimenti calorici.
              </p>
            </div>
            <div className="relative border border-white/10 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-neon/50 transition-all bg-black/40">
              <textarea 
                value={pantryText}
                onChange={(e) => setPantryText(e.target.value)}
                placeholder="Es: Uova, fesa di tacchino, yogurt greco, avena, mandorle..."
                className="w-full bg-transparent p-4 min-h-[100px] text-sm font-medium text-white outline-none resize-none"
              />
            </div>
          </section>

          {/* Portions Section */}
          <section className="space-y-3">
            <div className="flex flex-col">
              <h4 className="font-black uppercase tracking-widest text-[10px] text-zinc-400 mb-1">Porzioni Abituali</h4>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                Le quantità limite per te. L'IA eviterà suggerimenti esagerati che non ti si addicono.
              </p>
            </div>
            <div className="relative border border-white/10 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-neon/50 transition-all bg-black/40">
              <textarea 
                value={portionsText}
                onChange={(e) => setPortionsText(e.target.value)}
                placeholder="Es: Mangio max 80g di pasta. Mangio un vasetto di yogurt alla volta."
                className="w-full bg-transparent p-4 min-h-[100px] text-sm font-medium text-white outline-none resize-none"
              />
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-white/5 bg-black/20">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-neon text-black p-3.5 rounded-2xl hover:bg-white transition-colors flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs shadow-lg disabled:opacity-50"
          >
            {isSaving ? 'SALVATAGGIO...' : <><Save size={16} /> SALVA PREFERENZE</>}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
