import { GoogleGenAI } from "@google/genai";
import { WorkoutSession, BiometricLog } from "../types";

let ai: GoogleGenAI | null = null;
let aiReady = false;

export const initAI = async () => {
  try {
    let apiKey = "";
    
    // 1. Primary source: process.env.GEMINI_API_KEY (defined in vite.config.ts)
    try {
      // @ts-ignore
      const envKey = process.env.GEMINI_API_KEY;
      if (envKey && envKey !== "undefined" && envKey !== "null" && envKey !== "") {
        apiKey = envKey;
      }
    } catch (e) {}
    
    // 2. Fallback: import.meta.env
    if (!apiKey) {
      const meta = import.meta as any;
      if (meta?.env) {
        apiKey = meta.env.VITE_GEMINI_API_KEY || 
                 meta.env.GEMINI_API_KEY || 
                 meta.env.GEMINI_API_KEY_;
      }
    }
    
    // 3. Last resort: fetch from server
    if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "") {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          apiKey = data.geminiApiKey;
        }
      } catch (fetchErr) {}
    }

    if (apiKey && apiKey !== "undefined" && apiKey !== "null" && apiKey !== "") {
      ai = new GoogleGenAI({ apiKey });
      aiReady = true;
      console.log("AI initialized successfully.");
    } else {
      console.warn("GEMINI_API_KEY not found. AI features disabled.");
    }
  } catch (e) {
    console.error("Failed to init AI:", e);
  }
  return aiReady;
};

export const getAI = () => ai;
export const isAIReady = () => aiReady;

export const getStrategistAdvice = async (
  history: WorkoutSession[],
  biometrics: BiometricLog,
  nutrition?: { consumed: number, target: number, goal: string }
) => {
  const aiClient = getAI();
  if (!aiClient) {
    return { 
      readinessScore: 75, 
      intensity: "Technical", 
      tip: "Configura la tua GEMINI_API_KEY nelle impostazioni (Secrets su Vercel o AI Studio) per ricevere consigli personalizzati." 
    };
  }

  const prompt = `
    Sei "Lo Strategista", il motore logico centrale di Apex Lift Ultimate.
    Analizza la cronologia, la biometria e l'alimentazione per fornire una raccomandazione.
    
    Biometria di Oggi:
    - HRV: ${biometrics.hrv}
    - Sonno: ${biometrics.sleepHours}h
    - Stress: ${biometrics.stressLevel}/10
    
    Alimentazione di Oggi:
    - Assunte: ${nutrition?.consumed || 0} kcal
    - Obiettivo: ${nutrition?.target || 0} kcal
    - Scopo: ${nutrition?.goal || 'Mantenimento'}
    
    Cronologia Recente:
    ${JSON.stringify(history.slice(-3))}
    
    REGOLE FONDAMENTALI PER IL CONSIGLIO (tip):
    1. Analisi Scostamento Nutrizionale: Se c'è un forte scostamento tra calorie assunte e obiettivo, fallo notare.
    2. Bio-feedback: Usa i dati biometrici per consigliare idratazione, recupero o volume.
    3. Ottimizzazione Workout (Sforzo): Analizza i livelli di sforzo recenti ('POCO', 'MEDIO', 'MOLTO', 'MOLTISSIMO').
    4. CONSTRAINT: NIENTE frasi motivazionali generiche. Sii analitico e diretto.
    
    Ritorna JSON (NIENTE Markdown, solo testo pulito):
    {
      "readinessScore": number,
      "intensity": "Heavy" | "Technical" | "Deload",
      "tip": "string (in ITALIANO, max 20 parole, no simboli)"
    }
  `;

  try {
    console.log("AI Request (getStrategistAdvice)");
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const text = response.text || "{}";
    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error: any) {
    console.error("Strategist Error:", error);
    if (error.message?.includes("429") || error.message?.includes("quota")) {
      return { 
        readinessScore: 70, 
        intensity: "Technical", 
        tip: "L'IA è temporaneamente sovraccarica (Quota 429). Mantieni la routine abituale e riprova tra poco." 
      };
    }
    return { readinessScore: 70, intensity: "Technical", tip: "Errore di connessione con l'IA. Concentrati sulla tecnica oggi." };
  }
};

export const parseFoodInput = async (input: string, imageBase64?: string) => {
  const aiClient = getAI();
  if (!aiClient) {
    throw new Error("Chiave API mancante. Se sei su Vercel, assicurati di aver aggiunto GEMINI_API_KEY nelle Environment Variables del progetto e di aver fatto un Redeploy.");
  }

  const prompt = `
    Sei un nutrizionista clinico esperto del mercato ITALIANO e un database nutrizionale iper-preciso. Il tuo calcolo DEVE basarsi ESCLUSIVAMENTE sulle etichette dei prodotti reali venduti in ITALIA (Tabelle CREA, IEO, formule europee per le multinazionali). NON usare i vecchi database generici americani (es. USDA) per i prodotti commerciali preconfezionati, perché in Italia le ricette e il contenuto di zuccheri sono drasticamente diversi.
    
    Pasto inserito dall'utente: "${input || 'Nessun testo, basati solo sull\'immagine'}"
    
    ATTENZIONE SULLE QUANTITA' E LA MATEMATICA:
    1. Regola del Mercato Italiano: Leggi grammi (g) o millilitri (ml). Valuta TUTTI i cibi e bevande confezionate secondo le etichette italiane odierne. Esempio ferreo: in Italia la Fanta è ormai senza zuccheri aggiunti, quindi se l'utente scrive "fanta da 330 ml" DEVI restituire 20 kcal, NON le 150-200 kcal della versione americana. Applica questo calcolo "reale e italiano" a tutti i brand e catene.
    2. Usa una base di calcolo per 100g e moltiplica *esattamente* per la proporzione richiesta (es. 250g = 2.5).
    3. I macronutrienti devono matematicamente combaciare con le kcal! Calcola prima le kcal italiane e poi i macro: (Carbo * 4) + (Pro * 4) + (Fat * 9) = Kcal totali. Tolleranza massima del 3-5% per arrotondamenti.
    4. Se nessuna quantità è specificata, scegli porzioni umane medie per un pasto italiano tipico e DICHIARA la stima di peso usata nel nome (es. "Risotto (1 porzione media, ~80g a crudo)").

    Dividi accuratamente gli elementi se presenti separatori (; , . - e, con).
    
    DEVI RITORNARE ESCLUSIVAMENTE UN OGGETTO JSON VALIDO.
    Struttura esatta:
    {
      "items": [
        {
          "name": "Nome alimento 1",
          "kcal": valore numerico preciso,
          "carbs": valore numerico,
          "protein": valore numerico,
          "fat": valore numerico
        }
      ]
    }
  `;

  const parts: any[] = [];

  if (imageBase64) {
    try {
      let mimeType = "image/jpeg";
      let base64Data = imageBase64;
      
      if (imageBase64.startsWith('data:')) {
        const commaIndex = imageBase64.indexOf(',');
        if (commaIndex !== -1) {
          mimeType = imageBase64.substring(5, imageBase64.indexOf(';'));
          base64Data = imageBase64.substring(commaIndex + 1);
        }
      }
      
      parts.push({
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: base64Data
        }
      });
    } catch (e) {
      console.error("Errore parsing immagine base64:", e);
    }
  }

  parts.push({ text: prompt });

  try {
    console.log("AI Request (parseFoodInput):", { input, hasImage: !!imageBase64 });
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });
    
    let text = response.text || "{}";
    
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }
    
    const parsed = JSON.parse(text);
    
    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new Error("L'IA ha restituito un formato non valido (manca array items).");
    }
    
    return parsed;
  } catch (error: any) {
    console.error("Food Parsing Error:", error);
    if (error.message?.includes("429") || error.message?.includes("quota")) {
      throw new Error("Limite di richieste IA raggiunto (Quota 429). Google permette 15 richieste al minuto nella versione gratuita. Attendi 60 secondi e riprova.");
    }
    throw new Error(error.message || "Errore di connessione con l'IA.");
  }
};

export const suggestMealForRemainingMacros = async (
  remainingKcal: number, 
  remainingPro: number, 
  remainingCarbs: number, 
  remainingFat: number,
  pantryItems?: string[],
  favoriteMeals?: any[],
  workoutContext?: string,
  targetKcal?: number,
  portionsContext?: string
): Promise<{ text: string, items: { name: string, kcal: number, carbs: number, protein: number, fat: number }[] }> => {
  const aiClient = getAI();
  if (!aiClient) {
    throw new Error("Chiave API mancante. Impossibile generare suggerimenti.");
  }
  
  if (remainingKcal <= 50) return { text: "Hai già raggiunto il tuo obiettivo calorico per oggi. Ottimo lavoro!", items: [] };

  const pantryStr = pantryItems?.length ? pantryItems.join(', ') : 'Nessuna dispensa specificata, usa ingredienti comuni.';
  const portionsStr = portionsContext ? `\n    - ABITUDINI E PORZIONI DELL'UTENTE: ${portionsContext}` : '';
  
  const prompt = `
    Sei un assistente nutrizionale pratico e realistico. Il tuo compito è dare consigli sani e funzionali in testo assolutamente normale e pulito.
    
    STATO DELL'UTENTE:
    - Target giornaliero: ${targetKcal ? Math.round(targetKcal) : 'non specificato'} kcal
    - Kcal mancanti oggi: ${Math.round(remainingKcal)} kcal${portionsStr}
    
    Ingredienti disponibili nella sua Dispensa: ${pantryStr}
    
    CONTESTO DIARIO ALIMENTARE (Pasti già fatti e orario):
    ${workoutContext || 'Nessun pasto registrato per oggi.'}
    
    REGOLE FONDAMENTALI:
    1. FORMATTAZIONE TESTO PURA: DIVIETO ASSOLUTO di usare Markdown. NON inserire MAI asterischi (*), cancelletti (#), trattini bassi (_) o altri simboli di formattazione. Scrivi il testo come in un normale messaggio WhatsApp (puoi usare emoji).
    2. STRUTTURA GIORNALIERA: Anche se l'utente non ha inserito preferenze, DEVI strutturare il consiglio coprendo Colazione, Pranzo, Spuntino e Cena (in base a cosa manca). Usa esplicitamente i nomi dei pasti come intestazioni nel testo (es. "Colazione:", "Pranzo:", ecc.).
    3. CHIAREZZA E OBIETTIVO: Menziona sempre le calorie mancanti. Sii d'aiuto: il tuo obiettivo è far raggiungere all'utente il target calorico per ottimizzare il recupero muscolare e l'efficacia dell'allenamento. Se mancano molte calorie, suddividile tra i pasti rimanenti per arrivare ESATTAMENTE o quasi al target.
    4. NO RIPETIZIONI: Controlla i "pasti già fatti" nel contesto. DIVIETO ASSOLUTO di suggerire alimenti già consumati (es. se ha mangiato tonno a pranzo, NON consigliare tonno a cena). Varia sempre le scelte.
    5. PORZIONI REALISTICHE MA EFFICACI: Mantieni porzioni "umane" (es. 80-120g pasta, 150-250g carne/pesce). Se per arrivare a target servono molte calorie, aggiungi alimenti densi (frutta secca, burro d'arachidi, olio d'oliva, parmigiano) invece di dosi disumane di riso o pollo.
    6. MANCANZA PREFERENZE: Se non ci sono preferenze/dispensa, suggerisci i "punti saldi" della nutrizione sportiva d'élite (Avena, Yogurt Greco, Riso Basmati, Patate Dolci, Pollo, Salmone, Uova, Avocado, Mandorle, Mirtilli).
    7. PRAGMATISMO: Se mancano troppe calorie (>1000 kcal) a fine giornata, suggerisci come recuperare il più possibile con cibi densi senza forzare un'abbuffata insana, ricordando però che il target è fondamentale per i risultati.
    8. DATI STRUTTURATI: Alla fine del tuo messaggio, aggiungi SEMPRE un blocco racchiuso tra i tag [DATA] e [/DATA] che contenga un array JSON con i singoli alimenti suggeriti nel seguente formato: [{"name": string, "amount": string, "kcal": number, "carbs": number, "protein": number, "fat": number, "mealType": "Colazione" | "Pranzo" | "Spuntino" | "Cena"}].
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    const fullText = response.text || "";
    const dataRegex = /\[DATA\]([\s\S]*?)\[\/DATA\]/;
    const match = fullText.match(dataRegex);
    
    let items = [];
    let cleanText = fullText.replace(dataRegex, '').trim();

    if (match && match[1]) {
      try {
        items = JSON.parse(match[1].trim());
      } catch (e) {
        console.error("JSON parsing error in suggestion:", e);
      }
    }

    // Pulizia finale del testo
    cleanText = cleanText.replace(/[*#_]/g, '');
    
    return { text: cleanText, items };
  } catch (error: any) {
    console.error("Meal Suggestion Error:", error);
    throw new Error("L'IA è sovraccarica o non disponibile al momento. Riprova più tardi.");
  }
};
export const getPostWorkoutAdvice = async (sessionData: any) => {
  const aiClient = getAI();
  if (!aiClient) {
    return "Ottimo lavoro! Configura la tua API Key per consigli personalizzati.";
  }

  const prompt = `
    Sei "Lo Strategista", un coach di powerbuilding di élite.
    L'utente ha appena terminato questo allenamento:
    ${JSON.stringify(sessionData)}
    
    Analizza i dati (kg, reps, sforzo) e fornisci un feedback POST-ALLENAMENTO di massimo 3 frasi.
    Lo sforzo è indicato come: 'POCO' (troppo leggero), 'MEDIO' (ottimale), 'MOLTO' (alto), 'MOLTISSIMO' (cedimento/limite).
    
    Regole CRITICHE:
    1. Usa SEMPRE il nome completo dell'esercizio (campo 'exerciseName'). 
    2. MAI usare codici come 's2', 'p1', 'g3' o 'exerciseId' nella risposta.
    3. Se lo sforzo è 'POCO' su molti set, consiglia esplicitamente di aumentare i carichi drasticamente la prossima volta.
    4. Se lo sforzo è spesso 'MOLTISSIMO', consiglia di fare attenzione al recupero centrale.
    5. Sii specifico su un esercizio se noti qualcosa di rilevante.
    6. Niente saluti. Vai dritto al punto su COME e COSA cambiare la prossima volta.
  `;

  try {
    console.log("AI Request (getPostWorkoutAdvice)");
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    const text = (response.text || "Ottimo allenamento completato.").replace(/[*#_\-]/g, '').trim();
    return text;
  } catch (error: any) {
    console.error("Post-Workout AI Error:", error);
    if (error.message?.includes("429") || error.message?.includes("quota")) {
      return "Analisi IA non disponibile (Limite raggiunto). Ottimo lavoro comunque!";
    }
    return "Allenamento salvato. Analisi IA non disponibile al momento.";
  }
};

export const analyzeGymEquipment = async (imagesBase64?: string | string[], textInput?: string) => {
  const aiClient = getAI();
  if (!aiClient) throw new Error("AI not configured");

  const prompt = `
    Sei un esperto di biomeccanica e attrezzatura da palestra di rilevanza mondiale. 
    Analizza l'input (testo o immagini) e identifica i macchinari o l'attrezzatura presente.
    ${textInput ? `Testo fornito dall'utente: "${textInput}"` : 'Basati sulle immagini fornite. Ignora le persone, i riflessi e lo sfondo. Cerca con la massima attenzione ogni macchina, manubrio, panca o cavo visibile. Analizza TUTTE le foto fornite in un unico colpo.'}
    
    Per ogni macchina identificata con certezza, fornisci: 
    1. Nome standard in ITALIANO (es. "Lat Machine", "Leg Extension", "Squat Rack")
    2. Categoria (Petto, Schiena, Gambe, Spalle, Bicipiti, Tricipiti, Core, Cardio)
    3. Muscoli Target in ITALIANO (es. ["Gran Dorsale", "Bicipite Brachiale"])
    4. Tipo (Machine, Dumbbells, Barbell, Bodyweight, Cable)
    
    Ritorna solo JSON:
    {
      "equipment": [
        {
          "name": "string",
          "category": "string",
          "targetMuscles": ["string", "string"],
          "equipmentType": "Machine" | "Dumbbells" | "Barbell" | "Bodyweight" | "Cable"
        }
      ]
    }
  `;

  const parts: any[] = [];
  
  if (imagesBase64) {
    const imagesArray = Array.isArray(imagesBase64) ? imagesBase64 : [imagesBase64];
    for (const imageBase64 of imagesArray) {
      if (!imageBase64) continue;
      let mimeType = "image/jpeg";
      let base64Data = imageBase64;
      if (imageBase64.startsWith('data:')) {
        const commaIndex = imageBase64.indexOf(',');
        if (commaIndex !== -1) {
          mimeType = imageBase64.substring(5, imageBase64.indexOf(';'));
          base64Data = imageBase64.substring(commaIndex + 1);
        }
      }
      parts.push({ inlineData: { mimeType, data: base64Data } });
    }
  }
  
  parts.push({ text: prompt });

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: "application/json" }
    });
    const text = response.text || "{}";
    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("Gym Analysis Error:", error);
    throw error;
  }
};

export const suggestExerciseAlternative = async (
  currentExerciseName: string,
  inventory: string[],
  completedExercises: string[],
  isCrowded: boolean = false
) => {
  const aiClient = getAI();
  if (!aiClient) return null;

  const prompt = `
    Sei "Lia", l'IA di coaching e biomeccanica di Apex Lift.
    L'utente deve fare "${currentExerciseName}" ma l'attrezzatura è occupata.
    
    Attrezzatura mappata nella sua palestra: ${inventory.join(', ')}
    Esercizi già completati oggi: ${completedExercises.join(', ')}
    Situazione Palestra: ${isCrowded ? 'MOLTO AFFOLLATA (prediligi corpo libero o manubri per evitare attese)' : 'Normale'}
    
    REGOLE CRITICHE:
    1. STRICT MUSCLE MATCH: L'alternativa DEVE allenare gli stessi identici muscoli dell'esercizio originale. MAI suggerire un esercizio per le gambe se l'originale era per il dorso.
    2. CORPO LIBERO SEMPRE VALIDO: Considera tutti gli esercizi a CORPO LIBERO (bodyweight) copme SEMPRE disponibili (es. Push-up, Trazioni, Squat, Affondi, Plank, ecc.). Si può sempre trovare uno spazio a terra.
    3. VINCOLO INVENTARIO: Se non usi il corpo libero, puoi usare SOLO l'attrezzatura esplicitamente nominata nell'inventario mappato.
    4. FALLBACK "NESSUNA ALTERNATIVA": Se non ci sono macchine mappate idonee per quel muscolo E non c'è un esercizio a corpo libero che possa sostituirlo in modo efficace, devi tassativamente restituire come alternative "Nessuna alternativa disponibile" e spiegare in reason che non ha mappato attrezzi idonei per quel gruppo muscolare.
    5. Non suggerire esercizi già completati.
    
    Ritorna JSON (TESTO PULITO, NO MARKDOWN, NO SIMBOLI):
    {
      "alternative": "Nome Esercizio in ITALIANO (o 'Nessuna alternativa disponibile')",
      "reason": "Spiegazione tecnica in ITALIANO (no asterischi, no simboli)",
      "videoTip": "Breve nota in ITALIANO (no asterischi)"
    }
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const text = response.text || "{}";
    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("Alternative Suggestion Error:", error);
    return null;
  }
};

export const generateInstantWorkout = async (
  muscleFocus: string,
  timeMinutes: number,
  inventory: string[]
) => {
  const aiClient = getAI();
  if (!aiClient) return null;

  const prompt = `
    Crea un allenamento istantaneo di ${timeMinutes} minuti focalizzato su: ${muscleFocus}.
    Usa SOLO questa attrezzatura oppure Esercizi a Corpo Libero (Bodyweight): ${inventory.join(', ')}.
    
    Ritorna JSON (Nomi e note in ITALIANO):
    {
      "name": "Titolo Allenamento",
      "exercises": [
        {
          "name": "Nome Esercizio in ITALIANO",
          "sets": number,
          "reps": "string (es. '10-12')",
          "notes": "Breve consiglio tecnico in ITALIANO"
        }
      ]
    }
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const text = response.text || "{}";
    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("Instant Workout Error:", error);
    return null;
  }
};
