
import { GoogleGenAI } from "@google/genai";
import { WorkoutLog } from "../types";

export const getAIPerformanceAdvice = async (logs: WorkoutLog[]): Promise<string> => {
  // El sistema obtiene la clave directamente de las variables de entorno de Vercel
  const apiKey = process.env.API_KEY;

  // Si la clave no está disponible (ej. durante el despliegue inicial)
  if (!apiKey || apiKey === "undefined") {
    return "El Coach IA está preparando tu plan de hoy. ¡Asegúrate de registrar tus series!";
  }

  // Si el usuario es nuevo y no tiene historial
  if (!logs || logs.length === 0) {
    return "¡Bienvenido a GYMSIZES! Completa tu primer entrenamiento para que pueda analizar tu rendimiento y darte consejos técnicos.";
  }

  try {
    // Inicialización siguiendo estrictamente las reglas del SDK
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const historySummary = logs.slice(0, 3).map(l => 
      `${l.routineName} (${l.exercises.length} exs)`
    ).join(', ');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analiza este breve historial: ${historySummary}. Dame un consejo de 15 palabras máximo en español. Usa términos como RPE, volumen o sobrecarga. Sé motivador.`,
    });

    return response.text?.trim() || "¡Buen ritmo! Mantén la técnica y la intensidad alta.";
  } catch (error) {
    // Fallback profesional para no interrumpir la experiencia de usuario
    console.warn("IA Sync Note:", error);
    return "Enfócate en la sobrecarga progresiva esta semana. ¡Vas por buen camino!";
  }
};
