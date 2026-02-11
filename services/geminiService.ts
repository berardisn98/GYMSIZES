
import { GoogleGenAI } from "@google/genai";
import { WorkoutLog } from "../types";

export const getAIPerformanceAdvice = async (logs: WorkoutLog[]): Promise<string> => {
  // La API_KEY se inyecta automáticamente como process.env.API_KEY
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === "undefined") {
    return "El Coach IA se está sincronizando. Asegúrate de que la variable API_KEY esté activa en tu panel de control.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const lastLogs = logs.slice(0, 5).map(l => 
      `${l.date}: ${l.routineName} (${l.exercises.map(e => `${e.name} ${e.weight}kg`).join(', ')})`
    ).join('\n');

    const prompt = `Eres un experto entrenador de fuerza. Analiza mis últimos entrenamientos:
    ${lastLogs}
    
    Dame un consejo de 2 frases máximo en español sobre mi progresión de cargas o frecuencia. 
    Usa lenguaje técnico (RPE, sobrecarga progresiva, volumen). Sé directo y motivador.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "¡Buen progreso! Mantén el RPE alto y la técnica impecable.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Coach IA: Estamos analizando tu volumen de entrenamiento. ¡Sigue dándole duro!";
  }
};
