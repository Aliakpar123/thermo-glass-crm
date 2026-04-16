'use client';

import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';

interface LeaderboardEntry {
  id: number;
  name: string;
  role: string;
  points: number;
  level: string;
  levelEmoji: string;
  nextLevel: number;
  stats: {
    deals_created: number;
    deals_completed: number;
    comments: number;
    status_changes: number;
    tasks_completed: number;
  };
  achievements: { id: string; name: string; emoji: string; earned: boolean }[];
}

const ROLE_LABELS: Record<string, string> = {
  client_manager: 'Менеджер клиентов',
  order_manager: 'Менеджер заказов',
  delivery_manager: 'Менеджер доставки',
  accountant: 'Бухгалтер',
  admin: 'Администратор',
};

const MANAGER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function getManagerColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return MANAGER_COLORS[Math.abs(hash) % MANAGER_COLORS.length];
}

function AnimatedPoints({ target }: { target: number }) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setCurrent(0); return; }
    const duration = 1200;
    const start = performance.now();
    const from = 0;

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    }

    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target]);

  return <>{current}</>;
}

function ProgressBar({ current, next }: { current: number; next: number }) {
  const prevLevel =
    current >= 1000 ? 500 :
    current >= 500 ? 200 :
    current >= 200 ? 100 :
    current >= 100 ? 50 :
    current >= 50 ? 0 : 0;

  const range = next - prevLevel;
  const progress = range > 0 ? Math.min(((current - prevLevel) / range) * 100, 100) : 100;

  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div
        className="h-2 rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-1000 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  const periods: { key: 'week' | 'month' | 'all'; label: string }[] = [
    { key: 'week', label: 'Неделя' },
    { key: 'month', label: 'Месяц' },
    { key: 'all', label: 'Все время' },
  ];

  const top3 = data.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  return (
    <Layout>
      <div className="space-y-6 animate-fadeIn">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-3xl">🏆</span> Рейтинг команды
          </h1>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {periods.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  period === p.key
                    ? 'bg-[#22c55e] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-500 text-lg">Загрузка рейтинга...</div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-500 text-lg">Нет данных для отображения</div>
          </div>
        ) : (
          <>
            {/* Podium */}
            {top3.length >= 2 && (
              <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                <div className="flex items-end justify-center gap-4 sm:gap-8">
                  {podiumOrder.map((entry, idx) => {
                    if (!entry) return null;
                    const rank = data.indexOf(entry);
                    const isFirst = rank === 0;
                    const isSecond = rank === 1;
                    const heights = ['h-28', 'h-36', 'h-20'];
                    const podiumH = isFirst ? heights[1] : isSecond ? heights[0] : heights[2];
                    const medalColors = ['#C0C0C0', '#FFD700', '#CD7F32'];
                    const medalColor = isFirst ? medalColors[1] : isSecond ? medalColors[0] : medalColors[2];
                    const medals = ['🥈', '🥇', '🥉'];
                    const medal = isFirst ? medals[1] : isSecond ? medals[0] : medals[2];
                    const ringSize = isFirst ? 'w-20 h-20' : 'w-16 h-16';
                    const textSize = isFirst ? 'text-2xl' : 'text-xl';

                    return (
                      <div key={entry.id} className="flex flex-col items-center" style={{ minWidth: '100px' }}>
                        <div className="text-3xl mb-2">{medal}</div>
                        <div
                          className={`${ringSize} rounded-full flex items-center justify-center text-white font-bold ${textSize} mb-2 shadow-lg`}
                          style={{
                            backgroundColor: getManagerColor(entry.name),
                            boxShadow: `0 0 20px ${medalColor}40, 0 0 0 4px ${medalColor}`,
                          }}
                        >
                          {entry.name.charAt(0)}
                        </div>
                        <div className="text-sm font-semibold text-gray-900 text-center">{entry.name}</div>
                        <div className="text-lg font-bold text-gray-900 mt-1">
                          <AnimatedPoints target={entry.points} /> очков
                        </div>
                        <div className="text-sm text-gray-600 mt-0.5">
                          {entry.levelEmoji} {entry.level}
                        </div>
                        <div
                          className={`${podiumH} w-24 sm:w-28 mt-3 rounded-t-xl flex items-end justify-center pb-2`}
                          style={{
                            background: `linear-gradient(to top, ${medalColor}30, ${medalColor}10)`,
                            borderTop: `3px solid ${medalColor}`,
                          }}
                        >
                          <span className="text-2xl font-bold" style={{ color: medalColor }}>
                            {rank + 1}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 w-12">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500">Сотрудник</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500">Очки</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500">Уровень</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-500">Сделки</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-500">Закрыто</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-500">Комментарии</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-500">Задачи</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-500">Прогресс</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((entry, idx) => {
                      const rankMedals = ['🥇', '🥈', '🥉'];
                      const isExpanded = expandedUser === entry.id;

                      return (
                        <>
                          <tr
                            key={entry.id}
                            onClick={() => setExpandedUser(isExpanded ? null : entry.id)}
                            className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                              idx < 3 ? 'bg-yellow-50/30' : ''
                            }`}
                          >
                            <td className="px-4 py-3 font-semibold text-gray-900">
                              {idx < 3 ? rankMedals[idx] : idx + 1}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                                  style={{ backgroundColor: getManagerColor(entry.name) }}
                                >
                                  {entry.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{entry.name}</div>
                                  <div className="text-xs text-gray-400">{ROLE_LABELS[entry.role] || entry.role}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-bold text-gray-900 text-lg">
                              <AnimatedPoints target={entry.points} />
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 text-gray-900">
                                {entry.levelEmoji} {entry.level}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-900 font-medium">{entry.stats.deals_created}</td>
                            <td className="px-4 py-3 text-center text-gray-900 font-medium">{entry.stats.deals_completed}</td>
                            <td className="px-4 py-3 text-center text-gray-900 font-medium">{entry.stats.comments}</td>
                            <td className="px-4 py-3 text-center text-gray-900 font-medium">{entry.stats.tasks_completed}</td>
                            <td className="px-4 py-3 w-32">
                              <ProgressBar current={entry.points} next={entry.nextLevel} />
                              <div className="text-xs text-gray-400 mt-1 text-center">
                                {entry.points >= 1000 ? 'MAX' : `${entry.points}/${entry.nextLevel}`}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${entry.id}-details`} className="bg-gray-50/80">
                              <td colSpan={9} className="px-4 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                                  {/* Points breakdown */}
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Начисление очков</h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between text-gray-900">
                                        <span>Сделки создано</span>
                                        <span className="font-medium">{entry.stats.deals_created} x 10 = {entry.stats.deals_created * 10}</span>
                                      </div>
                                      <div className="flex justify-between text-gray-900">
                                        <span>Статусы изменены</span>
                                        <span className="font-medium">{entry.stats.status_changes} x 5 = {entry.stats.status_changes * 5}</span>
                                      </div>
                                      <div className="flex justify-between text-gray-900">
                                        <span>Сделки закрыты</span>
                                        <span className="font-medium">{entry.stats.deals_completed} x 100 = {entry.stats.deals_completed * 100}</span>
                                      </div>
                                      <div className="flex justify-between text-gray-900">
                                        <span>Комментарии</span>
                                        <span className="font-medium">{entry.stats.comments} x 3 = {entry.stats.comments * 3}</span>
                                      </div>
                                      <div className="flex justify-between text-gray-900">
                                        <span>Задачи выполнены</span>
                                        <span className="font-medium">{entry.stats.tasks_completed} x 5 = {entry.stats.tasks_completed * 5}</span>
                                      </div>
                                      <div className="border-t pt-2 flex justify-between font-bold text-gray-900">
                                        <span>Итого</span>
                                        <span>{entry.points} очков</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Achievements */}
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Достижения</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                      {entry.achievements.map((a) => (
                                        <div
                                          key={a.id}
                                          className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${
                                            a.earned
                                              ? 'bg-green-50 border-green-200 text-gray-900'
                                              : 'bg-gray-100 border-gray-200 text-gray-400'
                                          }`}
                                        >
                                          <span className={`text-lg ${a.earned ? '' : 'grayscale opacity-40'}`}>
                                            {a.emoji}
                                          </span>
                                          <span className={`font-medium ${a.earned ? '' : 'line-through'}`}>
                                            {a.name}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Points Legend */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Система очков</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-900">
                  <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold">+10</span>
                  <span>Новая сделка</span>
                </div>
                <div className="flex items-center gap-2 text-gray-900">
                  <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 font-bold">+5</span>
                  <span>Смена статуса</span>
                </div>
                <div className="flex items-center gap-2 text-gray-900">
                  <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600 font-bold">+100</span>
                  <span>Сделка закрыта</span>
                </div>
                <div className="flex items-center gap-2 text-gray-900">
                  <span className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center text-yellow-600 font-bold">+3</span>
                  <span>Комментарий</span>
                </div>
                <div className="flex items-center gap-2 text-gray-900">
                  <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-bold">+5</span>
                  <span>Задача выполнена</span>
                </div>
              </div>

              <h4 className="text-sm font-semibold text-gray-900 mt-6 mb-3">Уровни</h4>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="px-3 py-1.5 bg-gray-100 rounded-full text-gray-900">🌱 Новичок (0+)</span>
                <span className="px-3 py-1.5 bg-gray-100 rounded-full text-gray-900">💪 Активный (50+)</span>
                <span className="px-3 py-1.5 bg-gray-100 rounded-full text-gray-900">🔥 Профи (100+)</span>
                <span className="px-3 py-1.5 bg-gray-100 rounded-full text-gray-900">⭐ Эксперт (200+)</span>
                <span className="px-3 py-1.5 bg-gray-100 rounded-full text-gray-900">🏆 Мастер (500+)</span>
                <span className="px-3 py-1.5 bg-gray-100 rounded-full text-gray-900">👑 Легенда (1000+)</span>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
