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
  biometrics: BiometricLog,
  nutrition?: { consumed: number, target: number, goal: string }
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
    1. Analisi Scostamento Nutrizionale: Se c'è un forte scostamento tra calorie assunte e obiettivo, fallo notare (es. "Oggi sei sotto di 400kcal rispetto al tuo obiettivo di massa. Considera uno snack proteico prima di dormire.").
    2. Bio-feedback: Usa i dati biometrici per consigliare idratazione, recupero o volume.
    3. Ottimizzazione Workout (RPE): Analizza gli RPE recenti se rilevanti.
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

export const parseFoodInput = async (input: string, imageBase64?: string) => {
  const aiClient = getAI();
  if (!aiClient) {
    throw new Error("AI non configurata");
  }

  const prompt = `
    L'utente ha inserito questo pasto in linguaggio naturale: "${input}"
    ${imageBase64 ? "L'utente ha anche fornito un'immagine del pasto." : ""}
    Stima i valori nutrizionali totali. Usa la ricerca web (Google Search) per ottenere dati precisi se necessario, specialmente per prodotti specifici o porzioni esatte.
    
    Ritorna SOLO un oggetto JSON con questa struttura esatta:
    {
      "name": "Nome riassuntivo del pasto (es. Pasta al pomodoro e pollo)",
      "kcal": numero totale di calorie stimate,
      "carbs": grammi di carboidrati stimati,
      "protein": grammi di proteine stimate,
      "fat": grammi di grassi stimati
    }
  `;

  const contents: any = {
    parts: [
      { text: prompt }
    ]
  };

  if (imageBase64) {
    const mimeType = imageBase64.split(';')[0].split(':')[1];
    const base64Data = imageBase64.split(',')[1];
    contents.parts.unshift({
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    });
  }

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: contents,
      tools: [{ googleSearch: {} }],
      config: {
        responseMimeType: "application/json"
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Food Parsing Error:", error);
    throw error;
  }
};

export const getPostWorkoutAdvice = async (sessionData: any) => {
  const aiClient = getAI();
  if (!aiClient) {
    return "Ottimo lavoro! Per ricevere consigli personalizzati dall'IA su cosa cambiare nel prossimo allenamento, configura la tua API Key.";
  }

  const prompt = `
    Sei "Lo Strategista", un coach di powerbuilding di élite.
    L'utente ha appena terminato questo allenamento:
    ${JSON.stringify(sessionData)}
    
    Analizza i dati (kg, reps, RPE) e fornisci un feedback POST-ALLENAMENTO di massimo 3 frasi.
    Regole:
    1. Se l'RPE medio è basso (sotto 6), consiglia esplicitamente di aumentare i carichi la prossima volta.
    2. Se l'RPE è alto (9-10) su molti set, consiglia di fare attenzione al recupero o di abbassare il volume.
    3. Sii specifico su un esercizio se noti qualcosa di rilevante.
    4. Niente saluti o frasi motivazionali inutili. Vai dritto al punto su COME e COSA cambiare la prossima volta.
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Ottimo allenamento completato.";
  } catch (error) {
    console.error("Post-Workout AI Error:", error);
    return "Allenamento salvato. Analisi IA non disponibile al momento.";
  }
};
