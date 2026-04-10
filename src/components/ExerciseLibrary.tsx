import React, { useState } from 'react';
import { Exercise, ExerciseCategory } from '../types';
import { Search, Info, Play, ChevronRight, X, Dumbbell, Target, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import GripButton from './ui/GripButton';
import { cn } from '../lib/utils';

export const EXERCISE_LIBRARY: Exercise[] = [
  // PETTO
  { id: 'p1', name: 'Panca Piana', category: 'Petto', targetMuscles: ['Pettorali', 'Tricipiti'], equipment: 'Bilanciere / Manubri', type: 'Composto', proNote: 'Fondamentale per la forza massima.', instructions: 'Retrai le scapole e mantieni un leggero arco. Tocca il petto a metà altezza con il bilanciere.', videoUrl: 'https://www.youtube.com/embed/gRVjAtPip0Y' },
  { id: 'p2', name: 'Panca Inclinata (30°)', category: 'Petto', targetMuscles: ['Pettorali (Alto)', 'Tricipiti'], equipment: 'Bilanciere / Manubri', type: 'Composto', proNote: 'Focus fascio clavicolare (alto).', instructions: 'Inclinazione panca a 30 gradi. Spingi verso l\'alto controllando il movimento.', videoUrl: 'https://www.youtube.com/embed/kydayEMT-LQ' },
  { id: 'p3', name: 'Chest Press', category: 'Petto', targetMuscles: ['Pettorali'], equipment: 'Macchinario', type: 'Isolamento', proNote: 'Ideale per raggiungere il cedimento in sicurezza.', instructions: 'Siediti con la schiena ben appoggiata e spingi le maniglie in avanti.', videoUrl: 'https://www.youtube.com/embed/D-4uWv5wMOk' },
  { id: 'p4', name: 'Dips (Parallele)', category: 'Petto', targetMuscles: ['Pettorali (Basso)', 'Tricipiti'], equipment: 'Corpo Libero / Sovraccarico', type: 'Composto', proNote: 'Focus parte inferiore e tricipiti.', instructions: 'Scendi finché le spalle sono sotto i gomiti e risali.', videoUrl: 'https://www.youtube.com/embed/K5JxupmoLW4' },
  { id: 'p5', name: 'Croci (Flyes)', category: 'Petto', targetMuscles: ['Pettorali'], equipment: 'Manubri', type: 'Isolamento', proNote: 'Massimo allungamento del pettorale.', instructions: 'Apri le braccia mantenendo una leggera flessione del gomito.', videoUrl: 'https://www.youtube.com/embed/QENKPHhQVi4' },
  { id: 'p6', name: 'Crossover ai Cavi', category: 'Petto', targetMuscles: ['Pettorali'], equipment: 'Cavi', type: 'Isolamento', proNote: 'Tensione costante e focus contrazione interna.', instructions: 'Tira i cavi verso il centro del corpo incrociando leggermente le mani.', videoUrl: 'https://www.youtube.com/embed/JUDTGZh4rhg' },
  
  // SCHIENA
  { id: 's1', name: 'Trazioni (Pull-ups)', category: 'Schiena', targetMuscles: ['Dorsali', 'Bicipiti'], equipment: 'Corpo Libero / Sovraccarico', type: 'Composto', proNote: 'Il re per la larghezza del Gran Dorsale.', instructions: 'Porta i gomiti verso le costole. Porta il mento sopra la sbarra.', videoUrl: 'https://www.youtube.com/embed/aNUSgyWRJYA' },
  { id: 's2', name: 'Lat Machine', category: 'Schiena', targetMuscles: ['Dorsali'], equipment: 'Cavi / Macchina', type: 'Composto', proNote: 'Ottimo per modulare il carico e isolare il dorso.', instructions: 'Tira la sbarra verso la parte superiore del petto.', videoUrl: 'https://www.youtube.com/embed/80U2numIw-E' },
  { id: 's3', name: 'Rematore (Row)', category: 'Schiena', targetMuscles: ['Dorsali', 'Trapezio'], equipment: 'Bilanciere / Manubri', type: 'Composto', proNote: 'Focus spessore e densità (trapezi/romboidi).', instructions: 'Inclinati in avanti e tira il bilanciere verso l\'ombelico.', videoUrl: 'https://www.youtube.com/embed/FWJR5Ve8bnQ' },
  { id: 's4', name: 'Pulley Basso', category: 'Schiena', targetMuscles: ['Dorsali', 'Romboidi'], equipment: 'Cavi', type: 'Composto', proNote: 'Contrazione di picco facilitata.', instructions: 'Tira la maniglia verso l\'addome mantenendo la schiena dritta.', videoUrl: 'https://www.youtube.com/embed/oX5NDZ5qNno' },
  { id: 's5', name: 'Pull-down Braccia Tese', category: 'Schiena', targetMuscles: ['Dorsali'], equipment: 'Cavi', type: 'Isolamento', proNote: 'Unico per isolare il dorsale senza i bicipiti.', instructions: 'Tira la sbarra verso le cosce mantenendo le braccia quasi tese.', videoUrl: 'https://www.youtube.com/embed/lnec6DdscJU' },
  { id: 's6', name: 'Meadows Row', category: 'Schiena', targetMuscles: ['Dorsali', 'Trapezio'], equipment: 'Bilanciere', type: 'Composto', proNote: 'Variante unilaterale per dettagli muscolari estremi.', instructions: 'Usa un bilanciere a terra (landmine) e tira con un braccio solo.', videoUrl: 'https://www.youtube.com/embed/9ZBsRLRBBdU' },

  // GAMBE
  { id: 'g1', name: 'Back Squat', category: 'Gambe', targetMuscles: ['Quadricipiti', 'Glutei'], equipment: 'Bilanciere', type: 'Composto', proNote: 'Esercizio totale, stimolo metabolico massimo.', instructions: 'Mantieni il petto alto e spingi sui talloni. Assicurati che le ginocchia seguano la linea delle punte dei piedi.', videoUrl: 'https://www.youtube.com/embed/EXaq4VxQ28k' },
  { id: 'g2', name: 'Leg Press 45°', category: 'Gambe', targetMuscles: ['Quadricipiti'], equipment: 'Macchinario', type: 'Composto', proNote: 'Massimo sovraccarico sui quadricipiti.', instructions: 'Spingi la pedana senza bloccare completamente le ginocchia.', videoUrl: 'https://www.youtube.com/embed/RaI6ofF2geQ' },
  { id: 'g3', name: 'Bulgarian Split Squat', category: 'Gambe', targetMuscles: ['Glutei', 'Quadricipiti'], equipment: 'Manubri', type: 'Composto', proNote: 'Distrugge glutei e corregge asimmetrie.', instructions: 'Poggia un piede su una panca dietro di te e scendi con l\'altra gamba.', videoUrl: 'https://www.youtube.com/embed/d14zYzb1cro' },
  { id: 'g4', name: 'Stacco Rumeno (RDL)', category: 'Gambe', targetMuscles: ['Femorali', 'Glutei'], equipment: 'Bilanciere / Manubri', type: 'Catena Post.', proNote: 'Focus bicipiti femorali e glutei in allungamento.', instructions: 'Scendi con il bilanciere lungo le gambe mantenendo la schiena piatta.', videoUrl: 'https://www.youtube.com/embed/pKpQXqtjda8' },
  { id: 'g5', name: 'Leg Extension', category: 'Gambe', targetMuscles: ['Quadricipiti'], equipment: 'Macchinario', type: 'Isolamento', proNote: 'Isolamento puro del quadricipite.', instructions: 'Estendi le gambe completamente e controlla la discesa.', videoUrl: 'https://www.youtube.com/embed/_95-vz83X4M' },
  { id: 'g6', name: 'Leg Curl', category: 'Gambe', targetMuscles: ['Femorali'], equipment: 'Macchinario', type: 'Isolamento', proNote: 'Fondamentale per la salute del ginocchio.', instructions: 'Fletti le gambe portando i talloni verso i glutei.', videoUrl: 'https://www.youtube.com/embed/HLwdesktz60' },
  { id: 'g7', name: 'Calf Raise', category: 'Gambe', targetMuscles: ['Polpacci'], equipment: 'Manubri / Macchina', type: 'Isolamento', proNote: 'Per lo sviluppo del polpaccio (Gastrocnemio).', instructions: 'Sollevati sulle punte dei piedi e scendi lentamente.', videoUrl: 'https://www.youtube.com/embed/gwLzBJYoWlI' },

  // SPALLE
  { id: 'sp1', name: 'Military Press', category: 'Spalle', targetMuscles: ['Deltoidi', 'Core'], equipment: 'Bilanciere', type: 'Composto', proNote: 'Forza esplosiva e stabilità del core.', instructions: 'Spingi il bilanciere in linea retta sopra la testa.', videoUrl: 'https://www.youtube.com/embed/59R4_YnDRSc' },
  { id: 'sp2', name: 'Dumbbell Shoulder Press', category: 'Spalle', targetMuscles: ['Deltoidi'], equipment: 'Manubri', type: 'Composto', proNote: 'Maggior ROM (Range of Motion) rispetto al bilanciere.', instructions: 'Spingi i manubri verso l\'alto partendo dalle spalle.', videoUrl: 'https://www.youtube.com/embed/qEwKCR5JCog' },
  { id: 'sp3', name: 'Alzate Laterali', category: 'Spalle', targetMuscles: ['Deltoide Laterale'], equipment: 'Manubri / Cavi', type: 'Isolamento', proNote: 'L\'unico per le spalle larghe "a cannone".', instructions: 'Solleva le braccia lateralmente fino all\'altezza delle spalle.', videoUrl: 'https://www.youtube.com/embed/dBXo24-xvis' },
  { id: 'sp4', name: 'Face Pull', category: 'Spalle', targetMuscles: ['Deltoide Posteriore', 'Cuffia Rotatori'], equipment: 'Cavi', type: 'Isolamento', proNote: 'Salute della cuffia dei rotatori e deltoide post.', instructions: 'Tira la corda verso il viso aprendo i gomiti.', videoUrl: 'https://www.youtube.com/embed/V8dZ3pyiCBo' },
  { id: 'sp5', name: 'Rear Delt Flyes', category: 'Spalle', targetMuscles: ['Deltoide Posteriore'], equipment: 'Manubri / Cavi', type: 'Isolamento', proNote: 'Corregge la postura e chiude la spalla dietro.', instructions: 'Inclinati in avanti e apri le braccia lateralmente.', videoUrl: 'https://www.youtube.com/embed/NeNdcvHFpWE' },

  // BICIPITI
  { id: 'b1', name: 'Curl Classico', category: 'Bicipiti', targetMuscles: ['Bicipiti'], equipment: 'Bilanciere (EZ o dritto)', type: 'Massa', proNote: 'Il "pane e burro" del bicipite.', instructions: 'Fletti i gomiti portando il bilanciere verso le spalle.', videoUrl: 'https://www.youtube.com/embed/ykJmrZ5v0Oo' },
  { id: 'b2', name: 'Curl Alternato', category: 'Bicipiti', targetMuscles: ['Bicipiti'], equipment: 'Manubri', type: 'Tensione', proNote: 'Permette di ruotare il polso per il picco.', instructions: 'Fletti un braccio alla volta ruotando il palmo verso l\'alto.', videoUrl: 'https://www.youtube.com/embed/8d2we4UqOSs' },
  { id: 'b3', name: 'Incline Dumbbell Curl', category: 'Bicipiti', targetMuscles: ['Bicipiti'], equipment: 'Manubri', type: 'Allungamento', proNote: 'Massima tensione nel punto di partenza.', instructions: 'Siediti su una panca inclinata e fletti i manubri.', videoUrl: 'https://www.youtube.com/embed/S2cYwsDhpI4' },
  { id: 'b4', name: 'Hammer Curl (Martello)', category: 'Bicipiti', targetMuscles: ['Brachiale', 'Bicipiti'], equipment: 'Manubri / Coda al Cavo', type: 'Massa', proNote: 'Lavora il brachiale (fa sembrare il braccio più largo).', instructions: 'Fletti i manubri mantenendo il palmo rivolto verso l\'interno.', videoUrl: 'https://www.youtube.com/embed/IaA2wknVAhg' },
  { id: 'b5', name: 'Bayesian Curl', category: 'Bicipiti', targetMuscles: ['Bicipiti'], equipment: 'Cavi', type: 'Tensione', proNote: 'Tensione costante dietro la schiena.', instructions: 'Dagli le spalle al cavo e fletti il braccio.', videoUrl: 'https://www.youtube.com/embed/8PXe7YNOfb4' },
  { id: 'b6', name: 'Concentration Curl', category: 'Bicipiti', targetMuscles: ['Bicipiti'], equipment: 'Manubri', type: 'Isolamento', proNote: 'Isola il picco senza aiuti dal corpo.', instructions: 'Appoggia il gomito all\'interno della coscia e fletti il manubrio.', videoUrl: 'https://www.youtube.com/embed/gPRZchwuVcA' },

  // TRICIPITI
  { id: 't1', name: 'Panca Stretta', category: 'Tricipiti', targetMuscles: ['Tricipiti', 'Pettorali'], equipment: 'Bilanciere', type: 'Composto', proNote: 'Permette carichi pesanti, massa totale.', instructions: 'Panca piana con impugnatura stretta (larghezza spalle).', videoUrl: 'https://www.youtube.com/embed/a2G3IdaTcPU' },
  { id: 't2', name: 'French Press', category: 'Tricipiti', targetMuscles: ['Tricipiti'], equipment: 'Bilanciere EZ / Manubri', type: 'Allungamento', proNote: 'Enfasi sul capo lungo del tricipite.', instructions: 'Sdraiato, abbassa il bilanciere verso la fronte e riestendi.', videoUrl: 'https://www.youtube.com/embed/r6YICdN2ylU' },
  { id: 't3', name: 'Pushdown', category: 'Tricipiti', targetMuscles: ['Tricipiti'], equipment: 'Cavi (Sbarra o Corda)', type: 'Isolamento', proNote: 'Bruciore estremo e tensione continua.', instructions: 'Spingi la sbarra verso il basso estendendo i gomiti.', videoUrl: 'https://www.youtube.com/embed/ozwo9RGm7QU' },
  { id: 't4', name: 'Overhead Extension', category: 'Tricipiti', targetMuscles: ['Tricipiti'], equipment: 'Manubrio / Cavi', type: 'Allungamento', proNote: 'Lavora il tricipite in massimo allungamento.', instructions: 'Porta il peso dietro la testa ed estendi le braccia verso l\'alto.', videoUrl: 'https://www.youtube.com/embed/KWK7SWJsKkU' },
  { id: 't5', name: 'Dips tra panche', category: 'Tricipiti', targetMuscles: ['Tricipiti'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Ottimo per finire l\'allenamento (finisher).', instructions: 'Appoggia le mani su una panca e i piedi su un\'altra, scendi e risali.', videoUrl: 'https://www.youtube.com/embed/HkUwGnX-7yQ' },
  { id: 't6', name: 'Cross-body Extension', category: 'Tricipiti', targetMuscles: ['Tricipiti'], equipment: 'Cavi', type: 'Isolamento', proNote: 'Angolo biomeccanico perfetto per il tricipite laterale.', instructions: 'Tira il cavo diagonalmente attraverso il corpo.', videoUrl: 'https://www.youtube.com/embed/iIc7t84CxIY' },

  // CORE
  { id: 'c1', name: 'Plank', category: 'Core', targetMuscles: ['Addominali'], equipment: 'Corpo Libero', type: 'Isolamento', proNote: 'Fondamentale per la stabilità del core.', instructions: 'Mantieni il corpo dritto come una tavola appoggiato sugli avambracci.', videoUrl: 'https://www.youtube.com/embed/_lfR4sl0ZCE' },
  { id: 'c2', name: 'Russian Twist', category: 'Core', targetMuscles: ['Obliqui'], equipment: 'Corpo Libero / Palla Medica', type: 'Isolamento', proNote: 'Ottimo per la rotazione del busto.', instructions: 'Ruota il busto da un lato all\'altro tenendo i piedi sollevati.', videoUrl: 'https://www.youtube.com/embed/wkD8rjkodUI' }
];

export default function ExerciseLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [loadVideo, setLoadVideo] = useState(false);

  const handleSelectExercise = (ex: Exercise) => {
    setSelectedExercise(ex);
    setLoadVideo(false); // Reset video state for new exercise
  };

  const filteredExercises = EXERCISE_LIBRARY.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         ex.targetMuscles.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || ex.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories: ExerciseCategory[] = ['Petto', 'Schiena', 'Gambe', 'Spalle', 'Bicipiti', 'Tricipiti', 'Core'];

  const getVideoId = (url?: string) => {
    if (!url) return null;
    return url.split('/').pop();
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
        <input 
          type="text" 
          placeholder="CERCA NELL'ATLANTE..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 font-black uppercase tracking-tighter text-sm focus:ring-1 ring-lime-400 outline-none"
        />
      </div>

      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 gap-2 no-scrollbar">
        {categories.map(cat => (
          <button 
            key={cat} 
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            className={cn(
              "border px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              selectedCategory === cat 
                ? "bg-lime-400 text-black border-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.3)]" 
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-lime-400 hover:border-lime-400"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredExercises.map(ex => (
          <div 
            key={ex.id} 
            onClick={() => handleSelectExercise(ex)}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-lime-400 transition-colors">
                <Play size={20} className="text-zinc-500 group-hover:text-black fill-current" />
              </div>
              <div>
                <h4 className="font-black uppercase tracking-tighter text-sm">{ex.name}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{ex.category}</span>
                  <span className="text-[10px] text-zinc-600">•</span>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{ex.equipment}</span>
                </div>
              </div>
            </div>
            <ChevronRight size={16} className="text-zinc-700" />
          </div>
        ))}
      </div>

      {/* Exercise Detail Modal */}
      <AnimatePresence>
        {selectedExercise && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] overflow-y-auto"
          >
            <div className="p-6 max-w-2xl mx-auto min-h-screen flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Dumbbell className="text-lime-400" />
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic">Voce Atlante</h3>
                </div>
                <button onClick={() => setSelectedExercise(null)} className="p-2 bg-zinc-900 rounded-full">
                  <X size={24} />
                </button>
              </div>

              {/* Video Player */}
              <div className="aspect-video bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 mb-2 relative group">
                {selectedExercise.videoUrl ? (
                  loadVideo ? (
                    <iframe 
                      key={selectedExercise.id}
                      src={`${selectedExercise.videoUrl.replace('youtube.com', 'youtube-nocookie.com')}?autoplay=1`}
                      className="w-full h-full border-0"
                      title={selectedExercise.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      allowFullScreen
                    ></iframe>
                  ) : (
                    <div 
                      onClick={() => setLoadVideo(true)}
                      className="w-full h-full cursor-pointer relative"
                    >
                      <img 
                        src={`https://img.youtube.com/vi/${getVideoId(selectedExercise.videoUrl)}/maxresdefault.jpg`}
                        alt={selectedExercise.name}
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-lime-400 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(163,230,53,0.5)] group-hover:scale-110 transition-transform">
                          <Play size={32} className="text-black fill-current ml-1" />
                        </div>
                        <span className="mt-4 text-[10px] font-black uppercase tracking-widest text-white bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                          Carica Anteprima Video
                        </span>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                    <Play size={48} className="mb-2 opacity-20" />
                    <span className="text-xs font-bold uppercase tracking-widest">Video Non Disponibile</span>
                  </div>
                )}
              </div>
              
              {selectedExercise.videoUrl && (
                <div className="flex justify-center mb-6">
                  <a 
                    href={selectedExercise.videoUrl.replace('/embed/', '/watch?v=')} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:text-lime-400 transition-colors flex items-center gap-1"
                  >
                    Problemi con il video? Apri su YouTube <ChevronRight size={10} />
                  </a>
                </div>
              )}

              <div className="space-y-6 flex-1">
                <div>
                  <h1 className="text-4xl font-black uppercase tracking-tighter italic mb-2">{selectedExercise.name}</h1>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-lime-400 text-black text-[10px] font-black uppercase px-3 py-1 rounded-full">
                      {selectedExercise.category}
                    </span>
                    <span className="bg-zinc-800 text-zinc-300 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-zinc-700">
                      {selectedExercise.equipment}
                    </span>
                    <span className="bg-zinc-800 text-lime-400 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-lime-400/20">
                      {selectedExercise.type}
                    </span>
                  </div>
                </div>

                {selectedExercise.proNote && (
                  <div className="bg-lime-400/10 border border-lime-400/20 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-2 text-lime-400">
                      <Brain size={18} />
                      <h4 className="font-black uppercase tracking-tighter text-sm">Nota Pro</h4>
                    </div>
                    <p className="text-lime-100 text-sm font-bold italic">
                      "{selectedExercise.proNote}"
                    </p>
                  </div>
                )}

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4 text-zinc-400">
                    <Target size={18} />
                    <h4 className="font-black uppercase tracking-tighter text-sm">Muscoli Target</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedExercise.targetMuscles.map(m => (
                      <span key={m} className="bg-zinc-800 text-zinc-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-700">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4 text-zinc-400">
                    <Info size={18} />
                    <h4 className="font-black uppercase tracking-tighter text-sm">Esecuzione</h4>
                  </div>
                  <p className="text-zinc-300 text-sm leading-relaxed font-medium">
                    {selectedExercise.instructions}
                  </p>
                </div>
              </div>

              <div className="mt-8 pb-8">
                <GripButton variant="accent" className="w-full" onClick={() => setSelectedExercise(null)}>
                  CHIUDI ATLANTE
                </GripButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
