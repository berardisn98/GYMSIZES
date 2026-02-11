
import React, { useState } from 'react';
import { User } from '../types';
import { APP_NAME } from '../constants';
import { saveToCloud, isFirebaseActive } from '../services/firebaseService';

interface LoginProps {
  users: User[];
  onLogin: (user: User, keepSession: boolean) => void;
}

const Login: React.FC<LoginProps> = ({ users, onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return setError("Rellena todos los campos");
    setError("");
    setLoading(true);

    try {
      if (isRegistering) {
        // Registro
        const userExists = users.find(u => u.name.toLowerCase() === username.toLowerCase());
        if (userExists) throw new Error("Ese nombre ya está pillado");

        const newUser: User = {
          id: Date.now().toString(),
          name: username,
          password: password,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username + Date.now()}`
        };

        if (isFirebaseActive()) {
          await saveToCloud('users', newUser.id, newUser);
        }
        onLogin(newUser, keepLoggedIn);
      } else {
        // Login
        const user = users.find(u => 
          u.name.toLowerCase() === username.toLowerCase() && u.password === password
        );
        
        if (user) {
          onLogin(user, keepLoggedIn);
        } else {
          throw new Error("Usuario o contraseña incorrectos");
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />

      <div className="w-full max-w-sm z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-10">
          <h1 className="text-6xl font-black italic tracking-tighter text-white mb-2 leading-none">
            {APP_NAME.split(' ')[0]}
            <span className="text-emerald-500">.</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em]">
            {isRegistering ? 'Únete al escuadrón' : 'Vuelve al entrenamiento'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase p-3 rounded-xl text-center">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase ml-4 tracking-widest">Nombre de Atleta</label>
            <input 
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="p.ej. Arnold123"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase ml-4 tracking-widest">Contraseña</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
            />
          </div>

          <div className="flex items-center gap-3 py-2 px-1">
            <button 
              type="button" 
              onClick={() => setKeepLoggedIn(!keepLoggedIn)}
              className={`w-10 h-6 rounded-full transition-colors relative flex items-center ${keepLoggedIn ? 'bg-emerald-500' : 'bg-slate-800 border border-slate-700'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${keepLoggedIn ? 'right-1' : 'left-1'}`} />
            </button>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mantener sesión iniciada</span>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 py-5 rounded-2xl font-black uppercase text-xs tracking-widest text-white shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
          >
            {loading ? 'PROCESANDO...' : isRegistering ? 'CREAR MI CUENTA' : 'ENTRAR A ENTRENAR'}
          </button>
        </form>

        <div className="text-center mt-8">
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setError(""); }}
            className="text-slate-500 hover:text-emerald-400 font-black text-[11px] uppercase tracking-widest transition-colors"
          >
            {isRegistering 
              ? '¿Ya tienes cuenta? Inicia Sesión' 
              : '¿Eres nuevo? Regístrate aquí'}
          </button>
        </div>
      </div>

      <footer className="absolute bottom-10 text-[9px] font-black text-slate-700 uppercase tracking-widest">
        GymSizes Performance Cloud v2.5
      </footer>
    </div>
  );
};

export default Login;
