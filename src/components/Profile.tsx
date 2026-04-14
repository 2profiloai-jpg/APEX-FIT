import React from 'react';
import { UserProfile } from '../types';
import { User } from 'firebase/auth';
import { auth } from '../firebase';
import { LogOut, Settings, Award, Shield, Bell, ChevronRight, Brain } from 'lucide-react';
import { toast } from 'sonner';
import GripButton from './ui/GripButton';
import { isAIReady } from '../services/geminiService';

export default function Profile({ profile, user, aiStatus }: { profile: UserProfile | null, user: User, aiStatus: 'loading' | 'ready' | 'error' }) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-3xl bg-zinc-800 border-2 border-lime-400 p-1 mb-4">
          <img src={user.photoURL || ''} className="w-full h-full rounded-2xl object-cover" alt="Profile" referrerPolicy="no-referrer" />
        </div>
        <h2 className="text-3xl font-black tracking-tighter italic uppercase">{profile?.displayName}</h2>
        
        <div className={`mt-3 px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 ${aiStatus === 'ready' ? 'bg-lime-400/10 text-lime-400 border-lime-400/20' : aiStatus === 'loading' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          <Brain size={14} />
          {aiStatus === 'ready' ? 'IA ATTIVA' : aiStatus === 'loading' ? 'CARICAMENTO IA...' : 'CHIAVE IA MANCANTE'}
        </div>
      </div>

      <div className="space-y-2">
        <ProfileLink icon={<Award size={18} />} label="Traguardi" onClick={() => toast.info('Traguardi in arrivo presto!')} />
        <ProfileLink icon={<Bell size={18} />} label="Notifiche" onClick={() => toast.info('Impostazioni notifiche in arrivo!')} />
        <ProfileLink icon={<Shield size={18} />} label="Privacy e Sicurezza" onClick={() => toast.info('Privacy in arrivo!')} />
        <ProfileLink icon={<Settings size={18} />} label="Preferenze" onClick={() => toast.info('Preferenze in arrivo!')} />
      </div>

      <GripButton variant="danger" className="w-full" onClick={() => auth.signOut()}>
        <LogOut size={20} /> DISCONNETTI
      </GripButton>
    </div>
  );
}

function ProfileLink({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between p-4 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 rounded-2xl transition-colors">
      <div className="flex items-center gap-3">
        <div className="text-zinc-500">{icon}</div>
        <span className="font-bold text-sm text-zinc-300">{label}</span>
      </div>
      <ChevronRight size={16} className="text-zinc-700" />
    </button>
  );
}

