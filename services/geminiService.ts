
import { GoogleGenAI } from "@google/genai";
import { WorkoutLog } from "../types";

export const getAIPerformanceAdvice = async (logs: WorkoutLog[]): Promise<string> => {
  if (!process.env.API_KEY) {
    return "Configura tu API_KEY en Vercel para recibir consejos personalizados.";
  }

  // Always use direct initialization with process.env.API_KEY as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const lastLogs = logs.slice(0, 5).map(l => 
    `${l.date}: ${l.routineName} (${l.exercises.map(e => `${e.name} ${e.weight}kg`).join(', ')})`
  ).join('\n');

  const prompt = `Eres un experto entrenador de fuerza. Analiza mis últimos entrenamientos:
  ${lastLogs}
  
  Dame un consejo de 2 frases máximo en español sobre mi progresión de cargas o frecuencia. 
  Si ves que repito mucho el mismo peso, motívame a subir. Usa lenguaje técnico (RPE, sobrecarga progresiva, volumen).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // The text property returns the generated string output directly.
    return response.text || "Sigue empujando, la constancia es la clave.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "¡Sigue entrenando duro! La constancia es lo que trae los resultados.";
  }
};
