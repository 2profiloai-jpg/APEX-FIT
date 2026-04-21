import { GoogleGenAI, Type } from "@google/genai";
import { WorkoutSession, BiometricLog } from "../types";

// Dynamic initialization logic
let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (aiInstance) return aiInstance;
  
  let apiKey = "";
  try {
    // Standard AI Studio replacement
    apiKey = (process?.env?.GEMINI_API_KEY) || "";
  } catch (e) {
    // Fallback
    apiKey = "";
  }

  if (apiKey && apiKey !== "undefined" && apiKey !== "") {
    aiInstance = new GoogleGenAI({ apiKey });
    return aiInstance;
  }
  return null;
};

export const isAIReady = () => {
  try {
    const key = process.env.GEMINI_API_KEY;
    return !!key && key !== "undefined" && key !== "";
  } catch (e) {
    return false;
  }
};

export const initAI = async () => {
  const ai = getAI();
  if (!ai) {
    console.warn("GEMINI_API_KEY pending or missing.");
    return false;
  }
  console.log("AI system ready.");
  return true;
};

export const getStrategistAdvice = async (
  history: WorkoutSession[],
  biometrics: BiometricLog,
  nutrition?: { consumed: number, target: number, goal: string }
) => {
  const ai = getAI();
  if (!ai) return { readinessScore: 75, intensity: "Technical", tip: "IA non pronta." };

  const prompt = `Analizza dati: ${JSON.stringify({ biometrics, nutrition, history: history.slice(-3) })}. 
    Ritorna JSON: {"readinessScore": number, "intensity": "Heavy"|"Technical"|"Deload", "tip": string (max 20 parole, ITALIANO)}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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
    let text = response.text || "{}";
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    return { readinessScore: 75, intensity: "Technical", tip: "Analisi temporaneamente off." };
  }
};

export const parseFoodInput = async (input: string, imageBase64?: string) => {
  const ai = getAI();
  if (!ai) throw new Error("Servizio IA non inizializzato. Controlla la chiave API.");

  const prompt = `Analizza il pasto: "${input || 'Analizza immagine'}". 
    Sei un nutrizionista italiano d'élite. Calcola calorie e macro (carbs, pro, fat).
    Ritorna JSON con array "items".`;

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
    const response = await ai.models.generateContent({
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

    let text = response.text || "{}";
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const result = JSON.parse(text);
    if (!result.items) throw new Error("Risposta incompleta dall'IA.");
    return result;
  } catch (error: any) {
    console.error("Meal analysis error:", error);
    if (error.message?.includes("429")) throw new Error("Limite IA raggiunto. Attendi un istante.");
    throw new Error(`Errore IA: ${error.message || 'Analisi non riuscita'}`);
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
  const ai = getAI();
  if (!ai) return { text: "IA non pronta.", items: [] };

  const prompt = `Suggerisci pasto: ${remainingKcal}kcal, ${remainingPro}g Pro, ${remainingCarbs}g Carb, ${remainingFat}g Fat. Dispensa: ${pantryItems?.join(', ')}. Target: ${targetKcal}. Portate: ${portionsContext}.`;

  try {
    const response = await ai.models.generateContent({
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
                required: ["name", "kcal", "carbs", "protein", "fat", "amount"],
                properties: {
                  name: { type: Type.STRING },
                  kcal: { type: Type.NUMBER },
                  carbs: { type: Type.NUMBER },
                  protein: { type: Type.NUMBER },
                  fat: { type: Type.NUMBER },
                  amount: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    let text = response.text || "{}";
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    return { text: "Errore suggerimento.", items: [] };
  }
};

export const getPostWorkoutAdvice = async (sessionData: any) => {
  const ai = getAI();
  if (!ai) return "Ottimo lavoro!";
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Feedback per allenamento: ${JSON.stringify(sessionData)}`,
    });
    return (response.text || "").replace(/[*#_\-]/g, '').trim();
  } catch (error) {
    return "Allenamento salvato.";
  }
};

export const analyzeGymEquipment = async (imagesBase64?: string | string[], textInput?: string) => {
  const ai = getAI();
  if (!ai) throw new Error("IA non pronta");
  
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

  const prompt = textInput 
    ? `Mappa i seguenti macchinari o attrezzature: "${textInput}".`
    : "Quali macchinari o attrezzature vedi nelle immagini?";

  parts.push({ text: `${prompt} Ritorna JSON: {"equipment": [{"name": string, "category": string, "targetMuscles": string[], "equipmentType": "machine"|"dumbbell"|"barbell"|"other"}]}. Usa nomi tecnici italiani e categorizzali correttamente.` });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: "application/json" }
    });
    let text = response.text || "{}";
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    throw error;
  }
};

export const suggestExerciseAlternative = async (
  currentExerciseName: string,
  inventory: string[],
  completedExercises: string[] = [],
  isCrowded: boolean = false
) => {
  const ai = getAI();
  if (!ai) return null;
  const prompt = `Alternativa per ${currentExerciseName}. Attrezzatura: ${inventory.join(', ')}. JSON: {"alternative": string, "reason": string}`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    let text = response.text || "{}";
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
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
  const ai = getAI();
  if (!ai) return null;
  const prompt = `Allenamento di ${timeMinutes} min per ${muscleFocus}. Attrezzatura: ${inventory.join(', ')}. JSON.`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    let text = response.text || "{}";
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
};
