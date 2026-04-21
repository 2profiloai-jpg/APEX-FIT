import { GoogleGenAI, Type } from "@google/genai";
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
      console.log("AI initialized successfully with stable model.");
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
    
    REGOLE FONDAMENTALI:
    1. Analisi Scostamento Nutrizionale: Se c'è un forte scostamento tra calorie assunte e obiettivo, fallo notare.
    2. Bio-feedback: Usa i dati biometrici per consigliare idratazione, recupero o volume.
    3. Ottimizzazione Workout: Analizza i livelli di sforzo recenti.
    4. CONSTRAINT: NIENTE frasi motivazionali generiche. Sii analitico e diretto.
    
    Ritorna JSON:
    {
      "readinessScore": number,
      "intensity": "Heavy" | "Technical" | "Deload",
      "tip": "string (in ITALIANO, max 20 parole)"
    }
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Strategist Error:", error);
    return { readinessScore: 70, intensity: "Technical", tip: "Analisi IA non disponibile al momento." };
  }
};

export const parseFoodInput = async (input: string, imageBase64?: string) => {
  const aiClient = getAI();
  if (!aiClient) {
    throw new Error("Chiave API mancante.");
  }

  const prompt = `
    Sei un nutrizionista clinico esperto del mercato ITALIANO. Calcola kcal e macro per gli alimenti indicati.
    Pasto: "${input || 'Basati sull\'immagine'}"
    
    REGOLE:
    1. Usa dati reali italiani (CREA/IEO).
    2. Se non specificato, stima porzioni medie italiane.
    3. (Carbo * 4) + (Pro * 4) + (Fat * 9) = Kcal.
  `;

  const parts: any[] = [];
  if (imageBase64) {
    let base64Data = imageBase64;
    let mimeType = "image/jpeg";
    if (imageBase64.startsWith('data:')) {
      const partsArr = imageBase64.split(',');
      mimeType = partsArr[0].split(':')[1].split(';')[0];
      base64Data = partsArr[1];
    }
    parts.push({ inlineData: { mimeType, data: base64Data } });
  }
  parts.push({ text: prompt });

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-flash-latest",
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["items"],
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["name", "kcal", "carbs", "protein", "fat"],
                properties: {
                  name: { type: Type.STRING },
                  kcal: { type: Type.NUMBER },
                  carbs: { type: Type.NUMBER },
                  protein: { type: Type.NUMBER },
                  fat: { type: Type.NUMBER }
                }
              }
            }
          }
        },
        temperature: 0.1
      }
    });
    
    return JSON.parse(response.text || "{\"items\":[]}");
  } catch (error: any) {
    console.error("Food Parsing Error:", error);
    if (error.message?.includes("429") || error.message?.includes("quota")) {
      throw new Error("Limite IA raggiunto. Riprova tra un minuto.");
    }
    throw new Error("Errore durante l'analisi del pasto con il nuovo modello.");
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
): Promise<{ text: string, items: any[] }> => {
  const aiClient = getAI();
  if (!aiClient) throw new Error("AI not ready");

  const pantryStr = pantryItems?.length ? pantryItems.join(', ') : 'Ingredienti comuni.';
  const prompt = `
    Suggerisci un pasto bilanciato per rimanere nei macro.
    Kcal mancanti: ${remainingKcal}.
    Dispensa: ${pantryStr}.
    Contesto: ${workoutContext || 'Nessuno'}.
    
    Ritorna JSON con testo "text" (senza markdown) e un array "items" di alimenti strutturati (name, kcal, carbs, protein, fat, mealType).
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["text", "items"],
          properties: {
            text: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["name", "kcal", "carbs", "protein", "fat", "mealType"],
                properties: {
                  name: { type: Type.STRING },
                  kcal: { type: Type.NUMBER },
                  carbs: { type: Type.NUMBER },
                  protein: { type: Type.NUMBER },
                  fat: { type: Type.NUMBER },
                  mealType: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    
    const parsed = JSON.parse(response.text || "{}");
    return { text: parsed.text || "", items: parsed.items || [] };
  } catch (error) {
    console.error("Meal Suggestion Error:", error);
    return { text: "Impossibile caricare suggerimenti al momento.", items: [] };
  }
};

export const getPostWorkoutAdvice = async (sessionData: any) => {
  const aiClient = getAI();
  if (!aiClient) return "Ottimo lavoro!";

  const prompt = `Fornisci un feedback tecnico di 2-3 frasi per questo allenamento: ${JSON.stringify(sessionData)}`;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });
    return response.text?.replace(/[*#_\-]/g, '').trim() || "Allenamento salvato con successo.";
  } catch (error) {
    return "Allenamento registrato correttamente.";
  }
};

export const analyzeGymEquipment = async (imagesBase64?: string | string[], textInput?: string) => {
  const aiClient = getAI();
  if (!aiClient) throw new Error("AI not ready");

  const prompt = `Analizza l'attrezzatura presente: ${textInput || ''}. Ritorna JSON list 'equipment'.`;

  const parts: any[] = [];
  if (imagesBase64) {
    const arr = Array.isArray(imagesBase64) ? imagesBase64 : [imagesBase64];
    for (const img of arr) {
      if (!img) continue;
      let data = img;
      let mime = "image/jpeg";
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
      model: "gemini-flash-latest",
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            equipment: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  targetMuscles: { type: Type.ARRAY, items: { type: Type.STRING } },
                  equipmentType: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "{\"equipment\":[]}");
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

  const prompt = `Esercizio originale: ${currentExerciseName}. Inventario: ${inventory.join(', ')}. Suggerisci un'alternativa in JSON.`;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["alternative", "reason", "videoTip"],
          properties: {
            alternative: { type: Type.STRING },
            reason: { type: Type.STRING },
            videoTip: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
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

  const prompt = `Allenamento di ${timeMinutes} min focalizzato su ${muscleFocus}. Solo attrezzatura: ${inventory.join(', ')}.`;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["name", "exercises"],
          properties: {
            name: { type: Type.STRING },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["name", "sets", "reps", "notes"],
                properties: {
                  name: { type: Type.STRING },
                  sets: { type: Type.NUMBER },
                  reps: { type: Type.STRING },
                  notes: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    return null;
  }
};
