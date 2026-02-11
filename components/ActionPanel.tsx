
import React from 'react';
import { User } from '../types';

interface ActionPanelProps {
  users: User[];
  onLogAttendance: (userId: string) => void;
  isProcessing: boolean;
}

const ActionPanel: React.FC<ActionPanelProps> = ({ users, onLogAttendance, isProcessing }) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {users.map((user) => (
        <button
          key={user.id}
          disabled={isProcessing}
          onClick={() => onLogAttendance(user.id)}
          className="group relative bg-slate-800 border border-slate-700/50 p-4 rounded-[1.5rem] flex flex-col items-center gap-3 active:scale-95 transition-all shadow-lg hover:bg-slate-750 disabled:opacity-50"
        >
          <div className="relative">
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-14 h-14 rounded-full border-2 border-slate-700 group-hover:border-emerald-500 transition-colors" 
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-slate-800 scale-0 group-hover:scale-100 transition-transform duration-200">
              <span className="text-[10px] text-white">🏋️</span>
            </div>
          </div>
          <span className="font-black text-slate-200 text-xs tracking-tight">{user.name.toUpperCase()}</span>
          <div className="w-full bg-emerald-600/90 text-white text-[10px] font-black py-2 rounded-xl shadow-lg shadow-emerald-900/20 group-active:bg-emerald-500 uppercase tracking-widest">
            Log Check-in
          </div>
        </button>
      ))}
    </div>
  );
};

export default ActionPanel;
