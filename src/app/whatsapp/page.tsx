'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Chat {
  wa_chat_id: string;
  wa_phone: string;
  wa_profile_name: string;
  client_id: number | null;
  client_name: string | null;
  last_message: string;
  last_direction: 'in' | 'out';
  last_at: string;
  unread_count: number;
}

interface Message {
  id: number;
  direction: 'in' | 'out';
  message_type: string;
  text: string;
  media_url?: string;
  created_at: string;
  is_read: boolean;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return formatTime(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export default function WhatsAppPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchChats = useCallback(() => {
    fetch('/api/whatsapp/chats')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setChats(data);
      })
      .finally(() => setLoadingChats(false));
  }, []);

  const fetchMessages = useCallback((chatId: string) => {
    setLoadingMessages(true);
    fetch(`/api/whatsapp/messages?chat_id=${encodeURIComponent(chatId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
      })
      .finally(() => {
        setLoadingMessages(false);
        // После открытия чата — обновим список, чтобы счётчик непрочитанных обнулился
        setTimeout(fetchChats, 300);
      });
  }, [fetchChats]);

  useEffect(() => {
    fetchChats();
    const interval = setInterval(fetchChats, 15000);
    return () => clearInterval(interval);
  }, [fetchChats]);

  useEffect(() => {
    if (!activeChatId) return;
    fetchMessages(activeChatId);
    const interval = setInterval(() => fetchMessages(activeChatId), 10000);
    return () => clearInterval(interval);
  }, [activeChatId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!activeChatId || !input.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/whatsapp/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: activeChatId, text: input.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Ошибка отправки');
        return;
      }
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setInput('');
      fetchChats();
    } catch {
      setError('Сетевая ошибка');
    } finally {
      setSending(false);
    }
  };

  const activeChat = chats.find((c) => c.wa_chat_id === activeChatId);

  return (
    <Layout>
      <div className="flex h-[calc(100vh-3rem)] -m-6 bg-white rounded-xl border border-gray-100 overflow-hidden">
        {/* LEFT: chats list */}
        <div className="w-[340px] border-r border-gray-100 flex flex-col bg-gray-50">
          <div className="px-4 py-3 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💬</span>
              <div>
                <div className="text-sm font-bold text-gray-900">WhatsApp</div>
                <div className="text-[11px] text-gray-500">{chats.length} диалогов</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingChats ? (
              <div className="p-6 text-center text-sm text-gray-400">Загрузка...</div>
            ) : chats.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                Пока нет сообщений.
                <div className="mt-2 text-xs">
                  Настройте Green API webhook, и входящие появятся здесь автоматически.
                </div>
              </div>
            ) : (
              chats.map((c) => {
                const isActive = c.wa_chat_id === activeChatId;
                const displayName = c.client_name || c.wa_profile_name || c.wa_phone;
                return (
                  <button
                    key={c.wa_chat_id}
                    onClick={() => setActiveChatId(c.wa_chat_id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-white transition flex items-start gap-3 ${
                      isActive ? 'bg-white border-l-4 border-l-[#22c55e]' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white text-sm font-semibold shrink-0">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {displayName}
                        </div>
                        <div className="text-[10px] text-gray-400 shrink-0">{formatDate(c.last_at)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-500 truncate flex-1">
                          {c.last_direction === 'out' && <span className="text-gray-400">Вы: </span>}
                          {c.last_message || '—'}
                        </div>
                        {c.unread_count > 0 && (
                          <span className="bg-[#25D366] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: active chat */}
        <div className="flex-1 flex flex-col">
          {!activeChat ? (
            <div className="flex-1 flex items-center justify-center flex-col gap-4 text-gray-400">
              <div className="text-6xl">💬</div>
              <div className="text-sm">Выберите диалог слева</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 bg-white">
                <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white text-sm font-semibold">
                  {(activeChat.client_name || activeChat.wa_profile_name || activeChat.wa_phone).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900">
                    {activeChat.client_name || activeChat.wa_profile_name || activeChat.wa_phone}
                  </div>
                  <div className="text-[11px] text-gray-500">{activeChat.wa_phone}</div>
                </div>
                {activeChat.client_id && (
                  <a
                    href={`/clients/${activeChat.client_id}`}
                    className="text-xs text-[#22c55e] hover:underline font-medium"
                  >
                    Открыть клиента →
                  </a>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 bg-[#ece5dd]/40 space-y-2">
                {loadingMessages && messages.length === 0 ? (
                  <div className="text-center text-sm text-gray-400 py-10">Загрузка...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-sm text-gray-400 py-10">Нет сообщений</div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] px-3 py-2 rounded-lg shadow-sm text-sm ${
                          m.direction === 'out'
                            ? 'bg-[#dcf8c6] text-gray-900 rounded-br-none'
                            : 'bg-white text-gray-900 rounded-bl-none'
                        }`}
                      >
                        {m.media_url && (
                          <a
                            href={m.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-blue-600 hover:underline mb-1"
                          >
                            📎 Вложение
                          </a>
                        )}
                        <div className="whitespace-pre-wrap break-words">{m.text || '—'}</div>
                        <div className="text-[10px] text-gray-400 text-right mt-1">
                          {formatTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-gray-100 bg-white">
                {error && (
                  <div className="mb-2 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded">
                    {error}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Сообщение..."
                    rows={1}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] outline-none resize-none max-h-32"
                    style={{ minHeight: '40px' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    className="px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebe59] disabled:opacity-50 transition text-sm font-medium"
                  >
                    {sending ? '...' : 'Отправить'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
