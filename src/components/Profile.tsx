import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { LogOut, Settings, Award, Shield, Bell, ChevronRight, Brain, User as UserIcon, Clock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
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
  const [themeColor, setThemeColor] = useState(profile?.themeColor || 'blue');
  const [isSaving, setIsSaving] = useState(false);

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
    }
  }, [profile]);

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
        bodyFat
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

      {/* Theme Selection Section */}
      <motion.section 
        whileHover={{ scale: 1.01 }}
        className="glass rounded-3xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <Settings className="text-neon" size={20} />
          <h3 className="font-black uppercase tracking-tighter text-sm italic">Personalizzazione Tema</h3>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { id: 'blue', hex: '#3b82f6' },
            { id: 'red', hex: '#ef4444' },
            { id: 'green', hex: '#22c55e' },
            { id: 'yellow', hex: '#eab308' },
            { id: 'purple', hex: '#a855f7' },
            { id: 'pink', hex: '#ec4899' },
            { id: 'orange', hex: '#f97316' },
            { id: 'cyan', hex: '#06b6d4' }
          ].map(c => (
            <motion.button
              key={c.id}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleSaveTheme(c.id)}
              className={cn(
                "w-full aspect-square rounded-2xl border-2 transition-all shadow-lg",
                themeColor === c.id ? "border-white scale-110" : "border-transparent opacity-60"
              )}
              style={{ backgroundColor: c.hex, boxShadow: themeColor === c.id ? `0 0 20px ${c.hex}` : 'none' }}
            />
          ))}
        </div>
      </motion.section>

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
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Obiettivo</label>
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
        <ProfileLink icon={<Settings size={18} />} label="Preferenze" onClick={() => toast.info('Preferenze in arrivo!')} />
      </div>

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

