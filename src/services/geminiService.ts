import { GoogleGenAI } from "@google/genai";
import { WorkoutSession, BiometricLog } from "../types";

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. AI features will be disabled.");
      return null;
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

export const getStrategistAdvice = async (
  history: WorkoutSession[],
  biometrics: BiometricLog
) => {
  const aiClient = getAI();
  if (!aiClient) {
    return { 
      readinessScore: 75, 
      intensity: "Technical", 
      tip: "Per attivare l'IA de 'Lo Strategista', aggiungi la variabile d'ambiente GEMINI_API_KEY su Vercel." 
    };
  }

  const prompt = `
    Sei "Lo Strategista", il motore logico centrale di Apex Lift Ultimate.
    Basandoti sulla cronologia recente degli allenamenti dell'utente e sui dati biometrici di oggi, fornisci una raccomandazione concisa per l'allenamento.
    
    Biometria di Oggi:
    - HRV: ${biometrics.hrv}
    - Sonno: ${biometrics.sleepHours}h
    - Stress: ${biometrics.stressLevel}/10
    
    Cronologia Recente:
    ${JSON.stringify(history.slice(-3))}
    
    Istruzioni:
    1. Calcola un "Readiness Score" (0-100).
    2. Suggerisci se l'utente dovrebbe andare "Pesante" (Heavy), "Tecnico" (Technical), o "Scarico" (Deload).
    3. Fornisci un consiglio specifico per la sessione di oggi in italiano.
    
    Ritorna solo JSON:
    {
      "readinessScore": number,
      "intensity": "Heavy" | "Technical" | "Deload",
      "tip": "string"
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
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Strategist Error:", error);
    return { readinessScore: 70, intensity: "Technical", tip: "Errore di connessione con l'IA. Concentrati sulla tecnica oggi." };
  }
};
