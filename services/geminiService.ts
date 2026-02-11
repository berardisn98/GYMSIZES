
import { GoogleGenAI } from "@google/genai";
import { WorkoutLog } from "../types";

export const getAIPerformanceAdvice = async (logs: WorkoutLog[]): Promise<string> => {
  // En este entorno, process.env.API_KEY es la única forma correcta y segura.
  const apiKey = process.env.API_KEY;

  if (!logs || logs.length === 0) {
    return "¡Bienvenido a GYMSIZES! Registra tu primer entrenamiento para recibir consejos del Coach.";
  }

  try {
    // Inicialización siguiendo las reglas de oro del nuevo SDK
    const ai = new GoogleGenAI({ apiKey: apiKey || "" });

    // Resumen de los últimos entrenamientos para dar contexto
    const historySummary = logs.slice(0, 3).map(l => 
      `${l.routineName}: realizó ${l.exercises.length} ejercicios.`
    ).join(' | ');

    // Llamada directa al modelo Gemini 3 Flash
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Eres un coach de gimnasio experto. Analiza este historial: ${historySummary}. 
      Dame un consejo motivador y técnico de máximo 15 palabras en español. 
      Usa conceptos como RPE, sobrecarga progresiva o volumen de entrenamiento.`,
    });

    /** 
     * REGLA CRÍTICA: En el nuevo SDK no se usa .text(), se usa .text
     * Si la respuesta no tiene texto, usamos un fallback motivador.
     */
    const advice = response.text?.trim();

    return advice || "¡Sigue dándole duro! La constancia es lo que construye el físico que buscas.";
  } catch (error) {
    // Si llegas aquí, es probable que la clave aún se esté propagando en el servidor
    console.error("Coach AI Connection Sync:", error);
    return "Enfócate en la técnica perfecta y la sobrecarga progresiva hoy. ¡A darle con todo!";
  }
};
