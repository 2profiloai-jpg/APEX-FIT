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
    
    Ritorna solo JSON:
    {
      "readinessScore": number,
      "intensity": "Heavy" | "Technical" | "Deload",
      "tip": "string"
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
    
    return JSON.parse(response.text || "{}");
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
  workoutContext?: string
) => {
  const aiClient = getAI();
  if (!aiClient) {
    throw new Error("Chiave API mancante. Impossibile generare suggerimenti.");
  }
  
  if (remainingKcal <= 50) return "Hai già raggiunto il tuo obiettivo calorico per oggi. Ottimo lavoro!";

  const pantryStr = pantryItems?.length ? pantryItems.join(', ') : 'Nessuna dispensa specificata, usa ingredienti comuni.';
  const favStr = favoriteMeals?.length ? JSON.stringify(favoriteMeals.map(f => ({ name: f.name, kcal: f.foods.reduce((acc: number, cur: any) => acc + (cur.kcal||0), 0) }))) : 'Nessun pasto preferito.';
  
  const prompt = `
    Sei un assistente nutrizionale pratico e diretto.
    L'obiettivo dell'utente è raggiungere il suo target calorico della giornata.
    
    Kcal mancanti oggi: ${Math.round(remainingKcal)} kcal.
    
    Ingredienti disponibili nella sua Dispensa: ${pantryStr}
    
    REGOLE:
    1. L'obiettivo principale è suggerire uno o due cibi/pasti veloci che coprano esattamente o quasi le ${Math.round(remainingKcal)} kcal mancanti.
    2. Usa MAGGIORMENTE o ESCLUSIVAMENTE gli alimenti presenti nella "Dispensa".
    3. Formula una o due frasi semplici. Esempio: "Per raggiungere le tue calorie oggi, mangia 150g di yogurt greco e 20g di mandorle dalla tua dispensa."
    4. Indirizza le porzioni in modo matematico in modo che la somma delle calorie degli alimenti suggeriti si avvicini a ${Math.round(remainingKcal)} kcal.
    5. Usa un tono informale e dritto al punto. Nessuna introduzione, parla solo di cibo e quantità. Non parlare di "macro" o "proteine/grassi/carboidrati" a meno che non sia strettamente necessario, concentrati sulle CALORIE.
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Nessun suggerimento generato.";
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
    Regole:
    1. Se lo sforzo è 'POCO' su molti set, consiglia esplicitamente di aumentare i carichi drasticamente la prossima volta.
    2. Se lo sforzo è spesso 'MOLTISSIMO', consiglia di fare attenzione al recupero centrale.
    3. Sii specifico su un esercizio se noti qualcosa di rilevante.
    4. Niente saluti. Vai dritto al punto su COME e COSA cambiare la prossima volta.
  `;

  try {
    console.log("AI Request (getPostWorkoutAdvice)");
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Ottimo allenamento completato.";
  } catch (error: any) {
    console.error("Post-Workout AI Error:", error);
    if (error.message?.includes("429") || error.message?.includes("quota")) {
      return "Analisi IA non disponibile (Limite raggiunto). Ottimo lavoro comunque!";
    }
    return "Allenamento salvato. Analisi IA non disponibile al momento.";
  }
};
