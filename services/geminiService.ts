
import { GoogleGenAI } from "@google/genai";
import { WorkoutLog } from "../types";

export const getAIPerformanceAdvice = async (logs: WorkoutLog[]): Promise<string> => {
  // Fix: Initialize GoogleGenAI strictly using process.env.API_KEY as a named parameter
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
  
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
    // Fix: Directly access the .text property from GenerateContentResponse
    return response.text || "Sigue empujando, la constancia es la clave.";
  } catch (error) {
    return "Analizando tus fibras musculares... ¡Sigue así!";
  }
};
