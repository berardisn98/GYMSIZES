
import React, { useState, useEffect, useMemo } from 'react';
import { Routine, WorkoutLog, UserProfile, Exercise, User, UserStats } from './types';
import { APP_NAME, STORAGE_KEYS, WEEKDAYS, WEEKLY_GOAL } from './constants';
import { getAIPerformanceAdvice } from './services/geminiService';
import { isFirebaseActive, syncCollection, saveToCloud, deleteFromCloud } from './services/firebaseService';
import Login from './components/Login';
import Leaderboard from './components/Leaderboard';

const KG_TO_LBS = 2.20462;

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'dash' | 'routines' | 'active' | 'history'>('dash');
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]); 
  const [friends, setFriends] = useState<User[]>([]);
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const [sessionProgress, setSessionProgress] = useState<Record<string, (number | null)[]>>({});
  const [editingSet, setEditingSet] = useState<{ exId: string, setIndex: number, reps: number } | null>(null);
  const [coachAdvice, setCoachAdvice] = useState<string>("Analizando tus marcas...");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estado para borrados con confirmación integrada
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Estados para formularios
  const [isAddingRoutine, setIsAddingRoutine] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineDays, setNewRoutineDays] = useState<number[]>([]);
  const [editingExercise, setEditingExercise] = useState<{routineId: string, exerciseId: string | null} | null>(null);
  const [newEx, setNewEx] = useState({ name: "", kg: "0", lbs: "0", sets: "3", reps: "10" });

  // 1. Cargar sesión persistente al iniciar
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
      }
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseActive()) return;
    const unsubUsers = syncCollection('users', (data) => setFriends(data));
    const unsubAllLogs = syncCollection('workout_logs', (data) => setAllLogs(data));
    return () => { unsubUsers?.(); unsubAllLogs?.(); };
  }, []);

  useEffect(() => {
    if (!currentUser || !isFirebaseActive()) return;
    const unsubRoutines = syncCollection('routines', (data) => {
      setRoutines(data.filter((r: any) => r.userId === currentUser.id));
    });
    const unsubMyLogs = syncCollection('workout_logs', (data) => {
      const myLogs = data
        .filter((l: any) => l.userId === currentUser.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLogs(myLogs);
    });
    return () => { unsubRoutines?.(); unsubMyLogs?.(); };
  }, [currentUser]);

  useEffect(() => {
    if (logs.length > 0) getAIPerformanceAdvice(logs).then(setCoachAdvice);
  }, [logs.length]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (confirmDeleteId) {
      const timer = setTimeout(() => setConfirmDeleteId(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [confirmDeleteId]);

  const leaderboardStats = useMemo(() => {
    return friends.map(friend => {
      const friendLogs = allLogs.filter(l => l.userId === friend.id);
      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1)).toISOString().split('T')[0];
      const weeklyCount = friendLogs.filter(l => l.date >= startOfWeek).length;
      return { ...friend, totalAttendance: friendLogs.length, weeklyCount, hasReachedWeeklyGoal: weeklyCount >= WEEKLY_GOAL, bonusPoints: 0 } as UserStats;
    });
  }, [friends, allLogs]);

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    setCurrentUser(null);
  };

  const handleLogin = (user: User, keepSession: boolean) => {
    if (keepSession) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
    }
    setCurrentUser(user);
  };

  const handleWeightChange = (val: string, unit: 'kg' | 'lbs') => {
    // Permitir cadena vacía para que el usuario pueda borrar, pero convertir a 0 para cálculos
    if (val === "") {
        setNewEx({ ...newEx, kg: unit === 'kg' ? "" : newEx.kg, lbs: unit === 'lbs' ? "" : newEx.lbs });
        return;
    }
    const num = parseFloat(val) || 0;
    if (unit === 'kg') {
      setNewEx({ ...newEx, kg: val, lbs: (num * KG_TO_LBS).toFixed(1) });
    } else {
      setNewEx({ ...newEx, lbs: val, kg: (num / KG_TO_LBS).toFixed(1) });
    }
  };

  const toggleDay = (dayId: number) => {
    setNewRoutineDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    );
  };

  const saveRoutine = async () => {
    if (!newRoutineName.trim() || !currentUser) return;
    const routineId = Date.now().toString();
    const newR = { 
      id: routineId, 
      userId: currentUser.id, 
      name: newRoutineName, 
      days: newRoutineDays, 
      exercises: [] 
    };
    await saveToCloud('routines', routineId, newR);
    setNewRoutineName("");
    setNewRoutineDays([]);
    setIsAddingRoutine(false);
    showToast("Rutina creada");
  };

  const executeDelete = async (type: 'routine' | 'log' | 'exercise', id: string, extraId?: string) => {
    if (type === 'routine') {
      await deleteFromCloud('routines', id);
      showToast("Rutina eliminada");
    } else if (type === 'log') {
      await deleteFromCloud('workout_logs', id);
      showToast("Registro borrado");
    } else if (type === 'exercise' && extraId) {
      const routine = routines.find(r => r.id === id);
      if (routine) {
        const newExercises = routine.exercises.filter(ex => ex.id !== extraId);
        await saveToCloud('routines', id, { ...routine, exercises: newExercises });
        showToast("Ejercicio quitado");
      }
    }
    setConfirmDeleteId(null);
  };

  const saveExercise = async () => {
    // Validaciones explícitas con feedback
    if (!editingExercise) return;
    if (!newEx.name.trim()) {
        alert("¡Ey! El ejercicio necesita un nombre.");
        return;
    }

    const routine = routines.find(r => r.id === editingExercise.routineId);
    if (!routine) {
        console.error("No se encontró la rutina:", editingExercise.routineId);
        return;
    }

    const weightNum = Math.max(0, parseFloat(newEx.kg) || 0);

    const exerciseData = { 
      id: editingExercise.exerciseId || `ex-${Date.now()}`, 
      name: newEx.name.trim(), 
      weight: weightNum, 
      sets: Math.max(1, parseInt(newEx.sets) || 1), 
      reps: Math.max(1, parseInt(newEx.reps) || 1) 
    };

    const newExercises = editingExercise.exerciseId 
      ? routine.exercises.map(ex => ex.id === editingExercise.exerciseId ? exerciseData : ex) 
      : [...routine.exercises, exerciseData];

    try {
        await saveToCloud('routines', routine.id, { ...routine, exercises: newExercises });
        setNewEx({ name: "", kg: "0", lbs: "0", sets: "3", reps: "10" });
        setEditingExercise(null);
        showToast(editingExercise.exerciseId ? "Ejercicio actualizado" : "Ejercicio añadido");
    } catch (err) {
        console.error("Error guardando ejercicio:", err);
    }
  };

  const startWorkout = (routine: Routine) => {
    setActiveRoutine(routine);
    const initialProgress: Record<string, (number | null)[]> = {};
    routine.exercises.forEach(ex => { initialProgress[ex.id] = new Array(ex.sets).fill(null); });
    setSessionProgress(initialProgress);
    setView('active');
  };

  const finishWorkout = async () => {
    if (!activeRoutine || !currentUser) return;
    const logId = Date.now().toString();
    const newLog = {
      id: logId, userId: currentUser.id, userName: currentUser.name,
      date: new Date().toISOString().split('T')[0],
      routineId: activeRoutine.id, routineName: activeRoutine.name,
      exercises: activeRoutine.exercises.map(ex => {
        const repsArray = sessionProgress[ex.id] || [];
        const completedReps = repsArray.filter((r): r is number => r !== null);
        const wasSuccessful = completedReps.length === ex.sets && completedReps.every(r => r >= ex.reps);
        return { name: ex.name, weight: ex.weight, setsCompleted: completedReps.length, totalReps: completedReps.reduce((a, b) => a + b, 0), wasSuccessful };
      })
    };

    await saveToCloud('workout_logs', logId, newLog);
    const updatedExercises = activeRoutine.exercises.map(ex => {
      const logEntry = newLog.exercises.find(e => e.name === ex.name);
      return logEntry?.wasSuccessful ? { ...ex, weight: ex.weight + 2.5, lastWeight: ex.weight } : ex;
    });
    await saveToCloud('routines', activeRoutine.id, { ...activeRoutine, exercises: updatedExercises });
    
    showToast("¡LOG SUBIDO! +1 ASISTENCIA 🔥");
    setView('dash');
    setActiveRoutine(null);
  };

  const updateSetProgress = (exId: string, setIndex: number, reps: number | null) => {
    setSessionProgress(prev => ({
      ...prev,
      [exId]: (prev[exId] || []).map((r, i) => (i === setIndex ? reps : r)),
    }));
    setEditingSet(null);
  };

  const showToast = (msg: string) => setSuccessMessage(msg);

  if (!currentUser) return <Login users={friends} onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 selection:bg-emerald-500/30">
      {successMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl border border-emerald-400 flex items-center gap-3">
            <span className="text-lg">💪</span>
            {successMessage}
          </div>
        </div>
      )}

      <header className="p-6 border-b border-slate-900 flex justify-between items-center bg-slate-950/80 sticky top-0 z-50 backdrop-blur-md">
        <div onClick={() => setView('dash')} className="cursor-pointer">
          <h1 className="text-2xl font-black italic tracking-tighter text-emerald-500">{APP_NAME}</h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
            <span className={isFirebaseActive() ? 'text-emerald-500' : 'text-orange-500'}>●</span> 
            {isFirebaseActive() ? 'Sync Activo' : 'Local'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-black text-white uppercase truncate max-w-[80px]">{currentUser.name}</div>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Atleta</p>
          </div>
          <img src={currentUser.avatar} className="w-10 h-10 rounded-full border-2 border-emerald-500 bg-slate-900 shadow-lg shadow-emerald-500/20" />
        </div>
      </header>

      <main className="p-5 max-w-lg mx-auto">
        {view === 'dash' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <Leaderboard stats={leaderboardStats} />
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-20"><SettingsIcon /></div>
              <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="animate-pulse">●</span> IA Performance Coach
              </h3>
              <p className="text-sm font-medium italic text-slate-200">"{coachAdvice}"</p>
            </div>
            <section>
              <h2 className="text-sm font-black uppercase text-slate-500 tracking-widest mb-4">Entrenamientos Disponibles</h2>
              {routines.map(r => (
                <button type="button" key={r.id} onClick={() => startWorkout(r)} className="w-full bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 flex justify-between items-center mb-3 active:scale-[0.98] transition-all group hover:border-emerald-500/50">
                  <div className="text-left">
                    <h4 className="text-xl font-black uppercase italic group-hover:text-emerald-400 transition-colors">{r.name}</h4>
                    <div className="flex gap-1 mt-1">
                      {WEEKDAYS.map(d => (
                        <span key={d.id} className={`text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border ${r.days?.includes(d.id) ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-slate-800 text-slate-600'}`}>
                          {d.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-900/40 group-hover:scale-110 transition-transform"><PlayIcon /></div>
                </button>
              ))}
              {routines.length === 0 && (
                <div onClick={() => setView('routines')} className="text-center py-12 border-2 border-dashed border-slate-800 rounded-[2.5rem] text-slate-500 font-black uppercase text-xs cursor-pointer hover:border-emerald-500 transition-colors">
                  Crea tu primera rutina para empezar
                </div>
              )}
            </section>
          </div>
        )}

        {view === 'routines' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black uppercase italic tracking-tight">Gestión de Rutinas</h2>
              {!isAddingRoutine && (
                <button type="button" onClick={() => setIsAddingRoutine(true)} className="bg-emerald-600 text-[10px] font-black px-5 py-2.5 rounded-full shadow-lg shadow-emerald-900/30">+ NUEVA</button>
              )}
            </div>
            
            {isAddingRoutine && (
              <div className="bg-slate-900 p-6 rounded-[2rem] border border-emerald-500/30 animate-in slide-in-from-top duration-300 shadow-2xl">
                <div className="space-y-1 mb-4">
                  <label className="text-[9px] font-black text-slate-500 uppercase ml-2 tracking-widest">Nombre del Plan</label>
                  <input autoFocus value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)} placeholder="Ej: Empuje / Tirón" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white font-bold outline-none focus:border-emerald-500" />
                </div>

                <div className="space-y-2 mb-6">
                  <label className="text-[9px] font-black text-slate-500 uppercase ml-2 tracking-widest">Días de Entrenamiento</label>
                  <div className="flex justify-between bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
                    {WEEKDAYS.map(day => (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => toggleDay(day.id)}
                        className={`w-9 h-9 rounded-full font-black text-[10px] transition-all border ${
                          newRoutineDays.includes(day.id) 
                          ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-900/40 scale-110' 
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => { setIsAddingRoutine(false); setNewRoutineDays([]); }} className="flex-1 py-4 text-slate-500 font-black text-[10px] uppercase">Cancelar</button>
                  <button type="button" onClick={saveRoutine} className="flex-1 bg-emerald-600 rounded-2xl font-black text-[10px] text-white py-4 shadow-xl shadow-emerald-900/40">Crear Rutina</button>
                </div>
              </div>
            )}

            {routines.map(r => (
              <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden mb-6 shadow-xl relative group">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                  <div>
                    <h3 className="text-xl font-black uppercase italic text-emerald-400">{r.name}</h3>
                    <div className="flex gap-1 mt-1">
                      {WEEKDAYS.map(d => (
                        <span key={d.id} className={`text-[7px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border ${r.days?.includes(d.id) ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-slate-800 text-slate-700'}`}>
                          {d.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        if (confirmDeleteId === r.id) {
                            executeDelete('routine', r.id);
                        } else {
                            setConfirmDeleteId(r.id);
                        }
                    }} 
                    className={`h-11 flex items-center justify-center transition-all px-4 rounded-full border shadow-lg ${
                        confirmDeleteId === r.id 
                        ? 'bg-red-600 border-red-400 text-white w-auto animate-pulse' 
                        : 'bg-slate-950 border-slate-800 text-slate-500 w-11'
                    }`}
                  >
                    {confirmDeleteId === r.id ? <span className="text-[10px] font-black tracking-widest">¿BORRAR?</span> : <TrashIcon />}
                  </button>
                </div>
                <div className="p-6 space-y-3">
                  {r.exercises.map(ex => (
                    <div key={ex.id} className="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-slate-700/30">
                      <div>
                        <div className="font-black text-sm text-slate-100 uppercase italic tracking-tight">{ex.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{ex.sets}x{ex.reps} @ <span className="text-emerald-500">{ex.weight}kg</span></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          onClick={(e) => { 
                            e.stopPropagation();
                            setEditingExercise({routineId: r.id, exerciseId: ex.id}); 
                            setNewEx({name: ex.name, kg: ex.weight.toString(), lbs: (ex.weight*KG_TO_LBS).toFixed(1), sets: ex.sets.toString(), reps: ex.reps.toString()}); 
                          }} 
                          className="w-10 h-10 flex items-center justify-center text-emerald-500 bg-slate-950 rounded-xl border border-emerald-500/20 active:scale-90 transition-all shadow-sm"
                        >
                          <EditIcon />
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => { 
                              e.stopPropagation(); 
                              const deleteKey = `ex-${ex.id}`;
                              if (confirmDeleteId === deleteKey) {
                                  executeDelete('exercise', r.id, ex.id);
                              } else {
                                  setConfirmDeleteId(deleteKey);
                              }
                          }} 
                          className={`h-10 flex items-center justify-center transition-all rounded-xl border active:scale-95 shadow-md ${
                              confirmDeleteId === `ex-${ex.id}` 
                              ? 'bg-red-600 border-red-400 text-white w-auto px-3 animate-pulse' 
                              : 'bg-slate-950 border-red-500/10 text-red-500/50 w-10'
                          }`}
                        >
                          {confirmDeleteId === `ex-${ex.id}` ? <span className="text-[8px] font-black">CONFIRMAR</span> : <TrashIcon />}
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {!editingExercise && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingExercise({ routineId: r.id, exerciseId: null });
                        setNewEx({ name: "", kg: "0", lbs: "0", sets: "3", reps: "10" });
                      }} 
                      className="w-full py-5 border-2 border-dashed border-slate-800 rounded-2xl text-[10px] font-black text-slate-600 uppercase hover:border-emerald-500/50 hover:text-emerald-500 transition-all active:scale-[0.98]"
                    >
                      + AÑADIR EJERCICIO
                    </button>
                  )}

                  {editingExercise?.routineId === r.id && (
                    <div className="bg-slate-950 p-5 rounded-3xl space-y-4 mt-2 border border-emerald-500/30 animate-in zoom-in-95 duration-200 shadow-2xl">
                      <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-3">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-center border-b border-slate-800 pb-2 mb-2">Calculadora de Carga</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest text-center block">KILOS (KG)</label>
                            <input type="number" step="0.5" value={newEx.kg} onChange={e => handleWeightChange(e.target.value, 'kg')} className="w-full bg-slate-950 rounded-xl p-4 text-emerald-400 font-black text-center border border-emerald-500/40 text-xl outline-none" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-black text-blue-500 uppercase tracking-widest text-center block">LIBRAS (LBS)</label>
                            <input type="number" step="0.5" value={newEx.lbs} onChange={e => handleWeightChange(e.target.value, 'lbs')} className="w-full bg-slate-950 rounded-xl p-4 text-blue-400 font-black text-center border border-blue-500/40 text-xl outline-none" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                         <label className="text-[9px] font-black text-slate-500 uppercase ml-2 tracking-widest">Nombre del Ejercicio</label>
                         <input autoFocus value={newEx.name} onChange={e => setNewEx({...newEx, name: e.target.value})} placeholder="Ej: Press Banca Plano" className={`w-full bg-slate-900 rounded-xl p-4 text-white text-sm font-bold border outline-none transition-colors ${!newEx.name.trim() ? 'border-red-500/30 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500'}`} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Series</label>
                          <input type="number" value={newEx.sets} onChange={e => setNewEx({...newEx, sets: e.target.value})} className="w-full bg-slate-900 rounded-xl p-4 text-white font-black text-center border border-slate-800 outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Repeticiones</label>
                          <input type="number" value={newEx.reps} onChange={e => setNewEx({...newEx, reps: e.target.value})} className="w-full bg-slate-900 rounded-xl p-4 text-white font-black text-center border border-slate-800 outline-none" />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button type="button" onClick={() => setEditingExercise(null)} className="flex-1 text-[10px] uppercase font-black text-slate-500 py-4 bg-slate-900 rounded-xl border border-slate-800">Cerrar</button>
                        <button type="button" onClick={saveExercise} className="flex-1 bg-emerald-600 rounded-xl font-black text-[10px] text-white py-4 shadow-lg shadow-emerald-900/40 active:scale-95 transition-transform">Guardar</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'active' && activeRoutine && (
          <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center bg-slate-900/50 p-5 rounded-[2rem] border border-slate-800 shadow-xl">
              <div>
                <h2 className="text-xl font-black uppercase italic text-emerald-500">{activeRoutine.name}</h2>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Sesión en progreso...</p>
              </div>
              <button onClick={() => window.confirm("¿Seguro que quieres salir? Perderás el progreso actual.") && setView('dash')} className="text-red-500 text-[10px] font-black uppercase bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">Salir</button>
            </div>
            {activeRoutine.exercises.map(ex => (
              <div key={ex.id} className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 overflow-hidden relative shadow-2xl">
                <div className="mb-5">
                  <h4 className="text-lg font-black uppercase italic tracking-tight">{ex.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">{ex.weight}KG</span>
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">OBJ: {ex.reps} REPS</span>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                  {[...Array(ex.sets)].map((_, i) => {
                    const val = sessionProgress[ex.id]?.[i];
                    return (
                      <button 
                        key={i} 
                        onClick={() => setEditingSet({ exId: ex.id, setIndex: i, reps: val || ex.reps })}
                        className={`min-w-[60px] h-14 rounded-2xl border-2 flex flex-col items-center justify-center font-black transition-all active:scale-90 ${
                          val !== null ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-900/30 scale-105' : 'bg-slate-800 border-slate-700 text-slate-600'
                        }`}
                      >
                        <span className="text-[8px] opacity-60">S{i+1}</span>
                        <span className="text-lg mt-0.5">{val ?? '-'}</span>
                      </button>
                    );
                  })}
                </div>
                {editingSet?.exId === ex.id && (
                  <div className="mt-4 p-5 bg-slate-950 rounded-3xl border border-emerald-500/30 animate-in slide-in-from-top-4 duration-300 shadow-inner">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center mb-4">Ingresa repeticiones logradas</p>
                    <div className="flex items-center justify-center gap-8 mb-6">
                      <button onClick={() => setEditingSet({...editingSet, reps: Math.max(0, editingSet.reps - 1)})} className="w-14 h-14 rounded-full border border-slate-800 bg-slate-900 text-2xl font-bold active:bg-slate-800 flex items-center justify-center shadow-md">-</button>
                      <div className="text-5xl font-black italic text-emerald-400 tabular-nums drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{editingSet.reps}</div>
                      <button onClick={() => setEditingSet({...editingSet, reps: editingSet.reps + 1})} className="w-14 h-14 rounded-full border border-slate-800 bg-slate-900 text-2xl font-bold active:bg-slate-800 flex items-center justify-center shadow-md">+</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <button onClick={() => updateSetProgress(ex.id, editingSet.setIndex, null)} className="py-4 rounded-xl bg-slate-900 text-slate-500 font-black text-[10px] uppercase border border-slate-800">Limpiar</button>
                       <button onClick={() => updateSetProgress(ex.id, editingSet.setIndex, editingSet.reps)} className="py-4 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase shadow-lg shadow-emerald-900/30">Confirmar</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <button onClick={finishWorkout} className="w-full bg-emerald-600 py-6 rounded-[2.5rem] font-black uppercase text-lg text-white shadow-2xl shadow-emerald-900/50 sticky bottom-4 transform active:scale-[0.97] transition-all border-t border-emerald-400/30">
              TERMINAR ENTRENAMIENTO 🚀
            </button>
          </div>
        )}

        {view === 'history' && (
          <div className="space-y-4 animate-in fade-in duration-500">
             <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-black uppercase italic tracking-tight">Registro de Ganancias</h2>
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total: {logs.length} sesiones</div>
             </div>
             {logs.length === 0 ? (
               <div className="text-center py-24 border-2 border-dashed border-slate-800 rounded-[3rem] text-slate-600 italic uppercase font-black text-xs">Aún no hay sudor registrado en la nube</div>
             ) : (
               logs.map(log => (
                <div key={log.id} className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-xl relative group overflow-hidden">
                  <div className="flex justify-between mb-4 items-center relative z-10">
                    <div>
                      <span className="text-emerald-400 font-black text-xs uppercase italic block tracking-tight">{log.routineName}</span>
                      <span className="text-slate-500 text-[9px] font-black tracking-widest uppercase mt-0.5 block">{log.date}</span>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => { 
                          e.stopPropagation(); 
                          if (confirmDeleteId === log.id) {
                              executeDelete('log', log.id);
                          } else {
                              setConfirmDeleteId(log.id);
                          }
                      }} 
                      className={`h-11 flex items-center justify-center transition-all rounded-2xl border active:scale-95 shadow-xl ${
                          confirmDeleteId === log.id 
                          ? 'bg-red-600 border-red-400 text-white w-auto px-5 animate-pulse' 
                          : 'bg-slate-950 border-red-500/10 text-red-500/60 w-11'
                      }`}
                    >
                      {confirmDeleteId === log.id ? <span className="text-[10px] font-black tracking-widest uppercase">¿BORRAR?</span> : <TrashIcon />}
                    </button>
                  </div>
                  <div className="space-y-2 relative z-10">
                    {log.exercises.map((e, i) => (
                      <div key={i} className="flex justify-between text-[11px] text-slate-400 border-b border-slate-800/30 pb-2 last:border-0 items-center">
                        <span className="font-bold text-slate-300 uppercase italic tracking-tight">{e.name}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-500 uppercase font-black">{e.weight}KG</span>
                            <span className="font-mono bg-slate-950 px-2 py-0.5 rounded text-emerald-400 border border-emerald-500/20">{e.totalReps}r</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
             )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-slate-900 p-4 flex justify-around items-center z-50 backdrop-blur-xl">
        <NavButton active={view === 'dash'} onClick={() => setView('dash')} label="Dash" icon={<DashIcon />} />
        <NavButton active={view === 'routines'} onClick={() => setView('routines')} label="Rutinas" icon={<RoutineIcon />} />
        <NavButton active={view === 'history'} onClick={() => setView('history')} label="Logs" icon={<HistoryIcon />} />
        <button type="button" onClick={handleLogout} className="flex flex-col items-center gap-1 text-slate-600 hover:text-red-500 transition-colors">
          <SettingsIcon />
          <span className="text-[9px] font-black uppercase tracking-widest">Salir</span>
        </button>
      </nav>
    </div>
  );
};

const NavButton = ({ active, onClick, label, icon }: any) => (
  <button type="button" onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-emerald-500 scale-110' : 'text-slate-500'}`}>
    {icon}
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const TrashIcon = () => <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="pointer-events-none"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
const EditIcon = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="pointer-events-none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const DashIcon = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="pointer-events-none"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>;
const RoutineIcon = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="pointer-events-none"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
const HistoryIcon = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="pointer-events-none"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>;
const SettingsIcon = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="pointer-events-none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
const PlayIcon = () => <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" className="pointer-events-none"><path d="M8 5v14l11-7z"/></svg>;

export default App;
