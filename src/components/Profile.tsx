import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserProfile } from '../types';
import { User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { LogOut, Settings, Award, Shield, Bell, ChevronRight, Brain, User as UserIcon, Clock, Save, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { isAIReady } from '../services/geminiService';
import { cn } from '../lib/utils';

export default function Profile({ profile, user, aiStatus }: { profile: UserProfile | null, user: User, aiStatus: 'loading' | 'ready' | 'error' }) {
  // Biometric State
  const [weight, setWeight] = useState(profile?.weight || 0);
  const [height, setHeight] = useState(profile?.height || 0);
  const [age, setAge] = useState(profile?.age || 0);
  const [gender, setGender] = useState<'male' | 'female'>(profile?.gender || 'male');
  const [activityLevel, setActivityLevel] = useState(profile?.activityLevel || 1.2);
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>(profile?.goal || 'maintain');
  const [bodyFat, setBodyFat] = useState(profile?.bodyFat || 0);
  const [customKcal, setCustomKcal] = useState(profile?.customTargets?.kcal || 0);
  const [themeColor, setThemeColor] = useState(profile?.themeColor || 'blue');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    if (profile) {
      if (profile.weight) setWeight(profile.weight);
      if (profile.height) setHeight(profile.height);
      if (profile.age) setAge(profile.age);
      if (profile.gender) setGender(profile.gender);
      if (profile.activityLevel) setActivityLevel(profile.activityLevel);
      if (profile.goal) setGoal(profile.goal);
      if (profile.bodyFat) setBodyFat(profile.bodyFat);
      if (profile.themeColor) setThemeColor(profile.themeColor);
      if (profile.customTargets?.kcal) setCustomKcal(profile.customTargets.kcal);
    }
  }, [profile]);

  useEffect(() => {
    if (showPreferences) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showPreferences]);

  const handleSaveTheme = async (color: string) => {
    if (!profile) return;
    setThemeColor(color);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        themeColor: color
      });
    } catch (error) {
      toast.error('Errore durante il cambio tema.');
    }
  };

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
        goal,
        bodyFat,
        customTargets: customKcal > 0 ? { kcal: customKcal } : null
      });
      toast.success('Parametri salvati correttamente!');
    } catch (error) {
      console.error("Errore salvataggio biometria:", error);
      toast.error('Errore durante il salvataggio.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center"
      >
        <motion.div 
          whileHover={{ scale: 1.05, rotate: 5 }}
          className="w-24 h-24 rounded-3xl glass border-2 border-neon p-1 mb-4 shadow-[0_0_30px_rgba(var(--neon-accent-rgb),0.2)]"
        >
          <img src={user.photoURL || ''} className="w-full h-full rounded-2xl object-cover" alt="Profile" referrerPolicy="no-referrer" />
        </motion.div>
        <h2 className="text-3xl font-black tracking-tighter italic uppercase">{profile?.displayName}</h2>
        
        <motion.div 
          whileHover={{ scale: 1.05 }}
          className={`mt-3 px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 ${aiStatus === 'ready' ? 'bg-neon/10 text-neon border-neon/20' : aiStatus === 'loading' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          <Brain size={14} />
          {aiStatus === 'ready' ? 'IA ATTIVA' : aiStatus === 'loading' ? 'CARICAMENTO IA...' : 'CHIAVE IA MANCANTE'}
        </motion.div>
      </motion.div>

      {/* Biometric Entry Section */}
      <motion.section 
        whileHover={{ scale: 1.01 }}
        className="glass rounded-3xl p-6 space-y-6"
      >
        <div className="flex items-center gap-2 mb-2">
          <UserIcon className="text-neon" size={20} />
          <h3 className="font-black uppercase tracking-tighter text-sm italic">Parametri Biometrici</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Peso (kg)</label>
            <input 
              type="number" 
              value={weight || ''} 
              onChange={(e) => setWeight(parseFloat(e.target.value))}
              className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 font-mono font-bold text-white focus:ring-2 ring-neon/50 outline-none transition-all"
              placeholder="0.0"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Altezza (cm)</label>
            <input 
              type="number" 
              value={height || ''} 
              onChange={(e) => setHeight(parseFloat(e.target.value))}
              className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 font-mono font-bold text-white focus:ring-2 ring-neon/50 outline-none transition-all"
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Età</label>
            <input 
              type="number" 
              value={age || ''} 
              onChange={(e) => setAge(parseInt(e.target.value))}
              className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 font-mono font-bold text-white focus:ring-2 ring-neon/50 outline-none transition-all"
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Body Fat (%)</label>
            <input 
              type="number" 
              value={bodyFat || ''} 
              onChange={(e) => setBodyFat(parseFloat(e.target.value))}
              className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 font-mono font-bold text-white focus:ring-2 ring-neon/50 outline-none transition-all"
              placeholder="Opzionale"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Genere</label>
            <div className="flex bg-black/20 border border-white/10 rounded-xl p-1">
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setGender('male')}
                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${gender === 'male' ? 'bg-neon text-black shadow-lg' : 'text-zinc-500'}`}
              >
                M
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setGender('female')}
                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${gender === 'female' ? 'bg-neon text-black shadow-lg' : 'text-zinc-500'}`}
              >
                F
              </motion.button>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Livello di Attività</label>
          <select 
            value={activityLevel}
            onChange={(e) => setActivityLevel(parseFloat(e.target.value))}
            className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 font-bold text-white focus:ring-2 ring-neon/50 outline-none appearance-none transition-all"
          >
            <option value={1.2}>Sedentario (Ufficio)</option>
            <option value={1.375}>Leggero (1-3 allenamenti)</option>
            <option value={1.55}>Moderato (3-5 allenamenti)</option>
            <option value={1.725}>Intenso (6-7 allenamenti)</option>
            <option value={1.9}>Atleta (Lavoro fisico + sport)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Obiettivo principale</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'lose', label: 'Perdere' },
              { id: 'maintain', label: 'Mantenere' },
              { id: 'gain', label: 'Crescere' }
            ].map(g => (
              <motion.button 
                key={g.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setGoal(g.id as any)}
                className={`py-2.5 rounded-xl text-[10px] font-black uppercase border transition-all ${goal === g.id ? 'bg-neon text-black border-neon shadow-[0_0_20px_rgba(var(--neon-accent-rgb),0.3)]' : 'bg-black/20 border-white/5 text-zinc-500'}`}
              >
                {g.label}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Target Calorico Personalizzato</label>
          <div className="relative">
            <input 
              type="number" 
              value={customKcal || ''} 
              onChange={(e) => setCustomKcal(parseInt(e.target.value))}
              className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 font-mono font-bold text-white focus:ring-2 ring-neon/50 outline-none transition-all"
              placeholder="Calcolo automatico..."
            />
            {customKcal > 0 && (
              <button 
                onClick={() => setCustomKcal(0)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-neon uppercase bg-neon/10 px-2 py-1 rounded-lg"
              >
                Reset
              </button>
            )}
          </div>
          <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-1 ml-1">Lascia vuoto per il calcolo IA/Parametri</p>
        </div>

        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSaveBiometrics}
          disabled={isSaving}
          className="w-full py-4 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-neon transition-all disabled:opacity-50"
        >
          {isSaving ? <Clock className="animate-spin" size={16} /> : <Save size={16} />}
          {isSaving ? 'SALVATAGGIO...' : 'SALVA PARAMETRI'}
        </motion.button>
      </motion.section>

      <div className="space-y-2">
        <ProfileLink icon={<Award size={18} />} label="Traguardi" onClick={() => toast.info('Traguardi in arrivo presto!')} />
        <ProfileLink icon={<Bell size={18} />} label="Notifiche" onClick={() => toast.info('Impostazioni notifiche in arrivo!')} />
        <ProfileLink icon={<Shield size={18} />} label="Privacy e Sicurezza" onClick={() => toast.info('Privacy in arrivo!')} />
        <ProfileLink icon={<Settings size={18} />} label="Preferenze" onClick={() => setShowPreferences(true)} />
      </div>

      {/* Preferences Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showPreferences && (
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-[110] bg-black p-6 flex flex-col"
            >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Settings className="text-neon" size={24} />
                <h3 className="text-2xl font-black uppercase tracking-tighter italic">Preferenze</h3>
              </div>
              <button 
                onClick={() => setShowPreferences(false)}
                className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-8 flex-1 overflow-y-auto pb-20 no-scrollbar">
              {/* Theme Selection Section */}
              <section className="space-y-4">
                <div className="flex flex-col">
                  <h4 className="font-black uppercase tracking-widest text-[10px] text-zinc-500 mb-2">Tema Neon</h4>
                </div>

                <div className="grid grid-cols-5 gap-3 px-1">
                  {[
                    { id: 'crimson', hex: '#ff003c' },
                    { id: 'blaze', hex: '#ff4e50' },
                    { id: 'sunset', hex: '#ff8c00' },
                    { id: 'amber', hex: '#f59e0b' },
                    { id: 'lemon', hex: '#dfff00' },
                    { id: 'electric', hex: '#39ff14' },
                    { id: 'emerald', hex: '#50ffb1' },
                    { id: 'mint', hex: '#2efef7' },
                    { id: 'cyan', hex: '#00ffff' },
                    { id: 'sky', hex: '#0ea5e9' },
                    { id: 'blue', hex: '#0066ff' },
                    { id: 'indigo', hex: '#6366f1' },
                    { id: 'violet', hex: '#bf00ff' },
                    { id: 'fuchsia', hex: '#ff00ff' },
                    { id: 'white', hex: '#ffffff' }
                  ].map(c => (
                    <motion.button
                      key={c.id}
                      whileHover={{ scale: 1.1, y: -1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSaveTheme(c.id)}
                      className={cn(
                        "w-full aspect-square rounded-xl border transition-all relative block overflow-hidden group",
                        themeColor === c.id 
                          ? "border-white scale-105 shadow-[0_0_15px_rgba(var(--neon-accent-rgb),0.6)]" 
                          : "border-white/10 opacity-40 hover:opacity-100 hover:border-white/30"
                      )}
                      style={{ 
                        backgroundColor: c.hex,
                        boxShadow: themeColor === c.id ? `0 0 15px ${c.hex}99` : 'none'
                      }}
                    >
                      {/* LED Inner Glow Effect */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-white/40 opacity-50" />
                      {themeColor === c.id && (
                        <motion.div 
                          layoutId="active-glow"
                          className="absolute inset-0 bg-white/20 animate-pulse"
                        />
                      )}
                      {themeColor === c.id && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check size={10} className="text-white drop-shadow-md" />
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </section>

              <section className="space-y-4 opacity-50 pointer-events-none">
                <div className="flex flex-col">
                  <h4 className="font-black uppercase tracking-widest text-xs text-zinc-500 mb-1">Notifiche Push</h4>
                  <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Promemoria allenamenti e pasti</p>
                </div>
                <div className="h-12 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-between px-4">
                  <span className="text-sm font-bold text-zinc-400">Attiva Notifiche</span>
                  <div className="w-10 h-6 bg-zinc-800 rounded-full"></div>
                </div>
              </section>
            </div>

            <div className="pt-6">
              <button 
                onClick={() => setShowPreferences(false)}
                className="w-full py-4 bg-neon text-black font-black uppercase tracking-widest text-xs rounded-2xl shadow-[0_0_20px_rgba(var(--neon-accent-rgb),0.3)]"
              >
                CONFERMA
              </button>
            </div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body
      )}

      <motion.button 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => auth.signOut()}
        className="w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all"
      >
        <LogOut size={20} /> DISCONNETTI
      </motion.button>
    </div>
  );
}

function ProfileLink({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <motion.button 
      whileHover={{ scale: 1.02, x: 5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick} 
      className="w-full flex items-center justify-between p-4 glass hover:bg-white/5 border border-white/5 rounded-2xl transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="text-zinc-500">{icon}</div>
        <span className="font-bold text-sm text-zinc-300">{label}</span>
      </div>
      <ChevronRight size={16} className="text-zinc-700" />
    </motion.button>
  );
}

