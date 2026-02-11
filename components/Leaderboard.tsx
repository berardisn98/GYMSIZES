
import React from 'react';
import { UserStats } from '../types';
import { WEEKLY_GOAL } from '../constants';

interface LeaderboardProps {
  stats: UserStats[];
}

const Leaderboard: React.FC<LeaderboardProps> = ({ stats }) => {
  const sortedStats = [...stats].sort((a, b) => b.totalAttendance - a.totalAttendance);
  const maxPts = Math.max(...stats.map(s => s.totalAttendance), 1);

  return (
    <div className="bg-slate-800 rounded-3xl p-5 shadow-2xl border border-slate-700/50">
      <h2 className="text-lg font-black mb-6 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-yellow-400">🔥</span> RANKING GLOBAL
        </span>
        <span className="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-400 uppercase tracking-widest">
          Asistencias + Bonos
        </span>
      </h2>
      <div className="space-y-5">
        {sortedStats.map((user, index) => (
          <div key={user.id} className="relative group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
                  index === 0 ? 'bg-yellow-500 border-yellow-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}>
                  {index + 1}
                </div>
                <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full border-2 border-slate-700 bg-slate-900" />
                <div>
                  <div className="font-bold text-slate-100 text-sm flex items-center gap-1">
                    {user.name}
                    {user.hasReachedWeeklyGoal && <span title="Meta semanal cumplida" className="text-xs">✅</span>}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[...Array(WEEKLY_GOAL)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-2.5 h-1 rounded-full ${i < user.weeklyCount ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}
                      />
                    ))}
                    <span className="text-[9px] text-slate-500 ml-1 font-bold uppercase">Meta</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-emerald-400 tabular-nums">
                  {user.totalAttendance}
                </div>
                {user.bonusPoints > 0 && (
                  <div className="text-[9px] text-yellow-500 font-bold">
                    +{user.bonusPoints} BONO
                  </div>
                )}
              </div>
            </div>
            <div className="w-full bg-slate-900/50 rounded-full h-1.5 overflow-hidden border border-slate-700/30">
              <div 
                className={`h-full transition-all duration-1000 ease-out rounded-full ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-400 to-emerald-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${(user.totalAttendance / maxPts) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
