import { GoogleGenAI } from "@google/genai";
import { WorkoutSession, BiometricLog } from "../types";

let ai: GoogleGenAI | null = null;
let aiReady = false;

export const initAI = async () => {
  try {
    let apiKey = "";
    
    // 1. Primary source: process.env.GEMINI_API_KEY
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
      tip: "Configura la tua GEMINI_API_KEY nelle impostazioni per ricevere consigli personalizzati." 
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
    return { readinessScore: 70, intensity: "Technical", tip: "Errore di connessione con l'IA." };
  }
};

export const parseFoodInput = async (input: string, imageBase64?: string) => {
  const aiClient = getAI();
  if (!aiClient) {
    throw new Error("Chiave API mancante.");
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
    } catch (e) {}
  }
  parts.push({ text: prompt });

  try {
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
    if (jsonMatch) text = jsonMatch[0];
    const parsed = JSON.parse(text);
    if (!parsed.items || !Array.isArray(parsed.items)) throw new Error("Formato non valido.");
    return parsed;
  } catch (error: any) {
    console.error("Food Parsing Error:", error);
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
  if (!aiClient) throw new Error("Chiave API mancante.");
  
  if (remainingKcal <= 50) return { text: "Hai raggiunto l'obiettivo!", items: [] };

  const pantryStr = pantryItems?.length ? pantryItems.join(', ') : 'Ingredienti comuni.';
  const portionsStr = portionsContext ? `\n    - ABITUDINI: ${portionsContext}` : '';
  
  const prompt = `
    Sei un assistente nutrizionale d'élite.
    Kcal mancanti oggi: ${Math.round(remainingKcal)} kcal${portionsStr}
    Dispensa: ${pantryStr}
    Contesto: ${workoutContext || 'Nessuno'}
    
    REGOLE:
    1. NO MARKDOWN. Solo testo pulito WhatsApp-style.
    2. Suddividi in pasti mancanti.
    3. Alla fine aggiungi [DATA] JSON [/DATA] con: [{"name": string, "amount": string, "kcal": number, "carbs": number, "protein": number, "fat": number, "mealType": string}].
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
    let cleanText = fullText.replace(dataRegex, '').trim().replace(/[*#_]/g, '');
    if (match && match[1]) {
      try {
        items = JSON.parse(match[1].trim());
      } catch (e) {}
    }
    return { text: cleanText, items };
  } catch (error: any) {
    throw new Error("Errore suggerimento.");
  }
};

export const getPostWorkoutAdvice = async (sessionData: any) => {
  const aiClient = getAI();
  if (!aiClient) return "Ottimo lavoro!";
  const prompt = `Analizza questo allenamento e dai un feedback di 2 frasi: ${JSON.stringify(sessionData)}`;
  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return (response.text || "").replace(/[*#_\-]/g, '').trim();
  } catch (error) {
    return "Allenamento salvato.";
  }
};

export const analyzeGymEquipment = async (imagesBase64?: string | string[], textInput?: string) => {
  const aiClient = getAI();
  if (!aiClient) throw new Error("AI not ready");
  const prompt = `Analizza l'attrezzatura presente. Ritorna JSON: {"equipment": [...]}`;
  const parts: any[] = [];
  if (imagesBase64) {
    const arr = Array.isArray(imagesBase64) ? imagesBase64 : [imagesBase64];
    for (const img of arr) {
      if (!img) continue;
      let data = img, mime = "image/jpeg";
      if (img.startsWith('data:')) {
        const p = img.split(',');
        mime = p[0].split(':')[1].split(';')[0];
        data = p[1];
      }
      parts.push({ inlineData: { mimeType: mime, data } });
    }
  }
  parts.push({ text: prompt });
  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: "application/json" }
    });
    const text = (response.text || "{}").replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
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
  const prompt = `Trova alternativa per ${currentExerciseName}. Inventario: ${inventory.join(', ')}. Ritorna JSON {"alternative": string, "reason": string, "videoTip": string}`;
  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const text = (response.text || "{}").replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
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
  const prompt = `Allenamento di ${timeMinutes} min su ${muscleFocus}. Inventario: ${inventory.join(', ')}. Ritorna JSON.`;
  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const text = (response.text || "{}").replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
};
