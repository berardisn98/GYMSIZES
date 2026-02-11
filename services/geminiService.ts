
import { GoogleGenAI } from "@google/genai";
import { WorkoutLog } from "../types";

export const getAIPerformanceAdvice = async (logs: WorkoutLog[]): Promise<string> => {
  // Obtenemos la clave directamente según las instrucciones del sistema
  const apiKey = process.env.API_KEY;

  // Si no hay logs, damos un mensaje de bienvenida sin gastar tokens
  if (!logs || logs.length === 0) {
    return "¡Bienvenido a GYMSIZES! Registra tu primer entrenamiento para recibir consejos del Coach.";
  }

  try {
    // Inicialización del cliente de última generación
    const ai = new GoogleGenAI({ apiKey: apiKey || "" });

    const historySummary = logs.slice(0, 3).map(l => 
      `${l.routineName}: ${l.exercises.length} ejercicios realizados.`
    ).join(' | ');

    // Usamos el modelo más potente y rápido disponible: Gemini 3 Flash
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Historial de entrenamiento: ${historySummary}. Dame un consejo técnico de 15 palabras en español sobre RPE o sobrecarga progresiva. Sé muy motivador.`,
    });

    // En el nuevo SDK, .text es una propiedad directa, no un método ()
    const advice = response.text;

    return advice || "¡Sigue así! Mantén la intensidad y el volumen bajo control.";
  } catch (error) {
    console.error("Error en Coach IA:", error);
    // Si falla por la API KEY, el usuario verá este mensaje motivador mientras se propaga la clave
    return "Enfócate en mejorar tu técnica en cada serie hoy. ¡La constancia es la clave del éxito!";
  }
};
