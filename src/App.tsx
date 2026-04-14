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
  ChevronRight,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';

// Components
import Dashboard from './components/Dashboard';
import WorkoutHub from './components/WorkoutHub';
import ExerciseLibrary from './components/ExerciseLibrary';
import Profile from './components/Profile';
import NutritionHub from './components/NutritionHub';
import { initAI } from './services/geminiService';
import { Apple } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workout' | 'library' | 'nutrition' | 'profile'>('dashboard');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    initAI().then((ready) => {
      setAiStatus(ready ? 'ready' : 'error');
    });
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setIsInstallable(false);
      setDeferredPrompt(null);
    } else {
      console.log('User dismissed the install prompt');
    }
  };

  useEffect(() => {
    const handleStartWorkout = () => {
      setActiveTab('workout');
      setCurrentSessionId('new');
    };
    window.addEventListener('start-workout', handleStartWorkout);
    return () => window.removeEventListener('start-workout', handleStartWorkout);
  }, []);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        
        // Check if exists first to create default if needed
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          const newProfile: UserProfile = {
            uid: user.uid,
            displayName: user.displayName || 'Athlete',
            email: user.email || '',
            readinessScore: 85,
            lastSync: new Date().toISOString(),
            preferences: {}
          };
          await setDoc(userRef, newProfile);
        }

        // Listen to real-time updates
        profileUnsubscribe = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            setProfile(doc.data() as UserProfile);
          }
        });
      } else {
        setProfile(null);
        if (profileUnsubscribe) {
          profileUnsubscribe();
        }
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, []);

  const [exitWarning, setExitWarning] = useState(false);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // If there's a hash, it means a modal is open and it will handle its own popstate
      if (window.location.hash || window.history.state?.modal) {
        return;
      }

      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
        window.history.pushState(null, '', window.location.pathname);
      } else {
        if (!exitWarning) {
          setExitWarning(true);
          toast('Premi di nuovo indietro per uscire', { duration: 2000 });
          window.history.pushState(null, '', window.location.pathname);
          setTimeout(() => setExitWarning(false), 2000);
        } else {
          window.history.back();
        }
      }
    };

    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, exitWarning]);

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
          className="max-w-md w-full"
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
          
          <div className="space-y-4">
            <button 
              onClick={handleLogin}
              className="w-full bg-white text-black font-bold py-4 px-8 rounded-full flex items-center justify-center gap-3 hover:bg-lime-400 transition-colors"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              INIZIA LA TUA ASCESA
            </button>

            {isInstallable && (
              <button 
                onClick={handleInstallClick}
                className="w-full bg-zinc-900 border border-zinc-800 text-white font-bold py-4 px-8 rounded-full flex items-center justify-center gap-3 hover:border-lime-400 transition-colors"
              >
                <Download className="w-5 h-5 text-lime-400" />
                INSTALLA L'APP
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-lime-400 selection:text-black">
      <Toaster position="top-center" expand={true} richColors theme="dark" />
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-black/40 backdrop-blur-2xl border-b border-white/5 z-50 px-4 flex items-center justify-between">
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
            <motion.div 
              key="dashboard" 
              initial={{ opacity: 0, y: 20, scale: 0.98 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <Dashboard profile={profile} aiStatus={aiStatus} />
            </motion.div>
          )}
          {activeTab === 'workout' && (
            <motion.div 
              key="workout" 
              initial={{ opacity: 0, y: 20, scale: 0.98 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <WorkoutHub />
            </motion.div>
          )}
          {activeTab === 'library' && (
            <motion.div 
              key="library" 
              initial={{ opacity: 0, y: 20, scale: 0.98 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <ExerciseLibrary />
            </motion.div>
          )}
          {activeTab === 'nutrition' && (
            <motion.div 
              key="nutrition" 
              initial={{ opacity: 0, y: 20, scale: 0.98 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <NutritionHub profile={profile} />
            </motion.div>
          )}
          {activeTab === 'profile' && (
            <motion.div 
              key="profile" 
              initial={{ opacity: 0, y: 20, scale: 0.98 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <Profile profile={profile} user={user} aiStatus={aiStatus} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-black/40 backdrop-blur-2xl border-t border-white/5 z-50 px-2 flex items-center justify-around">
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Activity />} label="Home" />
        <NavButton active={activeTab === 'workout'} onClick={() => setActiveTab('workout')} icon={<Dumbbell />} label="Allenati" />
        <NavButton active={activeTab === 'nutrition'} onClick={() => setActiveTab('nutrition')} icon={<Apple />} label="Nutrizione" />
        <NavButton active={activeTab === 'library'} onClick={() => setActiveTab('library')} icon={<Book />} label="Atlante" />
        <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon />} label="Profilo" />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <motion.button 
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-colors relative",
        active ? "text-lime-400" : "text-zinc-500"
      )}
    >
      {active && (
        <motion.div 
          layoutId="nav-glow"
          className="absolute -inset-2 bg-lime-400/10 blur-xl rounded-full -z-10"
        />
      )}
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </motion.button>
  );
}
