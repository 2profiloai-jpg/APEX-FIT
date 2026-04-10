import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { UserProfile, WorkoutSession, BiometricLog } from './types';
import { cn } from './lib/utils';
import { 
  Dumbbell, 
  Activity, 
  Book, 
  User as UserIcon, 
  Plus, 
  Zap, 
  TrendingUp,
  Clock,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';

// Components
import Dashboard from './components/Dashboard';
import WorkoutHub from './components/WorkoutHub';
import ExerciseLibrary from './components/ExerciseLibrary';
import Profile from './components/Profile';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workout' | 'library' | 'profile'>('dashboard');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    const handleStartWorkout = () => {
      setActiveTab('workout');
      setCurrentSessionId('new');
    };
    window.addEventListener('start-workout', handleStartWorkout);
    return () => window.removeEventListener('start-workout', handleStartWorkout);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          const newProfile: UserProfile = {
            uid: user.uid,
            displayName: user.displayName || 'Athlete',
            email: user.email || '',
            readinessScore: 85,
            lastSync: new Date().toISOString(),
            preferences: {}
          };
          await setDoc(doc(db, 'users', user.uid), newProfile);
          setProfile(newProfile);
        } else {
          setProfile(userDoc.data() as UserProfile);
        }
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md"
        >
          <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 bg-lime-400 rounded-full flex items-center justify-center">
              <Zap className="text-black w-10 h-10 fill-current" />
            </div>
          </div>
          <h1 className="text-5xl font-black tracking-tighter mb-4 italic uppercase">Apex Lift</h1>
          <p className="text-zinc-400 mb-8 font-medium">
            L'ecosistema fitness di nuova generazione. Periodizzazione algoritmica, integrazione biometrica e monitoraggio delle performance d'élite.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full bg-white text-black font-bold py-4 px-8 rounded-full flex items-center justify-center gap-3 hover:bg-lime-400 transition-colors"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            INIZIA LA TUA ASCESA
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-lime-400 selection:text-black">
      <Toaster position="top-center" expand={true} richColors theme="dark" />
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 z-50 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="text-lime-400 w-6 h-6 fill-current" />
          <span className="font-black tracking-tighter italic uppercase text-xl">Apex</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Prontezza</span>
            <span className="text-lime-400 font-mono font-bold">{profile?.readinessScore}%</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden">
            <img src={user.photoURL || ''} alt="Profile" referrerPolicy="no-referrer" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-24 px-4 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <Dashboard profile={profile} />
            </motion.div>
          )}
          {activeTab === 'workout' && (
            <motion.div key="workout" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <WorkoutHub />
            </motion.div>
          )}
          {activeTab === 'library' && (
            <motion.div key="library" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <ExerciseLibrary />
            </motion.div>
          )}
          {activeTab === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <Profile profile={profile} user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-950 border-t border-zinc-800 z-50 px-6 flex items-center justify-around">
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Activity />} label="Dashboard" />
        <NavButton active={activeTab === 'workout'} onClick={() => setActiveTab('workout')} icon={<Dumbbell />} label="Allenati" />
        <NavButton active={activeTab === 'library'} onClick={() => setActiveTab('library')} icon={<Book />} label="Atlante" />
        <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon />} label="Profilo" />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-colors",
        active ? "text-lime-400" : "text-zinc-500"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}
