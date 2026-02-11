
import React from 'react';
import { AttendanceRecord } from '../types';

interface CalendarProps {
  records: AttendanceRecord[];
  userId: string;
}

const Calendar: React.FC<CalendarProps> = ({ records, userId }) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
  
  // Adjusted for Monday start (0=Mon, 6=Sun)
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  
  const userDates = records
    .filter(r => r.userId === userId)
    .map(r => r.date);

  const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(today);

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-3xl p-5 shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500">Mi Progreso: {monthName}</h3>
        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase">
          <WeightIcon size={12} /> = Entrenado
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
          <span key={d} className="text-[10px] font-bold text-slate-600 uppercase">{d}</span>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {[...Array(startOffset)].map((_, i) => <div key={`empty-${i}`} />)}
        {[...Array(daysInMonth)].map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isAttended = userDates.includes(dateStr);
          const isToday = day === today.getDate();

          return (
            <div 
              key={day} 
              className={`aspect-square rounded-lg flex flex-col items-center justify-center relative border transition-all ${
                isAttended 
                  ? 'bg-emerald-500/20 border-emerald-500/40' 
                  : isToday 
                    ? 'border-slate-500 bg-slate-700/50' 
                    : 'border-slate-700/30 bg-slate-900/20'
              }`}
            >
              <span className={`text-[10px] font-bold ${isAttended ? 'text-emerald-400' : 'text-slate-500'}`}>{day}</span>
              {isAttended && (
                <div className="mt-0.5 text-emerald-400 animate-in zoom-in-50">
                  <WeightIcon size={12} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WeightIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6.5 6.5 11 11M3 21l3-3M18 6l3-3M2 13l3-3M14 22l3-3M2 2l20 20M3 7l4-4M17 21l4-4" />
  </svg>
);

export default Calendar;
