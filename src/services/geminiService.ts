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
    Analizza la cronologia e la biometria per fornire una raccomandazione di allenamento.
    
    Biometria di Oggi:
    - HRV: ${biometrics.hrv}
    - Sonno: ${biometrics.sleepHours}h
    - Stress: ${biometrics.stressLevel}/10
    
    Cronologia Recente:
    ${JSON.stringify(history.slice(-3))}
    
    REGOLE FONDAMENTALI PER IL CONSIGLIO (tip):
    1. Tecnica e Salute: Dai un consiglio biomeccanico specifico per i gruppi muscolari allenati di recente (es. "Ricorda di deprimere le scapole per proteggere la colonna").
    2. Bio-feedback: Usa i dati biometrici per consigliare idratazione, recupero o volume (es. "HRV basso, mantieni un buffer più alto").
    3. Ottimizzazione Workout (RPE): Analizza gli RPE recenti. Se la media RPE < 6, suggerisci di aumentare il carico o le ripetizioni. Se RPE 9-10, suggerisci di mantenere il peso o scaricare se il volume è alto.
    4. CONSTRAINT: NIENTE frasi motivazionali generiche (max 10% del testo). Sii analitico, scientifico e diretto.
    
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
