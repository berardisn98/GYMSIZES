
export const APP_NAME = "GYMSIZES PRO";
export const STORAGE_KEYS = {
  ROUTINES: 'gs_routines_v1',
  LOGS: 'gs_logs_v1',
  PROFILE: 'gs_profile_v1',
  SESSION: 'gs_session_v1'
};

export const WEEKDAYS = [
  { id: 1, label: 'L' },
  { id: 2, label: 'M' },
  { id: 3, label: 'X' },
  { id: 4, label: 'J' },
  { id: 5, label: 'V' },
  { id: 6, label: 'S' },
  { id: 0, label: 'D' }
];

// Meta de asistencias semanales para el ranking
export const WEEKLY_GOAL = 4;
export const ADMIN_PIN = "1234";

// Configuración de Firebase proporcionada por el usuario
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAo2kWpK_1NTEssSn0_qGMTUtqLeeIi5P8",
  authDomain: "gymsizes.firebaseapp.com",
  projectId: "gymsizes",
  storageBucket: "gymsizes.firebasestorage.app",
  messagingSenderId: "194593991473",
  appId: "1:194593991473:web:3995cb11238ca78e7a5e10"
};
