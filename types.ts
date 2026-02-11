
// Actualizado para incluir credenciales de acceso
export interface User {
  id: string;
  name: string;
  password?: string; // Campo añadido para login
  avatar: string;
}

export interface UserStats extends User {
  totalAttendance: number;
  weeklyCount: number;
  hasReachedWeeklyGoal: boolean;
  bonusPoints: number;
}

export interface AttendanceRecord {
  userId: string;
  date: string;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  lastWeight?: number;
}

export interface Routine {
  id: string;
  // Added userId to satisfy Routine type requirements in App.tsx and cloud synchronization
  userId: string;
  name: string;
  days: number[]; // 0-6 (Dom-Sab)
  exercises: Exercise[];
}

export interface WorkoutLog {
  id: string;
  userId?: string;
  userName?: string;
  date: string;
  routineId: string;
  routineName: string;
  exercises: {
    name: string;
    weight: number;
    setsCompleted: number;
    totalReps: number;
    wasSuccessful: boolean;
  }[];
}

export interface UserProfile {
  name: string;
  streak: number;
  lastWorkoutDate: string | null;
}
