import { GoogleGenAI } from "@google/genai";
import { WorkoutSession, BiometricLog } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const getStrategistAdvice = async (
  history: WorkoutSession[],
  biometrics: BiometricLog
) => {
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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Strategist Error:", error);
    return { readinessScore: 70, intensity: "Technical", tip: "Focus on form today." };
  }
};
