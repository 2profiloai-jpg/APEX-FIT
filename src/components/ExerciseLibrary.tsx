import React, { useState, useEffect } from 'react';
import { Exercise, ExerciseCategory } from '../types';
import { Search, Info, Play, ChevronRight, X, Dumbbell, Target, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import GripButton from './ui/GripButton';
import { cn } from '../lib/utils';

export const EXERCISE_LIBRARY: Exercise[] = [
  // PETTO
  { id: 'p1', name: 'Panca Piana', category: 'Petto', targetMuscles: ['Pettorali', 'Tricipiti', 'Deltoidi Anteriori'], equipment: 'Bilanciere', type: 'Composto', proNote: 'Fondamentale per la forza massima.', instructions: '1. Sdraiati sulla panca, piedi ben piantati a terra.\n2. Afferra il bilanciere con una presa leggermente più ampia delle spalle.\n3. Retrai e deprimi le scapole creando un leggero arco dorsale.\n4. Scendi controllando il peso fino a toccare la parte bassa del petto.\n5. Spingi in modo esplosivo verso l\'alto.', videoUrl: 'https://www.youtube.com/embed/kWrRwATrqpc' },
  { id: 'p2', name: 'Panca Inclinata (30°)', category: 'Petto', targetMuscles: ['Pettorali (Alto)', 'Tricipiti'], equipment: 'Bilanciere / Manubri', type: 'Composto', proNote: 'Focus fascio clavicolare (alto).', instructions: '1. Imposta la panca a 30-45 gradi.\n2. Mantieni il petto in fuori e le scapole addotte.\n3. Scendi lentamente fino a sfiorare la parte alta del petto.\n4. Spingi verso l\'alto senza bloccare completamente i gomiti per mantenere la tensione.', videoUrl: 'https://www.youtube.com/embed/efLdmMFaq6w' },
  { id: 'p3', name: 'Chest Press', category: 'Petto', targetMuscles: ['Pettorali'], equipment: 'Macchinario', type: 'Isolamento', proNote: 'Ideale per raggiungere il cedimento in sicurezza.', instructions: '1. Regola il seggiolino in modo che le maniglie siano all\'altezza del centro petto.\n2. Appoggia bene la schiena e mantieni il petto alto.\n3. Spingi le maniglie in avanti espirando.\n4. Torna alla posizione di partenza controllando il peso.', videoUrl: 'https://www.youtube.com/embed/owBLWrfCOFE' },
  { id: 'p4', name: 'Dips (Parallele)', category: 'Petto', targetMuscles: ['Pettorali (Basso)', 'Tricipiti'], equipment: 'Corpo Libero / Sovraccarico', type: 'Composto', proNote: 'Focus parte inferiore e tricipiti.', instructions: '1. Afferra le parallele e sollevati a braccia tese.\n2. Inclinati leggermente in avanti per focalizzare il lavoro sul petto.\n3. Scendi piegando i gomiti finché le spalle sono sotto il livello dei gomiti.\n4. Spingi per tornare alla posizione di partenza.', videoUrl: 'https://www.youtube.com/embed/SLVwguvd6io' },
  { id: 'p5', name: 'Croci (Flyes)', category: 'Petto', targetMuscles: ['Pettorali'], equipment: 'Manubri', type: 'Isolamento', proNote: 'Massimo allungamento del pettorale.', instructions: '1. Sdraiati su panca piana o inclinata con i manubri in alto.\n2. Mantieni una leggera flessione dei gomiti fissa per tutto il movimento.\n3. Apri le braccia lateralmente fino a sentire un buon allungamento del petto.\n4. Contrai i pettorali per riportare i manubri in alto, come se volessi abbracciare un albero.', videoUrl: 'https://www.youtube.com/embed/D6NExpqpAlo' },
  { id: 'p6', name: 'Crossover ai Cavi', category: 'Petto', targetMuscles: ['Pettorali'], equipment: 'Cavi', type: 'Isolamento', proNote: 'Tensione costante e focus contrazione interna.', instructions: '1. Posizionati al centro dei cavi alti o medi.\n2. Fai un passo in avanti per creare tensione e stabilizzati.\n3. Tira i cavi verso il centro del corpo incrociando leggermente le mani a fine movimento.\n4. Rilascia lentamente controllando la fase eccentrica.', videoUrl: 'https://www.youtube.com/embed/1Pd1roQBMdI' },
  
  // SCHIENA
  { id: 's1', name: 'Trazioni (Pull-ups)', category: 'Schiena', targetMuscles: ['Dorsali', 'Bicipiti'], equipment: 'Corpo Libero / Sovraccarico', type: 'Composto', proNote: 'Il re per la larghezza del Gran Dorsale.', instructions: '1. Afferra la sbarra con una presa prona (palmi in avanti) poco più larga delle spalle.\n2. Inizia il movimento deprimendo le scapole (spalle lontane dalle orecchie).\n3. Tira portando i gomiti verso le costole finché il mento supera la sbarra.\n4. Scendi in modo controllato fino a stendere quasi del tutto le braccia.', videoUrl: 'https://www.youtube.com/embed/Z5haXppd7EQ' },
  { id: 's2', name: 'Lat Machine', category: 'Schiena', targetMuscles: ['Dorsali'], equipment: 'Cavi / Macchina', type: 'Composto', proNote: 'Ottimo per modulare il carico e isolare il dorso.', instructions: '1. Siediti e blocca le ginocchia sotto i rulli.\n2. Afferra la sbarra larga e inclina leggermente il busto indietro.\n3. Tira la sbarra verso la parte alta del petto, concentrandoti sull\'abbassare i gomiti.\n4. Rilascia lentamente allungando bene i dorsali.', videoUrl: 'https://www.youtube.com/embed/NL6Lqd6nU-g' },
  { id: 's3', name: 'Rematore (Row)', category: 'Schiena', targetMuscles: ['Dorsali', 'Trapezio', 'Romboidi'], equipment: 'Bilanciere / Manubri', type: 'Composto', proNote: 'Focus spessore e densità (trapezi/romboidi).', instructions: '1. Piegati in avanti mantenendo la schiena dritta e il core contratto.\n2. Lascia pendere il bilanciere o i manubri a braccia tese.\n3. Tira il peso verso l\'ombelico, stringendo le scapole tra loro.\n4. Abbassa il peso in modo controllato.', videoUrl: 'https://www.youtube.com/embed/LkBuqGTKf-4' },
  { id: 's4', name: 'Pulley Basso', category: 'Schiena', targetMuscles: ['Dorsali', 'Romboidi'], equipment: 'Cavi', type: 'Composto', proNote: 'Contrazione di picco facilitata.', instructions: '1. Siediti con le ginocchia leggermente piegate e la schiena dritta.\n2. Afferra il triangolo o la sbarra.\n3. Tira la maniglia verso l\'addome mantenendo i gomiti vicini al corpo.\n4. Allunga le braccia in avanti senza incurvare la schiena.', videoUrl: 'https://www.youtube.com/embed/fmCHxXLZXLU' },
  { id: 's5', name: 'Pull-down Braccia Tese', category: 'Schiena', targetMuscles: ['Dorsali'], equipment: 'Cavi', type: 'Isolamento', proNote: 'Unico per isolare il dorsale senza i bicipiti.', instructions: '1. In piedi davanti al cavo alto, afferra la sbarra o la corda.\n2. Inclina leggermente il busto in avanti e tieni le braccia quasi tese.\n3. Tira il cavo verso le cosce usando solo la forza dei dorsali.\n4. Risali lentamente controllando la tensione.', videoUrl: 'https://www.youtube.com/embed/2AhFDt4AU64' },
  { id: 's6', name: 'Meadows Row', category: 'Schiena', targetMuscles: ['Dorsali', 'Trapezio'], equipment: 'Bilanciere', type: 'Composto', proNote: 'Variante unilaterale per dettagli muscolari estremi.', instructions: '1. Posizionati lateralmente rispetto a un bilanciere a terra (landmine).\n2. Afferra l\'estremità del bilanciere con una mano.\n3. Tira verso l\'alto portando il gomito in alto e all\'indietro.\n4. Controlla la discesa per il massimo allungamento.', videoUrl: 'https://www.youtube.com/embed/VpzKTWJy7Gs' },

  // GAMBE
  { id: 'g1', name: 'Back Squat', category: 'Gambe', targetMuscles: ['Quadricipiti', 'Glutei'], equipment: 'Bilanciere', type: 'Composto', proNote: 'Esercizio totale, stimolo metabolico massimo.', instructions: '1. Posiziona il bilanciere sui trapezi e stacca.\n2. Piedi larghezza spalle, punte leggermente in fuori.\n3. Scendi spingendo il bacino indietro e le ginocchia in fuori, mantenendo il petto alto.\n4. Scendi sotto il parallelo se la mobilità lo permette, poi spingi forte sui talloni per risalire.', videoUrl: 'https://www.youtube.com/embed/zl9b7_1XU8s' },
  { id: 'g2', name: 'Leg Press 45°', category: 'Gambe', targetMuscles: ['Quadricipiti', 'Glutei'], equipment: 'Macchinario', type: 'Composto', proNote: 'Massimo sovraccarico sui quadricipiti.', instructions: '1. Siediti e posiziona i piedi sulla pedana (più bassi per i quadricipiti, più alti per i glutei).\n2. Sblocca la sicurezza e scendi lentamente piegando le ginocchia.\n3. Spingi la pedana verso l\'alto senza bloccare completamente le articolazioni a fine corsa.\n4. Mantieni la schiena e il bacino sempre aderenti allo schienale.', videoUrl: 'https://www.youtube.com/embed/mAweueISnMI' },
  { id: 'g3', name: 'Bulgarian Split Squat', category: 'Gambe', targetMuscles: ['Glutei', 'Quadricipiti'], equipment: 'Manubri', type: 'Composto', proNote: 'Distrugge glutei e corregge asimmetrie.', instructions: '1. Posizionati di schiena a una panca e appoggia il collo del piede posteriore su di essa.\n2. Fai un passo in avanti con la gamba di lavoro.\n3. Scendi verticalmente finché il ginocchio posteriore sfiora il pavimento.\n4. Spingi con il tallone della gamba anteriore per tornare su.', videoUrl: 'https://www.youtube.com/embed/QfUOjm2LmJk' },
  { id: 'g4', name: 'Stacco Rumeno (RDL)', category: 'Gambe', targetMuscles: ['Femorali', 'Glutei'], equipment: 'Bilanciere / Manubri', type: 'Catena Post.', proNote: 'Focus bicipiti femorali e glutei in allungamento.', instructions: '1. In piedi, tieni il bilanciere a contatto con le cosce.\n2. Ginocchia leggermente sbloccate ma fisse.\n3. Spingi il bacino all\'indietro mantenendo la schiena dritta, facendo scivolare il bilanciere lungo le gambe.\n4. Quando senti tirare i femorali, contrai i glutei per tornare in posizione eretta.', videoUrl: 'https://www.youtube.com/embed/SkHRgado_vQ' },
  { id: 'g5', name: 'Leg Extension', category: 'Gambe', targetMuscles: ['Quadricipiti'], equipment: 'Macchinario', type: 'Isolamento', proNote: 'Isolamento puro del quadricipite.', instructions: '1. Siediti sulla macchina allineando il ginocchio con il perno di rotazione.\n2. Posiziona il rullo sulle caviglie.\n3. Estendi le gambe contraendo i quadricipiti al massimo.\n4. Controlla la fase di discesa senza far toccare i pesi.', videoUrl: 'https://www.youtube.com/embed/wRSr98kKUsg' },
  { id: 'g6', name: 'Leg Curl', category: 'Gambe', targetMuscles: ['Femorali'], equipment: 'Macchinario', type: 'Isolamento', proNote: 'Fondamentale per la salute del ginocchio.', instructions: '1. Sdraiati prono o siediti (a seconda della macchina) allineando le ginocchia al perno.\n2. Posiziona il rullo dietro le caviglie.\n3. Fletti le gambe portando i talloni verso i glutei.\n4. Rilascia lentamente controllando il peso.', videoUrl: 'https://www.youtube.com/embed/_lgE0gPvbik' },
  { id: 'g7', name: 'Calf Raise', category: 'Gambe', targetMuscles: ['Polpacci'], equipment: 'Manubri / Macchina', type: 'Isolamento', proNote: 'Per lo sviluppo del polpaccio (Gastrocnemio).', instructions: '1. Posiziona gli avampiedi su un rialzo.\n2. Scendi con i talloni verso il basso per allungare al massimo i polpacci.\n3. Spingi verso l\'alto contraendo forte i polpacci in cima.\n4. Mantieni la contrazione per un secondo prima di scendere.', videoUrl: 'https://www.youtube.com/embed/DMVIdy90-HA' },

  // SPALLE
  { id: 'sp1', name: 'Military Press', category: 'Spalle', targetMuscles: ['Deltoidi', 'Core'], equipment: 'Bilanciere', type: 'Composto', proNote: 'Forza esplosiva e stabilità del core.', instructions: '1. In piedi, afferra il bilanciere larghezza spalle, appoggiato sulle clavicole.\n2. Contrai glutei e addome per stabilizzare il corpo.\n3. Spingi il bilanciere dritto sopra la testa incastrando la testa in avanti a fine movimento.\n4. Riporta il bilanciere al petto in modo controllato.', videoUrl: 'https://www.youtube.com/embed/zCMQI1RHB1U' },
  { id: 'sp2', name: 'Dumbbell Shoulder Press', category: 'Spalle', targetMuscles: ['Deltoidi'], equipment: 'Manubri', type: 'Composto', proNote: 'Maggior ROM (Range of Motion) rispetto al bilanciere.', instructions: '1. Siediti su una panca con schienale a 90° o leggermente inclinato.\n2. Porta i manubri all\'altezza delle spalle con i palmi in avanti.\n3. Spingi verso l\'alto fino a sfiorare i manubri tra loro.\n4. Scendi lentamente fino a che i manubri sono a livello delle orecchie.', videoUrl: 'https://www.youtube.com/embed/GcY6TZxfS0k' },
  { id: 'sp3', name: 'Alzate Laterali', category: 'Spalle', targetMuscles: ['Deltoide Laterale'], equipment: 'Manubri / Cavi', type: 'Isolamento', proNote: 'L\'unico per le spalle larghe "a cannone".', instructions: '1. In piedi, tieni i manubri lungo i fianchi con i gomiti leggermente piegati.\n2. Solleva le braccia lateralmente guidando il movimento con i gomiti.\n3. Fermati quando le braccia sono parallele al pavimento.\n4. Scendi lentamente resistendo al peso.', videoUrl: 'https://www.youtube.com/embed/9yg83KalYTo' },
  { id: 'sp4', name: 'Face Pull', category: 'Spalle', targetMuscles: ['Deltoide Posteriore', 'Cuffia Rotatori'], equipment: 'Cavi', type: 'Isolamento', proNote: 'Salute della cuffia dei rotatori e deltoide post.', instructions: '1. Imposta il cavo all\'altezza del viso con una corda.\n2. Afferra la corda e fai un passo indietro.\n3. Tira la corda verso il viso, aprendo i gomiti all\'esterno e ruotando le spalle all\'indietro.\n4. Contrai forte la parte alta della schiena e torna in posizione.', videoUrl: 'https://www.youtube.com/embed/ZLIVcFhk8N4' },
  { id: 'sp5', name: 'Rear Delt Flyes', category: 'Spalle', targetMuscles: ['Deltoide Posteriore'], equipment: 'Manubri / Cavi', type: 'Isolamento', proNote: 'Corregge la postura e chiude la spalla dietro.', instructions: '1. Piegati in avanti a 90 gradi o sdraiati prono su una panca inclinata.\n2. Tieni i manubri con le braccia leggermente flesse.\n3. Apri le braccia lateralmente stringendo le scapole.\n4. Ritorna lentamente alla posizione di partenza.', videoUrl: 'https://www.youtube.com/embed/3gJXpfwg_go' },

  // BICIPITI
  { id: 'b1', name: 'Curl Classico', category: 'Bicipiti', targetMuscles: ['Bicipiti'], equipment: 'Bilanciere (EZ o dritto)', type: 'Massa', proNote: 'Il "pane e burro" del bicipite.', instructions: '1. In piedi, afferra il bilanciere con presa supina (palmi in alto).\n2. Tieni i gomiti incollati ai fianchi.\n3. Fletti le braccia portando il bilanciere verso il petto.\n4. Scendi lentamente estendendo completamente le braccia.', videoUrl: 'https://www.youtube.com/embed/1Qp04kK-k6U' },
  { id: 'b2', name: 'Curl Alternato', category: 'Bicipiti', targetMuscles: ['Bicipiti'], equipment: 'Manubri', type: 'Tensione', proNote: 'Permette di ruotare il polso per il picco.', instructions: '1. In piedi o seduto, tieni i manubri lungo i fianchi (presa a martello).\n2. Fletti un braccio ruotando il polso verso l\'alto (supinazione) durante la salita.\n3. Contrai il bicipite in cima e scendi lentamente.\n4. Ripeti con l\'altro braccio.', videoUrl: 'https://www.youtube.com/embed/RhVdFHcHKDE' },
  { id: 'b3', name: 'Incline Dumbbell Curl', category: 'Bicipiti', targetMuscles: ['Bicipiti'], equipment: 'Manubri', type: 'Allungamento', proNote: 'Massima tensione nel punto di partenza.', instructions: '1. Siediti su una panca inclinata a 45-60 gradi.\n2. Lascia pendere le braccia dritte verso il basso.\n3. Fletti entrambe le braccia mantenendo i gomiti fermi e puntati verso il basso.\n4. Rilascia lentamente per massimizzare l\'allungamento.', videoUrl: 'https://www.youtube.com/embed/1Qp04kK-k6U' },
  { id: 'b4', name: 'Hammer Curl (Martello)', category: 'Bicipiti', targetMuscles: ['Brachiale', 'Bicipiti'], equipment: 'Manubri / Coda al Cavo', type: 'Massa', proNote: 'Lavora il brachiale (fa sembrare il braccio più largo).', instructions: '1. In piedi, tieni i manubri con i palmi rivolti l\'uno verso l\'altro (presa neutra).\n2. Fletti le braccia mantenendo questa presa fissa.\n3. Contrai in cima e scendi in modo controllato.\n4. I gomiti devono rimanere fermi ai lati del corpo.', videoUrl: 'https://www.youtube.com/embed/OPqe0kCxmR8' },
  { id: 'b5', name: 'Bayesian Curl', category: 'Bicipiti', targetMuscles: ['Bicipiti'], equipment: 'Cavi', type: 'Tensione', proNote: 'Tensione costante dietro la schiena.', instructions: '1. Posizionati dando le spalle al cavo basso.\n2. Afferra la maniglia e fai un passo in avanti in modo che il braccio sia teso dietro di te.\n3. Fletti il braccio portando la mano verso la spalla.\n4. Rilascia lentamente mantenendo la tensione continua.', videoUrl: 'https://www.youtube.com/embed/PNXipCKf_bU' },
  { id: 'b6', name: 'Concentration Curl', category: 'Bicipiti', targetMuscles: ['Bicipiti'], equipment: 'Manubri', type: 'Isolamento', proNote: 'Isola il picco senza aiuti dal corpo.', instructions: '1. Siediti su una panca, gambe divaricate.\n2. Appoggia il tricipite all\'interno della coscia.\n3. Fletti il braccio isolando completamente il bicipite.\n4. Scendi lentamente fino alla completa estensione.', videoUrl: 'https://www.youtube.com/embed/I_bKCYL2nL8' },

  // TRICIPITI
  { id: 't1', name: 'Panca Stretta', category: 'Tricipiti', targetMuscles: ['Tricipiti', 'Pettorali'], equipment: 'Bilanciere', type: 'Composto', proNote: 'Permette carichi pesanti, massa totale.', instructions: '1. Sdraiati sulla panca piana.\n2. Afferra il bilanciere con una presa stretta (circa larghezza spalle).\n3. Scendi portando i gomiti vicini al corpo fino a toccare il petto basso.\n4. Spingi verso l\'alto concentrandoti sull\'estensione dei tricipiti.', videoUrl: 'https://www.youtube.com/embed/wj7A2IuFxhw' },
  { id: 't2', name: 'French Press', category: 'Tricipiti', targetMuscles: ['Tricipiti'], equipment: 'Bilanciere EZ / Manubri', type: 'Allungamento', proNote: 'Enfasi sul capo lungo del tricipite.', instructions: '1. Sdraiati su panca piana tenendo il bilanciere sopra il petto a braccia tese.\n2. Piega solo i gomiti portando il bilanciere verso la fronte o dietro la testa.\n3. Mantieni i gomiti fermi e puntati verso il soffitto.\n4. Estendi le braccia per tornare alla posizione iniziale.', videoUrl: 'https://www.youtube.com/embed/moh_O_hHMFs' },
  { id: 't3', name: 'Pushdown', category: 'Tricipiti', targetMuscles: ['Tricipiti'], equipment: 'Cavi (Sbarra o Corda)', type: 'Isolamento', proNote: 'Bruciore estremo e tensione continua.', instructions: '1. In piedi davanti al cavo alto, afferra la sbarra o la corda.\n2. Tieni i gomiti incollati ai fianchi.\n3. Spingi verso il basso estendendo completamente le braccia e contraendo i tricipiti.\n4. Risali controllando il peso fino a formare un angolo di 90 gradi con le braccia.', videoUrl: 'https://www.youtube.com/embed/z-GYsUm3f9c' },
  { id: 't4', name: 'Overhead Extension', category: 'Tricipiti', targetMuscles: ['Tricipiti'], equipment: 'Manubrio / Cavi', type: 'Allungamento', proNote: 'Lavora il tricipite in massimo allungamento.', instructions: '1. In piedi o seduto, tieni un manubrio o la corda del cavo dietro la testa.\n2. I gomiti devono puntare verso l\'alto.\n3. Estendi le braccia spingendo il peso verso il soffitto.\n4. Scendi lentamente per allungare bene i tricipiti.', videoUrl: 'https://www.youtube.com/embed/c3ny8R-RouU' },
  { id: 't5', name: 'Dips tra panche', category: 'Tricipiti', targetMuscles: ['Tricipiti'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Ottimo per finire l\'allenamento (finisher).', instructions: '1. Posiziona due panche parallele.\n2. Appoggia le mani sul bordo di una panca e i talloni sull\'altra.\n3. Scendi piegando i gomiti finché le braccia formano un angolo di 90 gradi.\n4. Spingi verso l\'alto estendendo completamente i tricipiti.', videoUrl: 'https://www.youtube.com/embed/gEY3MYExK-c' },
  { id: 't6', name: 'Cross-body Extension', category: 'Tricipiti', targetMuscles: ['Tricipiti'], equipment: 'Cavi', type: 'Isolamento', proNote: 'Angolo biomeccanico perfetto per il tricipite laterale.', instructions: '1. Posizionati lateralmente rispetto al cavo alto.\n2. Afferra il cavo con la mano opposta (incrociando il corpo).\n3. Estendi il braccio lateralmente e verso il basso.\n4. Rilascia lentamente mantenendo il gomito fisso.', videoUrl: 'https://www.youtube.com/embed/RjiRZzLfDwI' },

  // CORE
  { id: 'c1', name: 'Plank', category: 'Core', targetMuscles: ['Addominali', 'Core'], equipment: 'Corpo Libero', type: 'Isolamento', proNote: 'Fondamentale per la stabilità del core.', instructions: '1. Posizionati a terra appoggiandoti sugli avambracci e sulle punte dei piedi.\n2. Mantieni il corpo in linea retta dalla testa ai talloni.\n3. Contrai forte addome e glutei.\n4. Mantieni la posizione senza far cedere il bacino verso il basso.', videoUrl: 'https://www.youtube.com/embed/4RlykSkXt0U' },
  { id: 'c2', name: 'Russian Twist', category: 'Core', targetMuscles: ['Obliqui'], equipment: 'Corpo Libero / Palla Medica', type: 'Isolamento', proNote: 'Ottimo per la rotazione del busto.', instructions: '1. Siediti a terra con le ginocchia piegate e solleva leggermente i piedi.\n2. Inclina il busto all\'indietro mantenendo la schiena dritta.\n3. Ruota il busto e le braccia (con o senza peso) da un lato all\'altro.\n4. Controlla il movimento usando gli addominali obliqui.', videoUrl: 'https://www.youtube.com/embed/7r0YerH6Kho' },
  { id: 'c3', name: 'Crunch', category: 'Core', targetMuscles: ['Addominali (Retto)'], equipment: 'Corpo Libero', type: 'Isolamento', proNote: 'Isola la parte alta dell\'addome.', instructions: '1. Sdraiati supino con le ginocchia piegate e i piedi a terra.\n2. Metti le mani dietro la nuca senza tirare il collo.\n3. Contrai gli addominali per sollevare solo le spalle e la parte alta della schiena da terra.\n4. Torna giù lentamente mantenendo la tensione.', videoUrl: 'https://www.youtube.com/embed/QMAJblUrljg' },
  { id: 'c4', name: 'Sit-up su Panca Declinata', category: 'Core', targetMuscles: ['Addominali', 'Flessori dell\'anca'], equipment: 'Panca', type: 'Composto', proNote: 'Aumenta il range di movimento e la difficoltà.', instructions: '1. Blocca i piedi sui rulli della panca declinata.\n2. Incrocia le braccia al petto o dietro la nuca.\n3. Scendi lentamente all\'indietro controllando la discesa con l\'addome.\n4. Contrai per risalire fino alla posizione seduta.', videoUrl: 'https://www.youtube.com/embed/voNsi-RWW2I' },

  // CARDIO
  { id: 'ca1', name: 'Tapis Roulant', category: 'Cardio', targetMuscles: ['Cardiovascolare', 'Gambe'], equipment: 'Macchinario', type: 'Composto', proNote: 'Ottimo per riscaldamento o LISS (Low Intensity Steady State).', instructions: '1. Sali sui bordi laterali prima di avviare il nastro.\n2. Imposta velocità e pendenza desiderate.\n3. Mantieni una postura eretta, guarda dritto davanti a te e non aggrapparti ai corrimano se non necessario.\n4. Usa le braccia in modo naturale per accompagnare il movimento.', videoUrl: 'https://www.youtube.com/embed/dJxQDf3_nnk' },
  { id: 'ca2', name: 'Cyclette', category: 'Cardio', targetMuscles: ['Cardiovascolare', 'Quadricipiti'], equipment: 'Macchinario', type: 'Composto', proNote: 'Cardio a basso impatto articolare.', instructions: '1. Regola l\'altezza del sellino in modo che la gamba sia quasi completamente estesa nel punto più basso della pedalata.\n2. Mantieni la schiena dritta o leggermente inclinata in avanti appoggiandoti al manubrio.\n3. Imposta la resistenza e mantieni un ritmo costante (RPM).\n4. Spingi e tira sui pedali per un movimento fluido.', videoUrl: 'https://www.youtube.com/embed/pvba6ks_K08' },

  // NUOVI ESERCIZI AGGIUNTI
  // PETTO
  { id: 'p7', name: 'Push-up (Piegamenti)', category: 'Petto', targetMuscles: ['Pettorali', 'Tricipiti', 'Core'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Fondamentale per la forza a corpo libero.', instructions: '1. Posizionati in plank con le mani poco più larghe delle spalle.\n2. Mantieni il core contratto e il corpo in linea retta.\n3. Scendi piegando i gomiti (circa 45 gradi rispetto al corpo) fino a sfiorare il pavimento col petto.\n4. Spingi in modo esplosivo per tornare su.', videoUrl: 'https://www.youtube.com/embed/hNRpbrAi04M' },
  { id: 'p8', name: 'Archer Push-up', category: 'Petto', targetMuscles: ['Pettorali', 'Tricipiti'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Propedeutica per i piegamenti a un braccio.', instructions: '1. Posizionati in plank con le mani molto larghe e dita rivolte verso l\'esterno.\n2. Scendi piegando un solo braccio, mantenendo l\'altro teso.\n3. Il petto deve avvicinarsi alla mano del braccio piegato.\n4. Spingi per tornare al centro e ripeti dall\'altro lato.', videoUrl: 'https://www.youtube.com/embed/87ibZHdBkEI' },
  { id: 'p9', name: 'Panca Declinata', category: 'Petto', targetMuscles: ['Pettorali (Basso)', 'Tricipiti'], equipment: 'Bilanciere / Manubri', type: 'Composto', proNote: 'Focus sui fasci sterno-costali inferiori.', instructions: '1. Sdraiati sulla panca declinata bloccando bene i piedi.\n2. Afferra il bilanciere e staccalo.\n3. Scendi lentamente verso la parte bassa dello sterno.\n4. Spingi verso l\'alto mantenendo le scapole addotte.', videoUrl: 'https://www.youtube.com/embed/1d1uev6dDko' },
  { id: 'p10', name: 'Pullover con Manubrio', category: 'Petto', targetMuscles: ['Pettorali', 'Dorsali', 'Gran Dentato'], equipment: 'Manubri', type: 'Composto', proNote: 'Espansione toracica e lavoro sul gran dentato.', instructions: '1. Appoggia solo la parte alta della schiena di traverso su una panca piana.\n2. Tieni un manubrio con entrambe le mani sopra il petto a braccia quasi tese.\n3. Abbassa il manubrio dietro la testa descrivendo un arco, sentendo l\'allungamento nel petto e nei dorsali.\n4. Riporta il manubrio sopra il petto seguendo la stessa traiettoria.', videoUrl: 'https://www.youtube.com/embed/P3l7-PyES_8' },
  { id: 'p11', name: 'Wide Push-up', category: 'Petto', targetMuscles: ['Pettorali (Esterno)'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Enfasi massima sul grande pettorale esterno.', instructions: '1. Posizionati in plank con le mani più larghe delle spalle.\n2. Scendi controllando il movimento.\n3. Spingi per tornare su.', videoUrl: 'https://www.youtube.com/embed/maQiLUrTDWo' },
  { id: 'p12', name: 'Diamond Push-up', category: 'Petto', targetMuscles: ['Tricipiti', 'Pettorali (Interno)'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Focus estremo sui tricipiti.', instructions: '1. Mani unite a forma di diamante sotto il petto.\n2. Scendi tenendo i gomiti vicini al corpo.\n3. Spingi in modo esplosivo.', videoUrl: 'https://www.youtube.com/embed/PPTj-MW2tcs' },
  { id: 'p13', name: 'Incline Push-up', category: 'Petto', targetMuscles: ['Pettorali (Basso)'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Lavora la parte inferiore del petto (più facile).', instructions: '1. Mani su un rialzo (panca, sedia).\n2. Corpo in linea retta.\n3. Scendi e spingi.', videoUrl: 'https://www.youtube.com/embed/ggWJCuYJ_oA' },
  { id: 'p14', name: 'Decline Push-up', category: 'Petto', targetMuscles: ['Pettorali (Alto)'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Focus sul fascio clavicolare (petto alto).', instructions: '1. Piedi su un rialzo, mani a terra.\n2. Corpo in linea retta.\n3. Scendi e spingi.', videoUrl: 'https://www.youtube.com/embed/dcV-ATSeryA' },
  { id: 'p15', name: 'Pseudo Planche Push-up', category: 'Petto', targetMuscles: ['Spalle', 'Petto', 'Core'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Focus su spalle e core.', instructions: '1. Mani ad altezza vita, dita rivolte all\'indietro o di lato.\n2. Sbilanciati in avanti.\n3. Esegui il piegamento.', videoUrl: 'https://www.youtube.com/embed/HkGcKQ36Mfo' },
  { id: 'p16', name: 'Spiderman Push-up', category: 'Petto', targetMuscles: ['Petto', 'Core', 'Obliqui'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Coinvolge pesantemente il core.', instructions: '1. Mentre scendi nel piegamento, porta un ginocchio verso il gomito dello stesso lato.\n2. Torna indietro spingendo su e ripeti alternando.', videoUrl: 'https://www.youtube.com/embed/qG2oWGqXSdw' },
  { id: 'p17', name: 'Close Grip Bench Press', category: 'Petto', targetMuscles: ['Tricipiti', 'Pettorali (Interno)'], equipment: 'Bilanciere', type: 'Composto', proNote: 'Presa stretta per distruggere i tricipiti.', instructions: '1. Presa larghezza spalle o leggermente più stretta.\n2. Gomiti vicini al corpo durante la discesa.\n3. Spingi concentrandoti sui tricipiti.', videoUrl: 'https://www.youtube.com/embed/4yKLxOsrGfg' },

  // SCHIENA
  { id: 's7', name: 'Chin-up (Trazioni Supine)', category: 'Schiena', targetMuscles: ['Dorsali', 'Bicipiti'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Maggiore attivazione dei bicipiti rispetto alle trazioni prone.', instructions: '1. Afferra la sbarra con presa supina (palmi verso di te) a larghezza spalle.\n2. Deprimi le scapole e tira portando il petto verso la sbarra.\n3. Contrai forte i bicipiti e i dorsali in cima.\n4. Scendi in modo controllato.', videoUrl: 'https://www.youtube.com/embed/sI3b3HYtE3w' },
  { id: 's8', name: 'Australian Pull-up', category: 'Schiena', targetMuscles: ['Dorsali', 'Romboidi'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Ottimo per lo spessore e per chi non fa ancora le trazioni.', instructions: '1. Posizionati sotto una sbarra bassa o agli anelli.\n2. Afferra la sbarra e tieni il corpo dritto, i talloni a terra.\n3. Tira il petto verso la sbarra stringendo le scapole.\n4. Scendi lentamente mantenendo il corpo in linea.', videoUrl: 'https://www.youtube.com/embed/4Rhm1y-AYPI' },
  { id: 's9', name: 'T-Bar Row', category: 'Schiena', targetMuscles: ['Dorsali', 'Trapezio', 'Romboidi'], equipment: 'Bilanciere / Macchina', type: 'Composto', proNote: 'Costruisce spessore massiccio nella schiena centrale.', instructions: '1. Posizionati sopra il bilanciere a T con i piedi ben saldi.\n2. Piegati in avanti mantenendo la schiena dritta.\n3. Afferra le maniglie e tira il peso verso l\'addome.\n4. Contrai le scapole in cima e scendi controllando il carico.', videoUrl: 'https://www.youtube.com/embed/8JZoZoQoPsI' },
  { id: 's10', name: 'Muscle-up', category: 'Schiena', targetMuscles: ['Dorsali', 'Tricipiti', 'Petto'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Esercizio avanzato che unisce trazione e spinta.', instructions: '1. Afferra la sbarra con una "false grip" (polsi sopra la sbarra) o usa uno slancio (kipping).\n2. Esegui una trazione esplosiva portando la sbarra sotto il petto.\n3. Ruota i polsi e spingi il busto in avanti sopra la sbarra.\n4. Esegui un dip per estendere le braccia.', videoUrl: 'https://www.youtube.com/embed/gfeYd-fVQhw' },

  // GAMBE
  { id: 'g8', name: 'Air Squat', category: 'Gambe', targetMuscles: ['Quadricipiti', 'Glutei'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Base per la mobilità e il condizionamento.', instructions: '1. Piedi larghezza spalle, punte leggermente in fuori.\n2. Scendi spingendo il bacino indietro e le ginocchia in fuori.\n3. Mantieni il petto alto e il peso sui talloni/centro piede.\n4. Scendi sotto il parallelo e spingi per risalire.', videoUrl: 'https://www.youtube.com/embed/vExEWW52FrU' },
  { id: 'g9', name: 'Affondi (Lunges)', category: 'Gambe', targetMuscles: ['Quadricipiti', 'Glutei'], equipment: 'Corpo Libero / Manubri', type: 'Composto', proNote: 'Lavoro unilaterale per equilibrio e ipertrofia.', instructions: '1. In piedi, fai un lungo passo in avanti (o indietro).\n2. Scendi abbassando il bacino finché entrambe le ginocchia formano un angolo di 90 gradi.\n3. Il ginocchio posteriore deve sfiorare il pavimento.\n4. Spingi con la gamba anteriore per tornare in posizione.', videoUrl: 'https://www.youtube.com/embed/zvaJ9MdWzdM' },
  { id: 'g10', name: 'Front Squat', category: 'Gambe', targetMuscles: ['Quadricipiti', 'Core'], equipment: 'Bilanciere', type: 'Composto', proNote: 'Focus estremo sui quadricipiti e postura eretta.', instructions: '1. Posiziona il bilanciere sui deltoidi anteriori (presa incrociata o olimpica).\n2. Mantieni i gomiti alti per non far cadere il bilanciere.\n3. Scendi in squat mantenendo il busto molto più verticale rispetto al back squat.\n4. Spingi forte sui talloni per risalire.', videoUrl: 'https://www.youtube.com/embed/y3hI5JEN8NY' },
  { id: 'g11', name: 'Hip Thrust', category: 'Gambe', targetMuscles: ['Glutei'], equipment: 'Bilanciere', type: 'Isolamento', proNote: 'Il miglior esercizio per l\'ipertrofia dei glutei.', instructions: '1. Siediti a terra con la parte alta della schiena appoggiata a una panca.\n2. Fai rotolare il bilanciere sopra il bacino (usa un pad).\n3. Pianta i piedi a terra e spingi il bacino verso l\'alto contraendo i glutei.\n4. In cima, il corpo deve formare una linea retta dalle spalle alle ginocchia. Scendi controllando.', videoUrl: 'https://www.youtube.com/embed/IHk9Qn8ttX8' },

  // SPALLE
  { id: 'sp6', name: 'Pike Push-up', category: 'Spalle', targetMuscles: ['Deltoidi', 'Tricipiti'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Propedeutica per gli Handstand Push-up.', instructions: '1. Posizionati a V rovesciata (mani e piedi a terra, bacino in alto).\n2. Tieni gambe e braccia tese.\n3. Piega le braccia portando la testa verso il pavimento, leggermente in avanti rispetto alle mani.\n4. Spingi per tornare alla posizione di partenza.', videoUrl: 'https://www.youtube.com/embed/O-IDfFbXewA' },
  { id: 'sp7', name: 'Arnold Press', category: 'Spalle', targetMuscles: ['Deltoidi (Anteriore e Laterale)'], equipment: 'Manubri', type: 'Composto', proNote: 'Maggiore range di movimento e tempo sotto tensione.', instructions: '1. Siediti con due manubri all\'altezza del petto, palmi rivolti verso di te.\n2. Spingi i manubri verso l\'alto ruotando contemporaneamente i polsi.\n3. In cima, i palmi devono essere rivolti in avanti.\n4. Scendi invertendo il movimento.', videoUrl: 'https://www.youtube.com/embed/ED730dlrt8s' },
  { id: 'sp8', name: 'Alzate Frontali', category: 'Spalle', targetMuscles: ['Deltoide Anteriore'], equipment: 'Manubri / Disco', type: 'Isolamento', proNote: 'Isola il capo anteriore della spalla.', instructions: '1. In piedi, tieni i manubri o un disco davanti alle cosce.\n2. Solleva il peso in avanti a braccia quasi tese.\n3. Fermati all\'altezza degli occhi.\n4. Scendi lentamente resistendo al peso.', videoUrl: 'https://www.youtube.com/embed/fq9pilcFkDQ' },
  { id: 'sp9', name: 'Scrollate (Shrugs)', category: 'Spalle', targetMuscles: ['Trapezio'], equipment: 'Manubri / Bilanciere', type: 'Isolamento', proNote: 'Sviluppa la parte alta del trapezio.', instructions: '1. In piedi, tieni i pesi lungo i fianchi (o davanti se bilanciere).\n2. Solleva le spalle verso le orecchie il più in alto possibile.\n3. Contrai forte i trapezi in cima per un secondo.\n4. Rilascia lentamente verso il basso.', videoUrl: 'https://www.youtube.com/embed/IcgftQGUPVY' },

  // BICIPITI
  { id: 'b7', name: 'Spider Curl', category: 'Bicipiti', targetMuscles: ['Bicipiti (Capo Corto)'], equipment: 'Manubri / Bilanciere EZ', type: 'Isolamento', proNote: 'Elimina il cheating e massimizza la contrazione di picco.', instructions: '1. Sdraiati prono su una panca inclinata a 45 gradi.\n2. Lascia pendere le braccia dritte verso il pavimento.\n3. Fletti le braccia portando il peso verso l\'alto senza muovere i gomiti.\n4. Contrai forte in cima e scendi lentamente.', videoUrl: 'https://www.youtube.com/embed/Je5hYZ_lIPM' },
  { id: 'b8', name: 'Panca Scott (Preacher Curl)', category: 'Bicipiti', targetMuscles: ['Bicipiti'], equipment: 'Bilanciere EZ / Macchina', type: 'Isolamento', proNote: 'Blocca le braccia per un isolamento totale.', instructions: '1. Siediti alla panca Scott e appoggia i tricipiti sul cuscino.\n2. Afferra il bilanciere con presa supina.\n3. Fletti le braccia fino a portare il bilanciere vicino alle spalle.\n4. Scendi lentamente senza estendere completamente il gomito per evitare infortuni.', videoUrl: 'https://www.youtube.com/embed/TlJtGMAGkI4' },

  // TRICIPITI
  { id: 't7', name: 'Piegamenti a Diamante', category: 'Tricipiti', targetMuscles: ['Tricipiti', 'Pettorali'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Ottimo costruttore di massa per i tricipiti a corpo libero.', instructions: '1. Posizionati in plank unendo pollici e indici a formare un diamante sotto il petto.\n2. Scendi mantenendo i gomiti vicini al corpo.\n3. Il petto deve sfiorare le mani.\n4. Spingi in modo esplosivo estendendo completamente i tricipiti.', videoUrl: 'https://www.youtube.com/embed/s-wWQG-DAUY' },
  { id: 't8', name: 'Kickback', category: 'Tricipiti', targetMuscles: ['Tricipiti'], equipment: 'Manubri / Cavi', type: 'Isolamento', proNote: 'Massima contrazione nel punto di massimo accorciamento.', instructions: '1. Piegati in avanti appoggiando una mano e un ginocchio su una panca.\n2. Tieni il braccio di lavoro parallelo al pavimento, gomito piegato a 90 gradi.\n3. Estendi il braccio all\'indietro finché è dritto.\n4. Contrai forte il tricipite e torna alla posizione di partenza.', videoUrl: 'https://www.youtube.com/embed/lkddtxtXAEY' },

  // CORE
  { id: 'c5', name: 'Bicicletta (Bicycle Crunch)', category: 'Core', targetMuscles: ['Addominali', 'Obliqui'], equipment: 'Corpo Libero', type: 'Isolamento', proNote: 'Attivazione completa del retto e degli obliqui.', instructions: '1. Sdraiati supino, mani dietro la nuca, gambe sollevate e piegate a 90 gradi.\n2. Porta il gomito destro verso il ginocchio sinistro, estendendo la gamba destra.\n3. Alterna il movimento portando il gomito sinistro verso il ginocchio destro.\n4. Mantieni un ritmo controllato e continuo.', videoUrl: 'https://www.youtube.com/embed/RC4wOdLdZr0' },
  { id: 'c6', name: 'Leg Raise (Sollevamento Gambe)', category: 'Core', targetMuscles: ['Addominali (Basso)'], equipment: 'Corpo Libero', type: 'Isolamento', proNote: 'Focus sulla parte inferiore del retto addominale.', instructions: '1. Sdraiati supino con le gambe tese e le mani sotto i glutei o lungo i fianchi.\n2. Solleva le gambe tese fino a formare un angolo di 90 gradi col busto.\n3. Scendi lentamente senza far toccare i talloni a terra.\n4. Mantieni la zona lombare sempre aderente al pavimento.', videoUrl: 'https://www.youtube.com/embed/EiphBfMB6qc' },
  { id: 'c7', name: 'Toes to Bar', category: 'Core', targetMuscles: ['Addominali', 'Flessori dell\'anca'], equipment: 'Sbarra', type: 'Composto', proNote: 'Esercizio avanzato in sospensione.', instructions: '1. Appesi alla sbarra con presa prona.\n2. Contrai l\'addome e solleva le gambe tese (o leggermente piegate) verso l\'alto.\n3. Cerca di toccare la sbarra con le punte dei piedi.\n4. Scendi in modo controllato evitando di dondolare troppo.', videoUrl: 'https://www.youtube.com/embed/GUkkaOpe_HA' },
  { id: 'c8', name: 'Ab-Wheel (Ruota)', category: 'Core', targetMuscles: ['Core', 'Addominali'], equipment: 'Ab-Wheel', type: 'Composto', proNote: 'Tensione estrema in allungamento (anti-estensione).', instructions: '1. In ginocchio, afferra la ruota con entrambe le mani.\n2. Rotola in avanti mantenendo l\'addome contratto e la schiena leggermente curva (non inarcare la lombare!).\n3. Estenditi il più possibile senza perdere la tensione.\n4. Usa gli addominali per tirare indietro la ruota e tornare in posizione.', videoUrl: 'https://www.youtube.com/embed/5GKZ2pA5csM' },

  // ULTERIORI AGGIUNTE
  // SCHIENA
  { id: 's11', name: 'Neutral/Hammer Grip Pull-up', category: 'Schiena', targetMuscles: ['Dorsali', 'Bicipiti', 'Brachioradiale'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Presa neutra, più sicura per le articolazioni delle spalle.', instructions: '1. Afferra le maniglie parallele con i palmi che si guardano.\n2. Tira il petto verso l\'alto.\n3. Scendi in modo controllato.', videoUrl: 'https://www.youtube.com/embed/NzWKZSqzWFU' },
  { id: 's12', name: 'Wide Grip Pull-up', category: 'Schiena', targetMuscles: ['Dorsali (Ampiezza)'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Presa molto larga per isolare i dorsali e creare il V-shape.', instructions: '1. Afferra la sbarra con una presa molto più larga delle spalle.\n2. Tira cercando di portare il petto alla sbarra.\n3. Scendi controllando.', videoUrl: 'https://www.youtube.com/embed/xhuzoIwSqfA' },
  { id: 's13', name: 'Behind the Neck Pull-up', category: 'Schiena', targetMuscles: ['Dorsali', 'Trapezio'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Richiede molta mobilità, attenzione alle spalle.', instructions: '1. Afferra la sbarra con presa larga.\n2. Tira portando la sbarra dietro la nuca.\n3. Scendi lentamente.', videoUrl: 'https://www.youtube.com/embed/u7UoYMI-Z6U' },
  { id: 's14', name: 'L-Sit Pull-up', category: 'Schiena', targetMuscles: ['Dorsali', 'Addominali'], equipment: 'Corpo Libero', type: 'Composto', proNote: 'Lavora tantissimo l\'addome in isometria.', instructions: '1. Appeso alla sbarra, solleva le gambe tese a 90 gradi (L-Sit).\n2. Mantenendo questa posizione, esegui le trazioni.\n3. Non far scendere le gambe.', videoUrl: 'https://www.youtube.com/embed/4Lh8sy1TY6Q' },

  // GAMBE
  { id: 'g12', name: 'Goblet Squat', category: 'Gambe', targetMuscles: ['Quadricipiti', 'Core'], equipment: 'Manubri / Kettlebell', type: 'Composto', proNote: 'Ottimo per imparare la tecnica e mantenere il busto eretto.', instructions: '1. Tieni un manubrio o kettlebell al petto con entrambe le mani.\n2. Scendi in squat mantenendo il petto alto.\n3. I gomiti dovrebbero passare all\'interno delle ginocchia.\n4. Spingi per risalire.', videoUrl: 'https://www.youtube.com/embed/jnm_rsBb1Gc' },
  { id: 'g13', name: 'Sumo Squat', category: 'Gambe', targetMuscles: ['Adduttori', 'Glutei', 'Quadricipiti'], equipment: 'Bilanciere / Manubri', type: 'Composto', proNote: 'Gambe molto larghe, focus su interno coscia.', instructions: '1. Divarica molto le gambe con le punte dei piedi verso l\'esterno.\n2. Scendi mantenendo la schiena dritta.\n3. Spingi forte sui talloni per risalire.', videoUrl: 'https://www.youtube.com/embed/JrF1ga0e5Fc' },
  { id: 'g14', name: 'Cossack Squat', category: 'Gambe', targetMuscles: ['Quadricipiti', 'Adduttori', 'Mobilità'], equipment: 'Corpo Libero / Pesi', type: 'Composto', proNote: 'Affondo laterale profondo per mobilità e forza.', instructions: '1. Divarica molto le gambe.\n2. Scendi su un lato piegando una gamba e mantenendo l\'altra tesa col tallone a terra e la punta in alto.\n3. Scendi il più possibile mantenendo il tallone della gamba piegata a terra.\n4. Spingi per tornare al centro e cambia lato.', videoUrl: 'https://www.youtube.com/embed/h-6_c53wDzA' },
  { id: 'g15', name: 'Box Squat', category: 'Gambe', targetMuscles: ['Glutei', 'Femorali', 'Quadricipiti'], equipment: 'Bilanciere', type: 'Composto', proNote: 'Ottimo per la forza esplosiva e per chi ha problemi alle ginocchia.', instructions: '1. Posiziona un box o una panca dietro di te.\n2. Scendi in squat finché non ti siedi completamente sul box (pausa di 1 secondo).\n3. Rilassa i flessori dell\'anca ma mantieni il core teso.\n4. Esplodi verso l\'alto.', videoUrl: 'https://www.youtube.com/embed/TBtab6h8hPM' },
  { id: 'g16', name: 'Hack Squat', category: 'Gambe', targetMuscles: ['Quadricipiti'], equipment: 'Macchinario / Bilanciere', type: 'Composto', proNote: 'Isola pesantemente i quadricipiti.', instructions: '1. Posizionati alla macchina Hack Squat con la schiena ben aderente allo schienale.\n2. Scendi piegando le ginocchia fino a 90 gradi o più.\n3. Spingi per tornare su senza bloccare le ginocchia in cima.', videoUrl: 'https://www.youtube.com/embed/PH9uLhNr-s4' },
  { id: 'g17', name: 'Stacco da terra (Regular)', category: 'Gambe', targetMuscles: ['Femorali', 'Glutei', 'Schiena Bassa'], equipment: 'Bilanciere', type: 'Composto', proNote: 'Il re degli esercizi di forza per la catena posteriore.', instructions: '1. Piedi larghezza spalle, bilanciere sopra il centro del piede.\n2. Piegati e afferra il bilanciere con le mani appena fuori dalle ginocchia.\n3. Abbassa il bacino, petto in fuori, schiena dritta.\n4. Spingi il pavimento via coi piedi e solleva il bilanciere lungo le gambe.', videoUrl: 'https://www.youtube.com/embed/b4NI-OkEnW0' },
  { id: 'g18', name: 'Stacco Sumo', category: 'Gambe', targetMuscles: ['Glutei', 'Adduttori', 'Femorali'], equipment: 'Bilanciere', type: 'Composto', proNote: 'Gambe molto larghe, meno stress sulla bassa schiena rispetto al regular.', instructions: '1. Posizione molto ampia dei piedi, punte in fuori.\n2. Afferra il bilanciere all\'interno delle gambe.\n3. Tieni il busto più eretto rispetto allo stacco classico.\n4. Spingi coi piedi e solleva.', videoUrl: 'https://www.youtube.com/embed/0lzEWlFW1sw' },

  // CORE
  { id: 'c9', name: 'Side Plank', category: 'Core', targetMuscles: ['Obliqui', 'Core'], equipment: 'Corpo Libero', type: 'Isometria', proNote: 'Fondamentale per la stabilità laterale.', instructions: '1. Sdraiati su un fianco, appoggiato sull\'avambraccio.\n2. Solleva il bacino in modo che il corpo formi una linea retta.\n3. Mantieni la posizione contraendo l\'addome e i glutei.', videoUrl: 'https://www.youtube.com/embed/RprIskF9iNQ' },
  { id: 'c10', name: 'Cable Crunch', category: 'Core', targetMuscles: ['Addominali (Retto)'], equipment: 'Cavi', type: 'Isolamento', proNote: 'Permette di sovraccaricare l\'addome con i pesi.', instructions: '1. In ginocchio davanti a una puleggia alta con la corda.\n2. Afferra la corda e portala dietro la nuca.\n3. Fletti il busto verso il basso contraendo gli addominali (immagina di portare i gomiti alle ginocchia).\n4. Torna su lentamente.', videoUrl: 'https://www.youtube.com/embed/5ChlIBq8t0I' }
];

export default function ExerciseLibrary({ focusedExerciseId, onReturn }: { focusedExerciseId?: string | null, onReturn?: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  
  // Set initial selected exercise if focusedExerciseId is provided
  const initialExercise = focusedExerciseId ? EXERCISE_LIBRARY.find(e => e.id === focusedExerciseId) : null;
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(initialExercise || null);
  const [loadVideo, setLoadVideo] = useState(false);

  // Update selectedExercise if focusedExerciseId changes (prop sync)
  useEffect(() => {
    if (focusedExerciseId) {
      const ex = EXERCISE_LIBRARY.find(e => e.id === focusedExerciseId);
      if (ex) {
        setSelectedExercise(ex);
        setLoadVideo(false);
      }
    }
  }, [focusedExerciseId]);

  const handleCloseDetail = () => {
    setSelectedExercise(null);
    if (onReturn) onReturn();
  };

  const handleSelectExercise = (ex: Exercise) => {
    setSelectedExercise(ex);
    setLoadVideo(false);
  };

  const filteredExercises = EXERCISE_LIBRARY.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         ex.targetMuscles.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || ex.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories: ExerciseCategory[] = ['Petto', 'Schiena', 'Gambe', 'Spalle', 'Bicipiti', 'Tricipiti', 'Core', 'Cardio'];

  const getVideoId = (url?: string) => {
    if (!url) return null;
    return url.split('/').pop();
  };

  return (
    <div className="space-y-6">
      {!focusedExerciseId && (
        <>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
            <input 
              type="text" 
              placeholder="CERCA NELL'ATLANTE..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 font-black uppercase tracking-tighter text-sm focus:ring-1 ring-neon outline-none"
            />
          </div>

          <div className="flex overflow-x-auto pb-4 mb-2 -mx-4 px-4 gap-2 thin-scrollbar snap-x">
            {categories.map(cat => (
              <motion.button 
                key={cat} 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={cn(
                  "border px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap snap-start",
                  selectedCategory === cat 
                    ? "bg-neon text-black border-neon shadow-[0_0_20px_rgba(var(--neon-accent-rgb),0.3)]" 
                    : "glass text-zinc-400 hover:text-neon hover:border-neon"
                )}
              >
                {cat}
              </motion.button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredExercises.map(ex => (
              <motion.div 
                key={ex.id} 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectExercise(ex)}
                className="glass p-4 rounded-2xl flex items-center justify-between group cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-black/40 rounded-xl flex items-center justify-center border border-white/5 group-hover:bg-neon transition-colors">
                    <Play size={20} className="text-zinc-500 group-hover:text-black fill-current" />
                  </div>
                  <div>
                    <h4 className="font-black uppercase tracking-tighter text-sm italic">{ex.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{ex.category}</span>
                      <span className="text-[10px] text-zinc-600">•</span>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{ex.equipment}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-zinc-700" />
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Exercise Detail Modal */}
      <AnimatePresence>
        {selectedExercise && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 bg-black z-[100] flex flex-col overflow-y-auto no-scrollbar pb-20"
          >
            <div className="p-6 max-w-2xl mx-auto w-full">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <Dumbbell className="text-neon" size={24} />
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic">Voce Atlante</h3>
                </div>
                <button 
                  onClick={handleCloseDetail} 
                  className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Video Player Module (Framed & Responsive) */}
              {selectedExercise.videoUrl && (
                <div className="w-full md:w-5/6 lg:w-4/5 mx-auto mb-8 flex flex-col gap-2">
                  <div className="w-full aspect-video bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 relative group shadow-2xl">
                    {loadVideo ? (
                      <iframe 
                        key={selectedExercise.id}
                        src={`${selectedExercise.videoUrl.replace('youtube.com', 'youtube-nocookie.com')}?autoplay=1&playsinline=1&rel=0`}
                        className="w-full h-full border-0"
                        title={selectedExercise.name}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        allowFullScreen
                      ></iframe>
                    ) : (
                      <div 
                        onClick={() => setLoadVideo(true)}
                        className="w-full h-full cursor-pointer relative flex items-center justify-center"
                      >
                        <img 
                          src={`https://img.youtube.com/vi/${getVideoId(selectedExercise.videoUrl)}/maxresdefault.jpg`}
                          alt={selectedExercise.name}
                          className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-all duration-300"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `https://img.youtube.com/vi/${getVideoId(selectedExercise.videoUrl)}/hqdefault.jpg`;
                          }}
                        />
                        {/* Play Button Overlay */}
                        <motion.div 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="absolute w-16 h-16 bg-neon rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(var(--neon-accent-rgb),0.5)] z-10"
                        >
                          <Play size={32} className="text-black fill-current ml-1" />
                        </motion.div>
                      </div>
                    )}
                  </div>
                  
                  {/* YouTube Fallback Button */}
                  <a 
                    href={selectedExercise.videoUrl.replace('/embed/', '/watch?v=')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-xl text-zinc-400 hover:text-white hover:border-white/20 transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest"
                  >
                    <span>Il video è bloccato? Apri in YouTube</span>
                    <ChevronRight size={14} />
                  </a>
                </div>
              )}

              {/* Navigation help if video exists */}
              {selectedExercise.videoUrl && (
                <div className="flex items-center justify-between mb-8 opacity-50">
                   <div className="flex items-center gap-2">
                    <Dumbbell className="text-neon" size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Dettaglio Esercizio</span>
                  </div>
                  <button onClick={handleCloseDetail} className="text-[10px] font-black uppercase tracking-widest hover:text-neon transition-colors">
                    Chiudi Scheda
                  </button>
                </div>
              )}
              
              {selectedExercise.videoUrl && (
                <div className="flex justify-center mb-6">
                  <a 
                    href={selectedExercise.videoUrl.replace('/embed/', '/watch?v=')} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:text-neon transition-colors flex items-center gap-1"
                  >
                    Problemi con il video? Apri su YouTube <ChevronRight size={10} />
                  </a>
                </div>
              )}

              <div className="space-y-6 flex-1">
                <div>
                  <h1 className="text-4xl font-black uppercase tracking-tighter italic mb-2">{selectedExercise.name}</h1>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-neon text-black text-[10px] font-black uppercase px-3 py-1 rounded-full">
                      {selectedExercise.category}
                    </span>
                    <span className="bg-zinc-800 text-zinc-300 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-zinc-700">
                      {selectedExercise.equipment}
                    </span>
                    <span className="bg-zinc-800 text-neon text-[10px] font-black uppercase px-3 py-1 rounded-full border border-neon/20">
                      {selectedExercise.type}
                    </span>
                  </div>
                </div>

                {selectedExercise.proNote && (
                  <div className="bg-neon/10 border border-neon/20 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-2 text-neon">
                      <Brain size={18} />
                      <h4 className="font-black uppercase tracking-tighter text-sm">Nota Pro</h4>
                    </div>
                    <p className="text-neon/80 text-sm font-bold italic">
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
                <GripButton variant="accent" className="w-full" onClick={handleCloseDetail}>
                  {focusedExerciseId ? 'TORNA ALL\'ALLENAMENTO' : 'CHIUDI ATLANTE'}
                </GripButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
