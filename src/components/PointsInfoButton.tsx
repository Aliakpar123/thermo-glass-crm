'use client';

import { useState, useEffect, useRef } from 'react';

const ACTIONS = [
  { label: 'Новая сделка', points: 10, icon: '📋' },
  { label: 'Смена статуса', points: 5, icon: '🔄' },
  { label: 'Закрытие сделки', points: 100, icon: '🎯' },
  { label: 'Комментарий', points: 3, icon: '💬' },
  { label: 'Задача выполнена', points: 5, icon: '✅' },
];

const LEVELS = [
  { emoji: '🌱', name: 'Новичок', min: 0 },
  { emoji: '💪', name: 'Активный', min: 50 },
  { emoji: '🔥', name: 'Профи', min: 100 },
  { emoji: '⭐', name: 'Эксперт', min: 200 },
  { emoji: '🏆', name: 'Мастер', min: 500 },
  { emoji: '👑', name: 'Легенда', min: 1000 },
];

export default function PointsInfoButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-7 h-7 rounded-full bg-[#22c55e]/10 hover:bg-[#22c55e]/20 border border-[#22c55e]/30 text-[#22c55e] text-xs font-bold flex items-center justify-center transition-all duration-150"
        title="Как получать очки"
        aria-label="Как получать очки"
      >
        ?
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-72 bg-white dark:bg-[#1a1b1e] rounded-xl shadow-2xl z-50 border border-gray-100 dark:border-white/10 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-[#22c55e]/10 to-[#22c55e]/5 border-b border-gray-100 dark:border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>🎮</span> Как получать очки
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
              Действия
            </div>
            <div className="space-y-0.5 mb-3">
              {ACTIONS.map((a) => (
                <div
                  key={a.label}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{a.icon}</span>
                    <span className="text-[12px] text-gray-700 dark:text-gray-200">{a.label}</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded-full">
                    +{a.points}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
              Уровни
            </div>
            <div className="space-y-0.5">
              {LEVELS.map((l) => (
                <div
                  key={l.name}
                  className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{l.emoji}</span>
                    <span className="text-[12px] text-gray-700 dark:text-gray-200">{l.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                    от {l.min}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
