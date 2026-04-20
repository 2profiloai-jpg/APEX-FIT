import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
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
  Download,
  Milk, // Bottle-like icon
  Droplets,
  Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';

import { BackgroundAIProvider, useBackgroundAI } from './contexts/BackgroundAIContext';
import Dashboard from './components/Dashboard';
import WorkoutHub from './components/WorkoutHub';
import ExerciseLibrary from './components/ExerciseLibrary';
import Profile from './components/Profile';
import NutritionHub from './components/NutritionHub';
import IACoachScreen from './components/IACoachScreen';
import { initAI } from './services/geminiService';
import { Apple } from 'lucide-react';

export default function App() {
  const { tasks } = useBackgroundAI();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workout' | 'library' | 'nutrition' | 'profile' | 'coach'>('dashboard');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [requestedPlanId, setRequestedPlanId] = useState<string | null>(null);
  const [focusedExerciseId, setFocusedExerciseId] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    initAI().then((ready) => {
      console.log("AI Status check:", ready ? 'ready' : 'error');
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
    const handleStartWorkout = (e: any) => {
      setActiveTab('workout');
      if (e.detail?.planId) {
        setRequestedPlanId(e.detail.planId);
      }
      setCurrentSessionId('new');
    };
    window.addEventListener('start-workout', handleStartWorkout);
    return () => window.removeEventListener('start-workout', handleStartWorkout);
  }, []);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsAuthLoading(false);
      
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
        }, (error) => {
          console.error('Firestore Error in App Profile:', error);
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

  const themeColors: Record<string, { hex: string, rgb: string }> = {
    crimson: { hex: '#ff003c', rgb: '255, 0, 60' },
    blaze: { hex: '#ff4e50', rgb: '255, 78, 80' },
    sunset: { hex: '#ff8c00', rgb: '255, 140, 0' },
    amber: { hex: '#f59e0b', rgb: '245, 158, 11' },
    lemon: { hex: '#dfff00', rgb: '223, 255, 0' },
    electric: { hex: '#39ff14', rgb: '57, 255, 20' },
    emerald: { hex: '#50ffb1', rgb: '80, 255, 177' },
    mint: { hex: '#2efef7', rgb: '46, 254, 247' },
    cyan: { hex: '#00ffff', rgb: '0, 255, 255' },
    sky: { hex: '#0ea5e9', rgb: '14, 165, 233' },
    blue: { hex: '#0066ff', rgb: '0, 102, 255' },
    indigo: { hex: '#6366f1', rgb: '99, 102, 241' },
    violet: { hex: '#bf00ff', rgb: '191, 0, 255' },
    fuchsia: { hex: '#ff00ff', rgb: '255, 0, 255' },
    white: { hex: '#ffffff', rgb: '255, 255, 255' },
  };

  const currentTheme = themeColors[profile?.themeColor || 'electric'] || themeColors.electric;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--neon-accent', currentTheme.hex);
    root.style.setProperty('--neon-accent-rgb', currentTheme.rgb);
  }, [currentTheme]);

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

  const root = document.documentElement;

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.7, 0.3] 
          }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <Zap className="text-white w-12 h-12 fill-current scale-x-75" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 bg-neon rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(var(--neon-accent-rgb),0.5)]">
              <Zap className="text-black w-10 h-10 fill-current scale-x-75" />
            </div>
          </div>
          <h1 className="text-5xl font-black tracking-tighter mb-4 italic uppercase">Apex Lift</h1>
          <p className="text-zinc-400 mb-8 font-medium">
            L'ecosistema fitness di nuova generazione. Periodizzazione algoritmica, integrazione biometrica e monitoraggio delle performance d'élite.
          </p>
          
          <div className="space-y-4">
            <button 
              onClick={handleLogin}
              className="w-full bg-white text-black font-bold py-4 px-8 rounded-full flex items-center justify-center gap-3 hover:bg-neon transition-colors shadow-lg"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              INIZIA LA TUA ASCESA
            </button>

            {isInstallable && (
              <button 
                onClick={handleInstallClick}
                className="w-full bg-zinc-900 border border-zinc-800 text-white font-bold py-4 px-8 rounded-full flex items-center justify-center gap-3 hover:border-neon transition-colors"
              >
                <Download className="w-5 h-5 text-neon" />
                INSTALLA L'APP
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-neon selection:text-black overflow-x-hidden w-full"
      style={{ 
        '--neon-accent': currentTheme.hex,
        '--neon-accent-rgb': currentTheme.rgb
      } as React.CSSProperties}
    >
      <Toaster position="top-center" expand={true} richColors theme="dark" />
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-black/40 backdrop-blur-2xl border-b border-white/5 z-50 px-4 flex items-center justify-between overflow-hidden">
        <div className="flex items-center gap-2">
          <Zap className="text-neon w-6 h-6 fill-current neon-led scale-x-75" />
          <span className="font-black tracking-tighter italic uppercase text-xl neon-text">Apex</span>
        </div>
        <div className="flex items-center gap-2">
          {tasks.some(t => t.status === 'pending') && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 bg-neon/10 px-2 py-1 rounded-full border border-neon/20 mr-2"
            >
              <div className="w-2 h-2 rounded-full bg-neon animate-pulse" />
              <Brain size={12} className="text-neon animate-bounce" />
              <span className="text-[8px] font-black uppercase text-neon tracking-widest hidden sm:inline">AI Elaborando...</span>
            </motion.div>
          )}
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            animate={{ 
              textShadow: activeTab === 'coach' ? "none" : "0 0 8px rgba(var(--neon-accent-rgb), 0.8)",
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            onClick={() => setActiveTab('coach')}
            className={cn(
              "relative p-2 rounded-full transition-all ml-1 flex items-center justify-center group",
              activeTab === 'coach' 
                ? "bg-neon text-black shadow-[0_0_25px_rgba(var(--neon-accent-rgb),0.5)]" 
                : "text-neon hover:bg-neon/10"
            )}
          >
            <Brain size={20} className={cn("relative z-10", activeTab === 'coach' ? "" : "drop-shadow-[0_0_5px_rgba(var(--neon-accent-rgb),0.5)]")} />
            
            {/* Glow orbitale esterno quando inattivo */}
            {activeTab !== 'coach' && (
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 bg-neon/5 rounded-full -z-10 blur-md"
              />
            )}
          </motion.button>
          
          <div className="flex items-center gap-3 ml-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              <img src={user.photoURL || ''} alt="Profile" referrerPolicy="no-referrer" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-32 px-4 max-w-2xl mx-auto overflow-x-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Dashboard profile={profile} aiStatus={aiStatus} />
            </motion.div>
          )}
          {activeTab === 'workout' && (
            <motion.div 
              key="workout" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <WorkoutHub 
                profile={profile}
                requestedPlanId={requestedPlanId} 
                onClearRequest={() => setRequestedPlanId(null)} 
                onNavigateToLibrary={(exerciseId) => {
                  setFocusedExerciseId(exerciseId);
                  setActiveTab('library');
                }} 
              />
            </motion.div>
          )}
          {activeTab === 'library' && (
            <motion.div 
              key="library" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ExerciseLibrary 
                focusedExerciseId={focusedExerciseId} 
                onReturn={() => {
                  setFocusedExerciseId(null);
                  setActiveTab('workout');
                }} 
              />
            </motion.div>
          )}
          {activeTab === 'nutrition' && (
            <motion.div 
              key="nutrition" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <NutritionHub profile={profile} />
            </motion.div>
          )}
          {activeTab === 'profile' && (
            <motion.div 
              key="profile" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Profile profile={profile} user={user} aiStatus={aiStatus} />
            </motion.div>
          )}
          {activeTab === 'coach' && (
            <motion.div 
              key="coach" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <IACoachScreen profile={profile} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom))] bg-black/40 backdrop-blur-2xl border-t border-white/5 z-50 px-2 flex items-center justify-around pb-safe">
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Activity className={activeTab === 'dashboard' ? 'neon-led' : ''} />} />
        <NavButton active={activeTab === 'workout'} onClick={() => setActiveTab('workout')} icon={<Dumbbell className={activeTab === 'workout' ? 'neon-led' : ''} />} />
        <NavButton active={activeTab === 'nutrition'} onClick={() => setActiveTab('nutrition')} icon={<Apple className={activeTab === 'nutrition' ? 'neon-led' : ''} />} />
        <NavButton active={activeTab === 'library'} onClick={() => setActiveTab('library')} icon={<Book className={activeTab === 'library' ? 'neon-led' : ''} />} />
        <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon className={activeTab === 'profile' ? 'neon-led' : ''} />} />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: React.ReactNode }) {
  return (
    <motion.button 
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center transition-colors relative h-12 w-12 justify-center",
        active ? "text-neon" : "text-zinc-500"
      )}
    >
      {active && (
        <motion.div 
          layoutId="nav-glow"
          className="absolute -inset-2 bg-neon/10 blur-xl rounded-full -z-10"
        />
      )}
      {icon}
    </motion.button>
  );
}
