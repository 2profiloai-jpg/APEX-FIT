import { GoogleGenAI, Type } from "@google/genai";
import { WorkoutSession, BiometricLog } from "../types";

let ai: GoogleGenAI | null = null;
let aiReady = false;

export const initAI = async () => {
  try {
    let apiKey = "";
    
    // Attempt multiple sources for API key to ensure stability
    try {
      // @ts-ignore
      const envKey = process.env.GEMINI_API_KEY;
      if (envKey && envKey !== "undefined" && envKey !== "null") apiKey = envKey;
    } catch (e) {}
    
    if (!apiKey) {
      const meta = import.meta as any;
      apiKey = meta.env?.VITE_GEMINI_API_KEY || meta.env?.GEMINI_API_KEY || "";
    }

    if (apiKey && apiKey !== "undefined" && apiKey !== "null" && apiKey !== "") {
      ai = new GoogleGenAI({ apiKey });
      aiReady = true;
      console.log("AI initialized correctly.");
    } else {
      console.warn("GEMINI_API_KEY initialization pending or missing.");
    }
  } catch (e) {
    console.error("AI Initialization Error:", e);
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
  if (!aiClient) return { readinessScore: 75, intensity: "Technical", tip: "Attiva l'IA nelle impostazioni." };

  const prompt = `Analizza: Biometria=${JSON.stringify(biometrics)}, Nutrition=${JSON.stringify(nutrition)}, History=${JSON.stringify(history.slice(-3))}. Fornisci JSON con readinessScore (num), intensity, tip (max 20 parole).`;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["readinessScore", "intensity", "tip"],
          properties: {
            readinessScore: { type: Type.NUMBER },
            intensity: { type: Type.STRING },
            tip: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    return { readinessScore: 70, intensity: "Technical", tip: "Consulenza IA temporaneamente off." };
  }
};

export const parseFoodInput = async (input: string, imageBase64?: string) => {
  const aiClient = getAI();
  if (!aiClient) throw new Error("Servizio IA non pronto. Ricarica l'app.");

  const prompt = `
    Sei un nutrizionista d'élite per il mercato ITALIANO.
    Analizza questo pasto: "${input || 'Basati sull\'immagine'}"
    
    REGOLE:
    1. Database: Usa CREA/IEO (Italia).
    2. Precisione: Calcola kcal, carbs, protein, fat per ogni elemento.
    3. Matematica: (Pro*4 + Carbo*4 + Fat*9) ≈ kcal.
    4. Porzioni: Se non specificate, usa dosi standard italiane.
  `;

  const parts: any[] = [];
  if (imageBase64) {
    let data = imageBase64;
    let mimeType = "image/jpeg";
    if (imageBase64.startsWith('data:')) {
      const p = imageBase64.split(',');
      mimeType = p[0].split(':')[1].split(';')[0];
      data = p[1];
    }
    parts.push({ inlineData: { mimeType, data } });
  }
  parts.push({ text: prompt });

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview", // Flash is faster and more stable for mobile connections
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

    const parsed = JSON.parse(response.text || "{\"items\":[]}");
    if (!parsed.items || !Array.isArray(parsed.items)) throw new Error("Dati non validi dall'IA.");
    return parsed;
  } catch (error: any) {
    console.error("Food Parsing Error:", error);
    if (error.message?.includes("429")) throw new Error("Troppe richieste. Aspetta un minuto.");
    throw new Error("Errore nell'analisi. Verifica che la foto sia chiara.");
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
  if (!aiClient) throw new Error("AI non disponibile.");

  const prompt = `Suggerisci un pasto. Macro mancanti: ${remainingKcal} kcal, ${remainingPro}g Pro, ${remainingCarbs}g Carbo, ${remainingFat}g Fat. Dispensa: ${pantryItems?.join(', ')}. Contesto: ${workoutContext}.`;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
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
                required: ["name", "kcal", "carbs", "protein", "fat", "amount"],
                properties: {
                  name: { type: Type.STRING },
                  kcal: { type: Type.NUMBER },
                  carbs: { type: Type.NUMBER },
                  protein: { type: Type.NUMBER },
                  fat: { type: Type.NUMBER },
                  amount: { type: Type.STRING },
                  mealType: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "{\"text\":\"\",\"items\":[]}");
  } catch (error) {
    return { text: "Suggerimento non disponibile.", items: [] };
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
