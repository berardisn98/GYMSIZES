
import React, { useState, useEffect, useMemo } from 'react';
import { Routine, WorkoutLog, Exercise, User, UserStats } from './types';
import { APP_NAME, STORAGE_KEYS, WEEKLY_GOAL } from './constants';
import { getAIPerformanceAdvice } from './services/geminiService';
import { isFirebaseActive, syncCollection, saveToCloud, deleteFromCloud } from './services/firebaseService';
import Login from './components/Login';
import Leaderboard from './components/Leaderboard';

const KG_TO_LBS = 2.20462;

interface SetProgress {
  reps: number | null;
  weight: number | null;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'dash' | 'routines' | 'active' | 'history'>('dash');
  
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]); 
  const [friends, setFriends] = useState<User[]>([]);
  
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const [sessionProgress, setSessionProgress] = useState<Record<string, (SetProgress)[]>>({});
  const [editingSet, setEditingSet] = useState<{ exId: string, setIndex: number, reps: number, kg: string, lbs: string } | null>(null);
  
  const [coachAdvice, setCoachAdvice] = useState<string>("Cargando datos...");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isAddingRoutine, setIsAddingRoutine] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [editingExercise, setEditingExercise] = useState<{routineId: string, exerciseId: string | null} | null>(null);
  const [newEx, setNewEx] = useState({ name: "", kg: "0", lbs: "0", sets: 3, reps: 10 });

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ show: false, title: "", message: "", onConfirm: () => {} });

  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (savedUser) {
      try { setCurrentUser(JSON.parse(savedUser)); } catch (e) { localStorage.removeItem(STORAGE_KEYS.SESSION); }
    }
    const localRoutines = localStorage.getItem(STORAGE_KEYS.ROUTINES);
    if (localRoutines) setRoutines(JSON.parse(localRoutines));
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
      const myRoutines = data.filter((r: any) => r.userId === currentUser.id);
      setRoutines(myRoutines);
      localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(myRoutines));
    });
    const unsubMyLogs = syncCollection('workout_logs', (data) => {
      const myLogs = data.filter((l: any) => l.userId === currentUser.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLogs(myLogs);
    });
    return () => { unsubRoutines?.(); unsubMyLogs?.(); };
  }, [currentUser]);

  useEffect(() => {
    if (logs.length > 0) getAIPerformanceAdvice(logs).then(setCoachAdvice);
  }, [logs.length]);

  const leaderboardStats = useMemo(() => {
    return friends.map(friend => {
      const friendLogs = allLogs.filter(l => l.userId === friend.id);
      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1)).toISOString().split('T')[0];
      const weeklyCount = friendLogs.filter(l => l.date >= startOfWeek).length;
      return { ...friend, totalAttendance: friendLogs.length, weeklyCount, hasReachedWeeklyGoal: weeklyCount >= WEEKLY_GOAL, bonusPoints: 0 } as UserStats;
    });
  }, [friends, allLogs]);

  const showToast = (msg: string) => { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(null), 3000); };

  const triggerConfirm = (title: string, message: string, action: () => void) => {
    setConfirmModal({ show: true, title, message, onConfirm: () => { action(); setConfirmModal(prev => ({ ...prev, show: false })); } });
  };

  const handleLogout = () => {
    triggerConfirm("CERRAR SESIÓN", "¿Estás seguro de que quieres cerrar tu sesión actual?", () => {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      setCurrentUser(null);
      setView('dash');
    });
  };

  const syncWeights = (val: string, unit: 'kg' | 'lbs', targetSetter: (kg: string, lbs: string) => void) => {
    const num = parseFloat(val) || 0;
    if (unit === 'kg') {
      targetSetter(val, val === "" ? "" : (num * KG_TO_LBS).toFixed(1));
    } else {
      targetSetter(val === "" ? "" : (num / KG_TO_LBS).toFixed(1), val);
    }
  };

  const saveRoutine = async () => {
    if (!newRoutineName.trim() || !currentUser) return;
    const routineId = Date.now().toString();
    const routineData: Routine = { id: routineId, userId: currentUser.id, name: newRoutineName, days: [], exercises: [] };
    setRoutines(prev => {
      const updated = [...prev, routineData];
      localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(updated));
      return updated;
    });
    if (isFirebaseActive()) await saveToCloud('routines', routineId, routineData);
    setNewRoutineName(""); setIsAddingRoutine(false);
    showToast("Rutina creada");
  };

  const handleDeleteRoutine = (id: string) => {
    triggerConfirm("BORRAR RUTINA", "¿Seguro que quieres eliminar esta rutina completa?", async () => {
      setRoutines(prev => {
        const filtered = prev.filter(r => r.id !== id);
        localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(filtered));
        return filtered;
      });
      if (isFirebaseActive()) await deleteFromCloud('routines', id);
      showToast("Rutina eliminada");
    });
  };

  const deleteExercise = (routineId: string, exerciseId: string) => {
    triggerConfirm("BORRAR EJERCICIO", "¿Quieres quitar este ejercicio de la rutina?", async () => {
      setRoutines(prev => {
        const updated = prev.map(r => {
          if (r.id === routineId) {
            const newExs = r.exercises.filter(ex => ex.id !== exerciseId);
            const updatedRoutine = { ...r, exercises: newExs };
            if (isFirebaseActive()) saveToCloud('routines', routineId, updatedRoutine);
            return updatedRoutine;
          }
          return r;
        });
        localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(updated));
        return updated;
      });
      showToast("Ejercicio borrado");
    });
  };

  const saveExercise = async () => {
    if (!editingExercise || !currentUser) return;
    const exerciseData: Exercise = { 
      id: editingExercise.exerciseId || `ex-${Date.now()}`, 
      name: newEx.name.trim() || "Ejercicio sin nombre", 
      weight: parseFloat(newEx.kg) || 0, 
      sets: newEx.sets, 
      reps: newEx.reps
    };
    setRoutines(prev => {
      const updated = prev.map(r => {
        if (r.id === editingExercise.routineId) {
          const newExercises = editingExercise.exerciseId 
            ? r.exercises.map(ex => ex.id === editingExercise.exerciseId ? exerciseData : ex) 
            : [...r.exercises, exerciseData];
          const updatedRoutine = { ...r, exercises: newExercises };
          if (isFirebaseActive()) saveToCloud('routines', r.id, updatedRoutine);
          return updatedRoutine;
        }
        return r;
      });
      localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(updated));
      return updated;
    });
    setEditingExercise(null);
    showToast("Ejercicio guardado");
  };

  const finishWorkout = async () => {
    if (!activeRoutine || !currentUser) return;
    const logId = Date.now().toString();
    const date = new Date().toISOString().split('T')[0];
    const sessionExercises = activeRoutine.exercises.map(ex => {
      const sets = sessionProgress[ex.id] || [];
      const completedSets = sets.filter(s => s.reps !== null && s.weight !== null);
      const totalReps = completedSets.reduce((acc, curr) => acc + (curr.reps || 0), 0);
      const maxWeight = completedSets.length > 0 ? Math.max(...completedSets.map(s => s.weight || 0)) : ex.weight;
      return { name: ex.name, weight: maxWeight, setsCompleted: completedSets.length, totalReps, wasSuccessful: completedSets.length === ex.sets };
    });
    const newLog = { id: logId, userId: currentUser.id, userName: currentUser.name, date, routineId: activeRoutine.id, routineName: activeRoutine.name, exercises: sessionExercises };
    
    setLogs(prev => [newLog, ...prev]);
    if (isFirebaseActive()) await saveToCloud('workout_logs', logId, newLog);
    showToast("¡SESIÓN FINALIZADA! 🏆");
    setView('dash');
    setActiveRoutine(null);
  };

  if (!currentUser) return <Login users={friends} onLogin={(user, keep) => { if(keep) localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user)); setCurrentUser(user); }} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 selection:bg-emerald-500/30">
      
      {/* MODAL DE CONFIRMACIÓN */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl animate-in zoom-in-95 text-center">
            <h4 className="text-xl font-black italic uppercase text-red-500 mb-2">{confirmModal.title}</h4>
            <p className="text-sm font-bold text-slate-400 mb-8 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmModal(p => ({ ...p, show: false }))} className="flex-1 py-4 bg-slate-800 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400">Cancelar</button>
              <button type="button" onClick={confirmModal.onConfirm} className="flex-1 py-4 bg-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white shadow-xl">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[800] animate-in fade-in slide-in-from-top-4">
          <div className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] shadow-2xl border border-emerald-400/30">
            ⚡ {successMessage}
          </div>
        </div>
      )}

      <header className="p-6 border-b border-slate-900 flex justify-between items-center bg-slate-950/80 sticky top-0 z-[100] backdrop-blur-md">
        <div onClick={() => setView('dash')} className="cursor-pointer">
          <h1 className="text-2xl font-black italic tracking-tighter text-emerald-500">{APP_NAME}</h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase">● {isFirebaseActive() ? 'Cloud Sync' : 'Local Mode'}</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            type="button" 
            onClick={handleLogout} 
            className="text-slate-600 hover:text-red-500 transition-colors p-2 active:scale-90"
            title="Cerrar Sesión"
          >
            <LogoutIcon />
          </button>
          <img src={currentUser.avatar} className="w-10 h-10 rounded-full border-2 border-emerald-500 bg-slate-900" />
        </div>
      </header>

      <main className="p-5 max-w-lg mx-auto">
        {view === 'dash' && (
          <div className="space-y-6">
            <Leaderboard stats={leaderboardStats} />
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl">
              <h3 className="text-[10px] font-black text-emerald-500 uppercase mb-2">● Coach IA</h3>
              <p className="text-sm font-medium italic text-slate-200">"{coachAdvice}"</p>
            </div>
            <section>
              <h2 className="text-sm font-black uppercase text-slate-500 tracking-widest mb-4">Entrenar Ahora</h2>
              {routines.map(r => (
                <button key={r.id} type="button" onClick={() => { setActiveRoutine(r); setView('active'); }} className="w-full bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 flex justify-between items-center mb-3 active:scale-95 transition-all">
                  <div className="text-left">
                    <h4 className="text-xl font-black uppercase italic">{r.name}</h4>
                    <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">{r.exercises.length} Ejercicios</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg"><PlayIcon /></div>
                </button>
              ))}
            </section>
          </div>
        )}

        {view === 'routines' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black uppercase italic">Tus Planes</h2>
              <button type="button" onClick={() => setIsAddingRoutine(true)} className="bg-emerald-600 text-[10px] font-black px-6 py-3 rounded-full shadow-lg shadow-emerald-900/30 uppercase">+ NUEVA</button>
            </div>
            
            {isAddingRoutine && (
              <div className="bg-slate-900 p-6 rounded-[2rem] border border-emerald-500/30 animate-in zoom-in-95">
                <input autoFocus value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)} placeholder="Nombre de Rutina" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white font-bold mb-4 outline-none" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsAddingRoutine(false)} className="flex-1 py-4 text-[10px] font-black text-slate-500 uppercase">Cancelar</button>
                  <button type="button" onClick={saveRoutine} className="flex-1 bg-emerald-600 rounded-2xl font-black text-[10px] text-white py-4 uppercase">Crear</button>
                </div>
              </div>
            )}

            {routines.map(r => (
              <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden mb-8 shadow-xl animate-in fade-in">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/30">
                  <h3 className="text-xl font-black uppercase italic text-emerald-400">{r.name}</h3>
                  <button type="button" onClick={() => handleDeleteRoutine(r.id)} className="text-red-500/60 p-3 bg-red-500/10 rounded-full active:scale-90 transition-all"><TrashIcon /></button>
                </div>
                
                <div className="p-6 space-y-4">
                  {r.exercises.map(ex => (
                    <div key={ex.id} className="flex justify-between items-center bg-slate-800/40 p-5 rounded-3xl border border-slate-700/20">
                      <div>
                        <div className="font-black text-sm uppercase italic text-slate-100">{ex.name}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">{ex.sets}x{ex.reps} @ <span className="text-emerald-500">{ex.weight}kg</span></div>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => { setEditingExercise({routineId: r.id, exerciseId: ex.id}); setNewEx({name: ex.name, kg: ex.weight.toString(), lbs: (ex.weight*KG_TO_LBS).toFixed(1), sets: ex.sets, reps: ex.reps}); }} className="text-emerald-500/70 p-3 hover:text-emerald-500 active:scale-90"><EditIcon /></button>
                        <button type="button" onClick={() => deleteExercise(r.id, ex.id)} className="text-red-500/40 p-3 hover:text-red-500 active:scale-90"><TrashIcon /></button>
                      </div>
                    </div>
                  ))}

                  {editingExercise?.routineId === r.id ? (
                    <div className="bg-slate-950 p-6 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl space-y-5 animate-in slide-in-from-top-4 mt-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-emerald-500 font-black italic uppercase text-[10px]">Configurar Ejercicio</h4>
                        <button type="button" onClick={() => setEditingExercise(null)} className="text-slate-600 p-2">✕</button>
                      </div>

                      <input value={newEx.name} onChange={e => setNewEx({...newEx, name: e.target.value})} placeholder="Nombre" className="w-full bg-slate-900 rounded-xl p-4 text-white text-sm font-bold border border-slate-800" />
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-900 p-3 rounded-xl text-center">
                          <label className="text-[8px] font-black text-slate-600 block mb-1">KG</label>
                          <input type="number" step="0.5" value={newEx.kg} onChange={e => syncWeights(e.target.value, 'kg', (k, l) => setNewEx(p => ({...p, kg: k, lbs: l})))} className="w-full bg-transparent text-center font-black italic text-emerald-400 outline-none" />
                        </div>
                        <div className="bg-slate-900 p-3 rounded-xl text-center">
                          <label className="text-[8px] font-black text-slate-600 block mb-1">LBS</label>
                          <input type="number" step="0.1" value={newEx.lbs} onChange={e => syncWeights(e.target.value, 'lbs', (k, l) => setNewEx(p => ({...p, kg: k, lbs: l})))} className="w-full bg-transparent text-center font-black italic text-white outline-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center bg-slate-900 rounded-xl h-12 overflow-hidden border border-slate-800">
                          <button type="button" onClick={() => setNewEx({...newEx, sets: Math.max(1, newEx.sets - 1)})} className="flex-1 text-slate-500 font-black">-</button>
                          <span className="flex-1 text-center text-[10px] font-black">{newEx.sets} S</span>
                          <button type="button" onClick={() => setNewEx({...newEx, sets: newEx.sets + 1})} className="flex-1 text-slate-500 font-black">+</button>
                        </div>
                        <div className="flex items-center bg-slate-900 rounded-xl h-12 overflow-hidden border border-slate-800">
                          <button type="button" onClick={() => setNewEx({...newEx, reps: Math.max(1, newEx.reps - 1)})} className="flex-1 text-slate-500 font-black">-</button>
                          <span className="flex-1 text-center text-[10px] font-black text-emerald-400">{newEx.reps} R</span>
                          <button type="button" onClick={() => setNewEx({...newEx, reps: newEx.reps + 1})} className="flex-1 text-slate-500 font-black">+</button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditingExercise(null)} className="flex-1 py-4 text-[9px] font-black uppercase text-slate-500">Cerrar</button>
                        <button type="button" onClick={saveExercise} className="flex-2 py-4 bg-emerald-600 rounded-xl text-white font-black text-[9px] uppercase shadow-lg">Guardar</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setEditingExercise({ routineId: r.id, exerciseId: null }); setNewEx({ name: "", kg: "0", lbs: "0", sets: 3, reps: 10 }); }} className="w-full py-6 border-2 border-dashed border-slate-800 rounded-3xl text-[10px] font-black text-slate-600 uppercase hover:border-emerald-500/40 active:scale-95 transition-all">+ AÑADIR EJERCICIO</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'active' && activeRoutine && (
          <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center bg-slate-900/80 p-6 rounded-[2.5rem] border border-slate-800 shadow-xl">
              <div>
                <h2 className="text-xl font-black uppercase italic text-emerald-500 leading-tight">{activeRoutine.name}</h2>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Sesión en progreso</p>
              </div>
              <button type="button" onClick={() => triggerConfirm("ABANDONAR", "¿Quieres salir? No se guardarán los cambios actuales.", () => setView('dash'))} className="bg-red-500/10 text-red-500 px-6 py-3 rounded-full text-[10px] font-black uppercase border border-red-500/20 active:scale-90 transition-all">SALIR</button>
            </div>

            {activeRoutine.exercises.map(ex => (
              <div key={ex.id} className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                <div className="mb-6 flex justify-between items-start">
                  <div>
                    <h4 className="text-xl font-black uppercase italic tracking-tight">{ex.name}</h4>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-emerald-500 text-[10px] font-black uppercase bg-emerald-500/10 px-2 py-1 rounded-md">{ex.weight}KG</span>
                      <span className="text-slate-500 text-[10px] font-black uppercase">{ex.reps} REPS</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                  {[...Array(ex.sets)].map((_, i) => {
                    const set = sessionProgress[ex.id]?.[i];
                    const isLogged = set?.reps !== null;
                    return (
                      <button key={i} type="button" onClick={() => setEditingSet({ exId: ex.id, setIndex: i, reps: set?.reps || ex.reps, kg: (set?.weight || ex.weight).toString(), lbs: ((set?.weight || ex.weight) * KG_TO_LBS).toFixed(1) })} className={`min-w-[75px] h-16 rounded-2xl border-2 flex flex-col items-center justify-center font-black transition-all active:scale-90 ${isLogged ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-600'}`}>
                        <span className="text-[8px] opacity-60">S{i+1}</span>
                        <span className="text-lg leading-none mt-1">{isLogged ? set?.reps : '-'}</span>
                      </button>
                    );
                  })}
                </div>

                {editingSet?.exId === ex.id && (
                  <div className="mt-4 p-6 bg-slate-950 rounded-3xl border border-emerald-500/20 space-y-6 animate-in slide-in-from-top-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-8">
                        <button type="button" onClick={() => setEditingSet({...editingSet, reps: Math.max(0, editingSet.reps - 1)})} className="w-12 h-12 rounded-full border border-slate-800 bg-slate-900 text-2xl font-black">-</button>
                        <div className="text-5xl font-black italic text-emerald-400">{editingSet.reps}</div>
                        <button type="button" onClick={() => setEditingSet({...editingSet, reps: editingSet.reps + 1})} className="w-12 h-12 rounded-full border border-slate-800 bg-slate-900 text-2xl font-black">+</button>
                      </div>
                      <p className="text-[9px] font-black text-slate-600 uppercase mt-4 tracking-widest">Repeticiones</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                       <button type="button" onClick={() => setEditingSet(null)} className="py-4 rounded-xl bg-slate-900 text-slate-500 font-black text-[10px] uppercase">Cancelar</button>
                       <button type="button" onClick={() => {
                         setSessionProgress(prev => ({...prev, [ex.id]: (prev[ex.id] || []).map((s, i) => (i === editingSet.setIndex ? { reps: editingSet.reps, weight: parseFloat(editingSet.kg) } : s))}));
                         setEditingSet(null);
                       }} className="py-4 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase shadow-lg">Confirmar</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <button type="button" onClick={finishWorkout} className="w-full bg-emerald-600 py-6 rounded-[2.5rem] font-black uppercase text-lg text-white shadow-2xl active:scale-95 transition-all">FINALIZAR SESIÓN 🏆</button>
          </div>
        )}

        {view === 'history' && (
          <div className="space-y-4">
             <h2 className="text-lg font-black uppercase italic text-center">Tus Registros</h2>
             {logs.length === 0 ? <div className="text-center py-20 text-slate-700 font-black uppercase text-xs">Sin actividad</div> : logs.map(log => (
                <div key={log.id} className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-xl mb-4">
                  <span className="text-emerald-400 font-black text-xs uppercase italic">{log.routineName}</span>
                  <p className="text-slate-600 text-[9px] font-black uppercase mb-3">{log.date}</p>
                  <div className="space-y-2">
                    {log.exercises.map((e, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] py-2 border-b border-slate-800/20 last:border-0">
                        <span className="font-bold text-slate-300 uppercase italic">{e.name}</span>
                        <div className="flex items-center gap-2"><span className="text-emerald-500 font-black">{e.weight}KG</span><span className="text-slate-500 font-black uppercase">{e.totalReps}r</span></div>
                      </div>
                    ))}
                  </div>
                </div>
             ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-slate-900 p-5 flex justify-around items-center z-[500] backdrop-blur-xl">
        <NavButton active={view === 'dash'} onClick={() => setView('dash')} label="Home" icon={<DashIcon />} />
        <NavButton active={view === 'routines'} onClick={() => setView('routines')} label="Planes" icon={<RoutineIcon />} />
        <NavButton active={view === 'history'} onClick={() => setView('history')} label="Historial" icon={<HistoryIcon />} />
      </nav>
    </div>
  );
};

const NavButton = ({ active, onClick, label, icon }: any) => (
  <button type="button" onClick={onClick} className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${active ? 'text-emerald-500' : 'text-slate-600'}`}>
    {icon}
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const LogoutIcon = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
const EditIcon = () => <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const TrashIcon = () => <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const DashIcon = () => <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>;
const RoutineIcon = () => <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
const HistoryIcon = () => <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>;
const PlayIcon = () => <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;

export default App;
