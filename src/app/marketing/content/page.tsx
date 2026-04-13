'use client';

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface PainContent {
  pain: string;
  pain_label: string;
  count: number;
  instagram: string;
  whatsapp: string;
  faq_q: string;
  faq_a: string;
  reels: string;
}

interface ContentData {
  stats: {
    total_clients: number;
    total_deals: number;
    completed: number;
    top_city: string;
  };
  content_by_pain: PainContent[];
  general_content: {
    instagram: string;
    whatsapp: string;
    faq_q: string;
    faq_a: string;
    reels: string;
  };
  tips: string[];
  weekly_plan: { day: string; type: string; topic: string }[];
}

const TABS = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { id: 'faq', label: 'FAQ', icon: '❓' },
  { id: 'reels', label: 'Reels', icon: '🎬' },
  { id: 'plan', label: 'Контент-план', icon: '📅' },
  { id: 'tips', label: 'Советы', icon: '💡' },
];

const TIP_ICONS = ['🕐', '📷', '🎥', '🔢', '📱', '💬', '📍', '🤝'];

const DAY_COLORS: Record<string, string> = {
  'Понедельник': 'bg-blue-50 border-blue-200',
  'Вторник': 'bg-purple-50 border-purple-200',
  'Среда': 'bg-green-50 border-green-200',
  'Четверг': 'bg-yellow-50 border-yellow-200',
  'Пятница': 'bg-orange-50 border-orange-200',
  'Суббота': 'bg-pink-50 border-pink-200',
  'Воскресенье': 'bg-gray-50 border-gray-200',
};

const TYPE_BADGES: Record<string, string> = {
  'Пост': 'bg-blue-100 text-blue-700',
  'Сторис': 'bg-purple-100 text-purple-700',
  'Reels': 'bg-green-100 text-green-700',
  'Отдых': 'bg-gray-100 text-gray-700',
};

export default function MarketingContentPage() {
  const [data, setData] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('instagram');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/marketing/content')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-900 text-sm">Загрузка контента...</div>
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-900 text-sm">Ошибка загрузки данных</div>
        </div>
      </Layout>
    );
  }

  const allContent = [
    ...data.content_by_pain,
    {
      pain: '_general',
      pain_label: 'Общий контент',
      count: data.stats.total_clients,
      ...data.general_content,
    },
  ];

  function renderContentCard(item: PainContent & { instagram: string; whatsapp: string; faq_q: string; faq_a: string; reels: string }, field: 'instagram' | 'whatsapp' | 'reels', idx: number) {
    const text = item[field];
    const copyId = `${field}-${idx}`;
    return (
      <div key={copyId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{item.pain_label}</span>
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
              {item.count} клиентов
            </span>
          </div>
          <button
            onClick={() => copyToClipboard(text, copyId)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              copiedId === copyId
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {copiedId === copyId ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Скопировано!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Скопировать
              </>
            )}
          </button>
        </div>
        <div className="p-5">
          <pre className="whitespace-pre-wrap text-sm text-gray-900 font-sans leading-relaxed bg-gray-50 rounded-lg p-4 border border-gray-100">
            {text}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Генератор контента</h1>
            <p className="text-sm text-gray-900 mt-1">Контент на основе данных CRM</p>
          </div>
          <Link
            href="/marketing/wiki"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <span>📖</span>
            Wiki Маркетинг
          </Link>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="text-xs font-medium text-gray-900 uppercase tracking-wide">Клиентов</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{data.stats.total_clients}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="text-xs font-medium text-gray-900 uppercase tracking-wide">Сделок</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{data.stats.total_deals}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="text-xs font-medium text-gray-900 uppercase tracking-wide">Завершено</div>
            <div className="text-2xl font-bold text-green-700 mt-1">{data.stats.completed}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="text-xs font-medium text-gray-900 uppercase tracking-wide">Топ город</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">{data.stats.top_city}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-gray-900 hover:text-blue-700 hover:bg-gray-50'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Instagram Tab */}
            {activeTab === 'instagram' && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📸</span>
                  <h2 className="text-lg font-semibold text-gray-900">Посты для Instagram</h2>
                </div>
                <p className="text-sm text-gray-900 mb-4">
                  Готовые тексты постов на основе болей ваших клиентов. Скопируйте и опубликуйте.
                </p>
                {allContent.map((item, idx) => renderContentCard(item, 'instagram', idx))}
              </div>
            )}

            {/* WhatsApp Tab */}
            {activeTab === 'whatsapp' && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">💬</span>
                  <h2 className="text-lg font-semibold text-gray-900">Шаблоны для WhatsApp</h2>
                </div>
                <p className="text-sm text-gray-900 mb-4">
                  Сообщения для рассылки и первого контакта с клиентами.
                </p>
                {allContent.map((item, idx) => renderContentCard(item, 'whatsapp', idx))}
              </div>
            )}

            {/* FAQ Tab */}
            {activeTab === 'faq' && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">❓</span>
                  <h2 className="text-lg font-semibold text-gray-900">FAQ вопросы и ответы</h2>
                </div>
                <p className="text-sm text-gray-900 mb-4">
                  Используйте для сайта, соцсетей или обучения менеджеров.
                </p>
                {allContent.map((item, idx) => {
                  const copyId = `faq-${idx}`;
                  const fullText = `Вопрос: ${item.faq_q}\n\nОтвет: ${item.faq_a}`;
                  return (
                    <div key={copyId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{item.pain_label}</span>
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                            {item.count} клиентов
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(fullText, copyId)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                            copiedId === copyId
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {copiedId === copyId ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Скопировано!
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Скопировать
                            </>
                          )}
                        </button>
                      </div>
                      <div className="p-5 space-y-3">
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                          <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Вопрос</div>
                          <p className="text-sm font-medium text-gray-900">{item.faq_q}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Ответ</div>
                          <p className="text-sm text-gray-900 leading-relaxed">{item.faq_a}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reels Tab */}
            {activeTab === 'reels' && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🎬</span>
                  <h2 className="text-lg font-semibold text-gray-900">Идеи для Reels и Stories</h2>
                </div>
                <p className="text-sm text-gray-900 mb-4">
                  Короткие видео-концепции для Instagram Reels и Stories.
                </p>
                {allContent.map((item, idx) => renderContentCard(item, 'reels', idx))}
              </div>
            )}

            {/* Content Plan Tab */}
            {activeTab === 'plan' && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📅</span>
                  <h2 className="text-lg font-semibold text-gray-900">Контент-план на неделю</h2>
                </div>
                <p className="text-sm text-gray-900 mb-4">
                  Рекомендованный план публикаций на каждый день недели.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {data.weekly_plan.map((item, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-4 ${DAY_COLORS[item.day] || 'bg-gray-50 border-gray-200'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-900">{item.day}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${TYPE_BADGES[item.type] || 'bg-gray-100 text-gray-700'}`}>
                          {item.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 leading-relaxed">{item.topic}</p>
                    </div>
                  ))}
                </div>

                {/* Weekly plan as table */}
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-4 py-3 text-gray-900 font-semibold rounded-tl-lg">День</th>
                        <th className="text-left px-4 py-3 text-gray-900 font-semibold">Тип</th>
                        <th className="text-left px-4 py-3 text-gray-900 font-semibold rounded-tr-lg">Тема</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.weekly_plan.map((item, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="px-4 py-3 text-gray-900 font-medium">{item.day}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${TYPE_BADGES[item.type] || 'bg-gray-100 text-gray-700'}`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-900">{item.topic}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tips Tab */}
            {activeTab === 'tips' && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">💡</span>
                  <h2 className="text-lg font-semibold text-gray-900">Советы по маркетингу</h2>
                </div>
                <p className="text-sm text-gray-900 mb-4">
                  Рекомендации для повышения эффективности контента.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.tips.map((tip, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4"
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">{TIP_ICONS[idx] || '💡'}</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-900 leading-relaxed font-medium">{tip}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Additional section with pain-based insights */}
                {data.content_by_pain.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Инсайты из CRM</h3>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5 space-y-3">
                      <p className="text-sm text-gray-900">
                        Топ боли ваших клиентов:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {data.content_by_pain.map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white rounded-full border border-blue-200 text-gray-900"
                          >
                            {item.pain_label}
                            <span className="text-xs font-semibold text-blue-700">({item.count})</span>
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-gray-900 mt-2">
                        Делайте акцент на этих темах в контенте — они резонируют с вашей аудиторией.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
