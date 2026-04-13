'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Layout from '@/components/Layout';
import StatusBadge from '@/components/StatusBadge';
import {
  Order,
  OrderHistory,
  OrderStatus,
  ORDER_STATUS_LABELS,
  PRODUCT_TYPE_LABELS,
  LEAD_SOURCE_LABELS,
  LOSS_REASON_LABELS,
  PAIN_CATEGORIES,
  LeadSource,
} from '@/types';

interface ClientComment {
  id: number;
  client_id: number;
  user_id: number | null;
  user_name: string;
  text: string;
  created_at: string;
}

interface OrderWithHistory extends Order {
  history: OrderHistory[];
  items_json?: string;
  heating_type?: string;
  required_power?: number;
  multifunctional_glass?: string;
  glass_color?: string;
  room_type?: string;
  room_area?: number;
  total_area?: number;
  object_city?: string;
  lead_id?: number;
  client_phone?: string;
  client_city?: string;
  client_source?: LeadSource;
  next_action_date?: string | null;
  next_action_text?: string | null;
  client_pain?: string;
}

interface DealFile {
  id: number;
  order_id: number;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_by: number | null;
  uploaded_by_name: string;
  created_at: string;
}

type TimelineItem = {
  id: string;
  type: 'history' | 'comment';
  date: string;
  user_name: string;
  text: string;
  status?: OrderStatus;
};

const PIPELINE_STAGES: { key: OrderStatus; short: string }[] = [
  { key: 'new', short: 'Новый' },
  { key: 'contacted', short: 'Связь' },
  { key: 'measurement', short: 'Замер' },
  { key: 'sent_to_factory', short: 'На ЗАВОД' },
  { key: 'calculation', short: 'КП' },
  { key: 'approved', short: 'Согласов.' },
  { key: 'paid', short: 'Оплачен' },
  { key: 'factory', short: 'Завод' },
  { key: 'delivery', short: 'Доставка' },
  { key: 'installation', short: 'Монтаж' },
  { key: 'completed', short: 'Готово' },
];

function getStageIndex(status: OrderStatus): number {
  const idx = PIPELINE_STAGES.findIndex((s) => s.key === status);
  return idx === -1 ? -1 : idx;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function avatarLetter(name: string): string {
  return (name || '?').charAt(0).toUpperCase();
}

const MANAGER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function getManagerColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return MANAGER_COLORS[Math.abs(hash) % MANAGER_COLORS.length];
}

function whatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}`;
}

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();

  const [order, setOrder] = useState<OrderWithHistory | null>(null);
  const [comments, setComments] = useState<ClientComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'activity' | 'calculation' | 'chat'>('activity');

  // Status change
  const [newStatus, setNewStatus] = useState<OrderStatus>('new');
  const [statusComment, setStatusComment] = useState('');
  const [factoryOrderNumber, setFactoryOrderNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [lossReasonOther, setLossReasonOther] = useState('');

  // New comment
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  // Next action / reminder
  const [nextActionDate, setNextActionDate] = useState('');
  const [nextActionText, setNextActionText] = useState('');
  const [savingAction, setSavingAction] = useState(false);

  // Files
  const [files, setFiles] = useState<DealFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Pain points
  const [selectedPains, setSelectedPains] = useState<string[]>([]);
  const [painText, setPainText] = useState('');
  const [savingPain, setSavingPain] = useState(false);
  const [showPainDropdown, setShowPainDropdown] = useState(false);

  // Chat messages
  const [chatMessages, setChatMessages] = useState<{ id: number; order_id: number; client_id: number | null; sender: string; sender_name: string; message: string; created_at: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteSenderName, setPasteSenderName] = useState('');
  const [pastingChat, setPastingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // @mention autocomplete state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [teamMembers, setTeamMembers] = useState<{id: number, name: string, role: string}[]>([]);

  // Fetch team on mount
  useEffect(() => {
    fetch('/api/staff?period=all').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setTeamMembers(data.map((s: Record<string, unknown>) => ({ id: Number(s.id), name: String(s.name), role: String(s.role) })));
    }).catch(() => {});
  }, []);

  // Comment input change handler with @mention detection
  function handleCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setCommentText(val);

    const lastAtPos = val.lastIndexOf('@');
    if (lastAtPos >= 0) {
      const afterAt = val.substring(lastAtPos + 1);
      if (!afterAt.includes(' ') && afterAt.length <= 20) {
        setMentionFilter(afterAt.toLowerCase());
        setShowMentionDropdown(true);
        return;
      }
    }
    setShowMentionDropdown(false);
  }

  // Insert mention into comment text
  function insertMention(name: string) {
    const lastAtPos = commentText.lastIndexOf('@');
    const before = commentText.substring(0, lastAtPos);
    setCommentText(before + '@' + name + ' ');
    setShowMentionDropdown(false);
  }

  // Render comment text with highlighted @mentions
  function renderCommentText(text: string) {
    const parts = text.split(/(@\S+)/g);
    return parts.map((part, i) =>
      part.startsWith('@')
        ? <span key={i} className="text-blue-600 font-medium">{part}</span>
        : <span key={i}>{part}</span>
    );
  }

  const fetchData = async () => {
    try {
      const orderRes = await fetch(`/api/orders/${id}`);
      if (!orderRes.ok) {
        setOrder(null);
        setLoading(false);
        return;
      }
      const orderData: OrderWithHistory = await orderRes.json();
      setOrder(orderData);
      setNewStatus(orderData.status);
      setFactoryOrderNumber(orderData.factory_order_number || '');
      setNextActionDate(orderData.next_action_date ? orderData.next_action_date.split('T')[0] : '');
      setNextActionText(orderData.next_action_text || '');
      setSelectedPains(orderData.client_pain ? orderData.client_pain.split(',').filter(Boolean) : []);
      setPainText('');

      if (orderData.client_id) {
        const commentsRes = await fetch(`/api/clients/${orderData.client_id}/comments`);
        if (commentsRes.ok) {
          const commentsData: ClientComment[] = await commentsRes.json();
          setComments(commentsData);
        }
      }

      // Fetch files
      const filesRes = await fetch(`/api/orders/${id}/files`);
      if (filesRes.ok) {
        const filesData: DealFile[] = await filesRes.json();
        setFiles(filesData);
      }

      // Fetch chat messages
      const msgsRes = await fetch(`/api/orders/${id}/messages`);
      if (msgsRes.ok) {
        const msgsData = await msgsRes.json();
        setChatMessages(msgsData);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handlePipelineClick = async (targetStatus: OrderStatus) => {
    if (!order || targetStatus === order.status) return;
    if (targetStatus === 'cancelled') return;
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus, comment: `Статус изменён на "${ORDER_STATUS_LABELS[targetStatus]}"` }),
      });
      if (res.ok) fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newStatus === 'cancelled') {
      setShowLossModal(true);
      return;
    }
    await submitStatusChange();
  };

  const submitStatusChange = async (extraFields?: Record<string, string>) => {
    setSaving(true);
    try {
      const body: Record<string, string> = { status: newStatus, comment: statusComment, ...extraFields };
      if (newStatus === 'factory' && factoryOrderNumber) {
        body.factory_order_number = factoryOrderNumber;
      }
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setStatusComment('');
        setShowLossModal(false);
        setLossReason('');
        setLossReasonOther('');
        fetchData();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLossReasonSubmit = () => {
    if (!lossReason) return;
    const reason = lossReason === 'other' ? (lossReasonOther || 'Другое') : lossReason;
    submitStatusChange({ loss_reason: reason });
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !order) return;
    setSendingComment(true);
    try {
      const res = await fetch(`/api/clients/${order.client_id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: (session?.user as Record<string, unknown>)?.id || null,
          user_name: session?.user?.name || '',
          text: commentText.trim(),
        }),
      });
      if (res.ok) {
        setCommentText('');
        fetchData();
      }
    } finally {
      setSendingComment(false);
    }
  };

  const handleSaveNextAction = async () => {
    if (!order) return;
    setSavingAction(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          next_action_date: nextActionDate || null,
          next_action_text: nextActionText,
        }),
      });
      if (res.ok) fetchData();
    } finally {
      setSavingAction(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !order) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Файл слишком большой (макс. 2МБ)');
      return;
    }
    setUploadingFile(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await fetch(`/api/orders/${id}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_name: file.name,
            file_data: base64,
            file_type: file.type,
            uploaded_by: (session?.user as Record<string, unknown>)?.id || null,
            uploaded_by_name: session?.user?.name || '',
          }),
        });
        if (res.ok) fetchData();
        setUploadingFile(false);
      };
      reader.onerror = () => setUploadingFile(false);
      reader.readAsDataURL(file);
    } catch {
      setUploadingFile(false);
    }
    e.target.value = '';
  };

  const handleSavePain = async () => {
    if (!order) return;
    setSavingPain(true);
    try {
      const painValue = selectedPains.join(',');
      await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_pain: painValue }),
      });
      // Also record each pain in pain_points table
      for (const cat of selectedPains) {
        await fetch('/api/wiki/pains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: order.id,
            client_id: order.client_id,
            pain_category: cat,
            pain_text: painText,
            city: order.client_city || '',
            room_type: order.room_type || '',
            source: order.client_source || '',
          }),
        });
      }
      fetchData();
    } finally {
      setSavingPain(false);
    }
  };

  const togglePain = (key: string) => {
    setSelectedPains((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  // Chat handlers
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !order) return;
    setSendingChat(true);
    try {
      const res = await fetch(`/api/orders/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'manager',
          sender_name: session?.user?.name || 'Менеджер',
          message: chatInput.trim(),
        }),
      });
      if (res.ok) {
        const msgs = await res.json();
        setChatMessages(msgs);
        setChatInput('');
      }
    } finally {
      setSendingChat(false);
    }
  };

  const handlePasteChat = async () => {
    if (!pasteText.trim() || !order) return;
    setPastingChat(true);
    try {
      const res = await fetch(`/api/orders/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_text: pasteText,
          sender_name: pasteSenderName || session?.user?.name || '',
        }),
      });
      if (res.ok) {
        const msgs = await res.json();
        setChatMessages(msgs);
        setPasteText('');
        setPasteSenderName('');
        setShowPasteModal(false);
      }
    } finally {
      setPastingChat(false);
    }
  };

  // Scroll chat to bottom when messages change
  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  // Build combined timeline
  const buildTimeline = (): TimelineItem[] => {
    if (!order) return [];
    const items: TimelineItem[] = [];

    (order.history || []).forEach((h) => {
      items.push({
        id: `h-${h.id}`,
        type: 'history',
        date: h.created_at,
        user_name: h.user_name || 'Система',
        text: h.comment || `Статус: ${ORDER_STATUS_LABELS[h.status] || h.status}`,
        status: h.status,
      });
    });

    comments.forEach((c) => {
      items.push({
        id: `c-${c.id}`,
        type: 'comment',
        date: c.created_at,
        user_name: c.user_name || 'Пользователь',
        text: c.text,
      });
    });

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  };

  // Parse items_json for calculation tab
  const parseItems = (): Record<string, unknown>[] => {
    if (!order?.items_json) return [];
    try {
      const parsed = JSON.parse(order.items_json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400 text-sm">Загрузка...</div>
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400 text-sm">Сделка не найдена</div>
        </div>
      </Layout>
    );
  }

  const currentStageIdx = getStageIndex(order.status);
  const isCancelled = order.status === 'cancelled';
  const timeline = buildTimeline();
  const calcItems = parseItems();
  const hasCalculation = calcItems.length > 0 || order.heating_type || order.room_type;

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-6 animate-fadeIn">
          <button
            onClick={() => router.push('/deals')}
            className="text-sm text-gray-500 hover:text-blue-600 transition mb-3 inline-flex items-center gap-1"
          >
            <span>&larr;</span> Сделки
          </button>
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-3xl font-extrabold text-gray-900">
              {order.client_name || 'Клиент'}
            </h1>
            <span className="text-sm text-gray-400 font-medium">#{order.id}</span>
            <StatusBadge status={order.status} />
            <span className={`text-2xl font-bold ml-auto ${order.status === 'paid' || order.status === 'completed' ? 'text-green-600' : 'text-gray-900'}`}>
              {Number(order.amount).toLocaleString('ru-RU')} &#8376;
            </span>
          </div>
        </div>

        {/* Pipeline bar */}
        {!isCancelled && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <div className="flex items-center gap-1 overflow-x-auto">
              {PIPELINE_STAGES.map((stage, idx) => {
                const isActive = idx === currentStageIdx;
                const isPast = idx < currentStageIdx;
                const isFuture = idx > currentStageIdx;
                return (
                  <div key={stage.key} className="flex items-center flex-shrink-0">
                    <button
                      onClick={() => handlePipelineClick(stage.key)}
                      disabled={saving}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap
                        ${isActive ? 'bg-blue-600 text-white shadow-sm' : ''}
                        ${isPast ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}
                        ${isFuture ? 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600' : ''}
                        ${isActive ? '' : 'cursor-pointer'}
                        disabled:opacity-50
                      `}
                      title={ORDER_STATUS_LABELS[stage.key]}
                    >
                      {stage.short}
                    </button>
                    {idx < PIPELINE_STAGES.length - 1 && (
                      <div className={`w-4 h-0.5 mx-0.5 ${isPast ? 'bg-green-300' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cancelled banner */}
        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-red-600 font-medium text-sm">Сделка потеряна</span>
              {order.loss_reason && (
                <span className="text-red-500 text-sm">
                  &mdash; {LOSS_REASON_LABELS[order.loss_reason] || order.loss_reason}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="border-b border-gray-100">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('activity')}
                    className={`px-6 py-3 text-sm font-medium transition border-b-2 ${
                      activeTab === 'activity'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Активность
                  </button>
                  <button
                    onClick={() => setActiveTab('calculation')}
                    className={`px-6 py-3 text-sm font-medium transition border-b-2 ${
                      activeTab === 'calculation'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Заявка на расчёт
                  </button>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-6 py-3 text-sm font-medium transition border-b-2 ${
                      activeTab === 'chat'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Чат
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Activity tab */}
                {activeTab === 'activity' && (
                  <div>
                    {/* Comment input */}
                    <div className="flex gap-3 mb-6">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                        {avatarLetter(session?.user?.name || '')}
                      </div>
                      <div className="flex-1">
                        <div className="relative">
                          <textarea
                            value={commentText}
                            onChange={handleCommentChange}
                            placeholder="Написать комментарий... Используйте @ для упоминания"
                            rows={2}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder:text-gray-400"
                          />
                          {showMentionDropdown && (
                            <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-64 max-h-48 overflow-y-auto">
                              {teamMembers
                                .filter(m => m.name.toLowerCase().includes(mentionFilter))
                                .map(m => (
                                  <button
                                    key={m.id}
                                    onClick={() => insertMention(m.name)}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 text-sm"
                                  >
                                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">
                                      {m.name.charAt(0)}
                                    </div>
                                    <span className="text-gray-900 font-medium">{m.name}</span>
                                    <span className="text-gray-400 text-xs">{m.role === 'admin' ? 'Админ' : m.role === 'client_manager' ? 'Клиенты' : m.role === 'order_manager' ? 'Заявки' : 'Доставка'}</span>
                                  </button>
                                ))
                              }
                              {teamMembers.filter(m => m.name.toLowerCase().includes(mentionFilter)).length === 0 && (
                                <div className="px-3 py-2 text-sm text-gray-400">Не найдено</div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={handleSendComment}
                            disabled={!commentText.trim() || sendingComment}
                            className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                          >
                            {sendingComment ? 'Отправка...' : 'Отправить'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="space-y-0">
                      {timeline.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-8">Нет активности</p>
                      ) : (
                        timeline.map((item) => (
                          <div key={item.id} className="flex gap-3 pb-4">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                                item.type === 'history'
                                  ? 'bg-gray-100 text-gray-600'
                                  : 'bg-blue-50 text-blue-600'
                              }`}
                            >
                              {avatarLetter(item.user_name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900">
                                  {item.user_name}
                                </span>
                                {item.type === 'history' && item.status && (
                                  <StatusBadge status={item.status} />
                                )}
                                <span className="text-xs text-gray-400">
                                  {formatDateTime(item.date)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-0.5">{item.type === 'comment' ? renderCommentText(item.text) : item.text}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Calculation tab */}
                {activeTab === 'calculation' && (
                  <div>
                    {hasCalculation ? (
                      <div className="space-y-6">
                        {/* Items table */}
                        {calcItems.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Позиции</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-50">
                                    <th className="text-left px-3 py-2 text-gray-500 font-medium">#</th>
                                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Ширина</th>
                                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Высота</th>
                                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Кол-во</th>
                                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Площадь</th>
                                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Нагрев</th>
                                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Камеры</th>
                                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Толщина</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {calcItems.map((item, idx) => (
                                    <tr key={idx} className="border-t border-gray-100">
                                      <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                                      <td className="px-3 py-2">{String(item.width || '-')}</td>
                                      <td className="px-3 py-2">{String(item.height || '-')}</td>
                                      <td className="px-3 py-2">{String(item.quantity || '-')}</td>
                                      <td className="px-3 py-2">{String(item.area || '-')}</td>
                                      <td className="px-3 py-2">{String(item.heating || '-')}</td>
                                      <td className="px-3 py-2">{String(item.chambers || '-')}</td>
                                      <td className="px-3 py-2">{String(item.thickness || '-')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Additional params */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">Параметры</h3>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {order.heating_type && (
                              <div>
                                <span className="text-gray-500">Тип обогрева:</span>
                                <span className="ml-2 font-medium">{order.heating_type}</span>
                              </div>
                            )}
                            {order.required_power ? (
                              <div>
                                <span className="text-gray-500">Требуемая мощность:</span>
                                <span className="ml-2 font-medium">{order.required_power} Вт/м2</span>
                              </div>
                            ) : null}
                            {order.glass_color && (
                              <div>
                                <span className="text-gray-500">Цвет стекла:</span>
                                <span className="ml-2 font-medium">{order.glass_color}</span>
                              </div>
                            )}
                            {order.multifunctional_glass && (
                              <div>
                                <span className="text-gray-500">Мультифункциональное:</span>
                                <span className="ml-2 font-medium">{order.multifunctional_glass}</span>
                              </div>
                            )}
                            {order.room_type && (
                              <div>
                                <span className="text-gray-500">Тип помещения:</span>
                                <span className="ml-2 font-medium">{order.room_type}</span>
                              </div>
                            )}
                            {order.room_area ? (
                              <div>
                                <span className="text-gray-500">Площадь помещения:</span>
                                <span className="ml-2 font-medium">{order.room_area} м2</span>
                              </div>
                            ) : null}
                            {order.total_area ? (
                              <div>
                                <span className="text-gray-500">Общая площадь остекления:</span>
                                <span className="ml-2 font-medium">{order.total_area} м2</span>
                              </div>
                            ) : null}
                            {order.object_city && (
                              <div>
                                <span className="text-gray-500">Город объекта:</span>
                                <span className="ml-2 font-medium">{order.object_city}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-400 text-sm mb-4">Заявка на расчёт ещё не заполнена</p>
                        <Link
                          href={`/orders/calculation?order_id=${order.id}&client_id=${order.client_id}&client_name=${encodeURIComponent(order.client_name || '')}&client_phone=${encodeURIComponent((order as unknown as Record<string, unknown>).client_phone as string || '')}`}
                          className="inline-flex items-center px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                        >
                          Заполнить заявку на расчёт
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat tab */}
                {activeTab === 'chat' && (
                  <div className="flex flex-col" style={{ height: '500px' }}>
                    {/* Chat header with paste button */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-900">Переписка с клиентом</span>
                      <button
                        onClick={() => setShowPasteModal(true)}
                        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition"
                      >
                        Вставить переписку WhatsApp
                      </button>
                    </div>

                    {/* Messages area */}
                    <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
                      {chatMessages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-sm text-gray-400">Нет сообщений. Отправьте сообщение или вставьте переписку WhatsApp.</p>
                        </div>
                      ) : (
                        chatMessages.map((msg) => {
                          const isManager = msg.sender === 'manager';
                          const msgTime = new Date(msg.created_at);
                          const timeStr = msgTime.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                          return (
                            <div key={msg.id} className={`flex ${isManager ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] ${isManager ? 'bg-green-100 rounded-2xl rounded-br-none' : 'bg-gray-100 rounded-2xl rounded-bl-none'} px-4 py-2`}>
                                <div className={`text-xs font-medium ${isManager ? 'text-green-700' : 'text-gray-500'}`}>
                                  {msg.sender_name || (isManager ? 'Менеджер' : 'Клиент')}
                                </div>
                                <div className="text-sm text-gray-900">{msg.message}</div>
                                <div className="text-xs text-gray-400 text-right mt-1">{timeStr}</div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Message input */}
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChatMessage(); } }}
                        placeholder="Написать сообщение..."
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                      />
                      <button
                        onClick={handleSendChatMessage}
                        disabled={!chatInput.trim() || sendingChat}
                        className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                      >
                        {sendingChat ? '...' : 'Отправить'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Reminder + Files + Pain — in left column for visibility */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Следующее действие</h3>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={nextActionDate}
                    onChange={(e) => setNextActionDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                  />
                  <input
                    type="text"
                    value={nextActionText}
                    onChange={(e) => setNextActionText(e.target.value)}
                    placeholder="Перезвонить, отправить КП..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                  />
                  <button
                    onClick={handleSaveNextAction}
                    disabled={savingAction}
                    className="w-full px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                  >
                    {savingAction ? 'Сохранение...' : 'Сохранить напоминание'}
                  </button>
                  {order.next_action_date && (
                    <div className={`text-sm font-medium mt-1 ${new Date(order.next_action_date) < new Date() ? 'text-red-600' : 'text-green-600'}`}>
                      {new Date(order.next_action_date) < new Date() ? 'Просрочено: ' : 'Запланировано: '}
                      {order.next_action_text} ({new Date(order.next_action_date).toLocaleDateString('ru-RU')})
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Файлы</h3>
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                    <a href={f.file_url} download={f.file_name} className="text-sm text-blue-600 hover:underline truncate">{f.file_name}</a>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(f.created_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                ))}
                {files.length === 0 && <p className="text-sm text-gray-400 mb-2">Нет файлов</p>}
                <label className="block mt-2">
                  <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 cursor-pointer transition">
                    {uploadingFile ? 'Загрузка...' : 'Прикрепить файл'}
                  </span>
                  <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} disabled={uploadingFile} className="hidden" />
                </label>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Боль клиента</h3>
                {/* Saved pains as tags */}
                {order.client_pain && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {order.client_pain.split(',').filter(Boolean).map((p) => (
                      <span key={p} className="inline-block px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                        {PAIN_CATEGORIES[p] || p}
                      </span>
                    ))}
                  </div>
                )}
                {/* Multi-select dropdown */}
                <div className="relative mb-2">
                  <button
                    type="button"
                    onClick={() => setShowPainDropdown(!showPainDropdown)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 text-left flex items-center justify-between"
                  >
                    <span className="truncate">
                      {selectedPains.length > 0
                        ? selectedPains.map((p) => PAIN_CATEGORIES[p] || p).join(', ')
                        : 'Выберите боли...'}
                    </span>
                    <span className="text-gray-400 ml-1">{showPainDropdown ? '\u25B2' : '\u25BC'}</span>
                  </button>
                  {showPainDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {Object.entries(PAIN_CATEGORIES).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedPains.includes(key)}
                            onChange={() => togglePain(key)}
                            className="accent-blue-600 w-4 h-4"
                          />
                          <span className="text-sm text-gray-900">{label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  value={painText}
                  onChange={(e) => setPainText(e.target.value)}
                  placeholder="Описание боли..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 mb-2"
                />
                <button
                  onClick={handleSavePain}
                  disabled={savingPain || selectedPains.length === 0}
                  className="w-full px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                >
                  {savingPain ? 'Сохранение...' : 'Сохранить боли'}
                </button>
              </div>
            </div>
          </div>

          {/* Right column - 1/3 sidebar */}
          <div className="space-y-6">
            {/* Client card */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Контакт</h3>
              <div className="space-y-3">
                <p className="text-lg font-bold text-gray-900">{order.client_name || 'Неизвестен'}</p>
                {order.client_phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{order.client_phone}</span>
                    <a
                      href={whatsappLink(order.client_phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-green-500 rounded-md hover:bg-green-600 transition"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.347 0-4.518-.808-6.233-2.163l-.435-.347-2.638.884.884-2.638-.347-.435A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                      </svg>
                      WhatsApp
                    </a>
                  </div>
                )}
                {order.client_city && (
                  <div className="text-sm text-gray-500">
                    {order.client_city}
                  </div>
                )}
                {order.client_source && (
                  <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                    {LEAD_SOURCE_LABELS[order.client_source] || order.client_source}
                  </span>
                )}
                <Link
                  href={`/clients/${order.client_id}`}
                  className="block text-sm text-blue-600 hover:underline font-medium"
                >
                  Открыть контакт &rarr;
                </Link>
              </div>
            </div>

            {/* Deal info card */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">О сделке</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Ответственный</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                      style={{ backgroundColor: getManagerColor(order.manager_name || '') }}
                    >
                      {avatarLetter(order.manager_name || '')}
                    </div>
                    <span className="font-medium text-gray-900">{order.manager_name || '\u2014'}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Создана</span>
                  <span className="text-gray-900">{formatDate(order.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Тип</span>
                  <span className="text-gray-900">{PRODUCT_TYPE_LABELS[order.product_type]}</span>
                </div>
                <div className="border-t border-gray-100 pt-3 flex justify-between">
                  <span className="text-gray-500">Сумма</span>
                  <span className="font-bold text-gray-900">{Number(order.amount).toLocaleString('ru-RU')} &#8376;</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Предоплата</span>
                  <span className="text-green-600 font-medium">{Number(order.prepayment).toLocaleString('ru-RU')} &#8376;</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Остаток</span>
                  <span className="text-orange-600 font-medium">
                    {(Number(order.amount) - Number(order.prepayment)).toLocaleString('ru-RU')} &#8376;
                  </span>
                </div>
                {order.factory_order_number && (
                  <div className="border-t border-gray-100 pt-3 flex justify-between">
                    <span className="text-gray-500">Заказ на заводе</span>
                    <span className="font-medium text-gray-900">{order.factory_order_number}</span>
                  </div>
                )}
                {order.description && (
                  <div className="border-t border-gray-100 pt-3">
                    <span className="text-gray-500 block mb-1">Описание</span>
                    <p className="text-gray-900">{order.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Removed duplicate: Next action + Files are in left column */}

            {/* Status change card */}
            {order.status !== 'completed' && order.status !== 'cancelled' && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Изменить статус</h3>
                <form onSubmit={handleStatusChange} className="space-y-3">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  {newStatus === 'factory' && (
                    <input
                      type="text"
                      value={factoryOrderNumber}
                      onChange={(e) => setFactoryOrderNumber(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Номер заказа на заводе"
                    />
                  )}
                  <textarea
                    rows={2}
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400"
                    placeholder="Комментарий..."
                  />
                  <button
                    type="submit"
                    disabled={saving || newStatus === order.status}
                    className="w-full px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                  >
                    {saving ? 'Сохранение...' : 'Изменить'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Вставить переписку WhatsApp</h2>
                <button onClick={() => setShowPasteModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">
                  &times;
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Скопируйте экспорт чата из WhatsApp и вставьте сюда. Формат: &laquo;10.04.2026, 14:30 - Имя: Сообщение&raquo;
              </p>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-900 mb-1">Имя менеджера (для определения стороны)</label>
                <input
                  type="text"
                  value={pasteSenderName}
                  onChange={(e) => setPasteSenderName(e.target.value)}
                  placeholder={session?.user?.name || 'Камилла'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                />
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Вставьте переписку здесь..."
                rows={10}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400 mb-4"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={!pasteText.trim() || pastingChat}
                  onClick={handlePasteChat}
                  className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-medium"
                >
                  {pastingChat ? 'Загрузка...' : 'Загрузить переписку'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loss Reason Modal */}
      {showLossModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Причина потери сделки</h2>
                <button onClick={() => setShowLossModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">
                  &times;
                </button>
              </div>
              <div className="space-y-3">
                {Object.entries(LOSS_REASON_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="loss_reason"
                      value={key}
                      checked={lossReason === key}
                      onChange={() => setLossReason(key)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-900">{label}</span>
                  </label>
                ))}
                {lossReason === 'other' && (
                  <input
                    type="text"
                    value={lossReasonOther}
                    onChange={(e) => setLossReasonOther(e.target.value)}
                    placeholder="Укажите причину..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  />
                )}
              </div>
              <div className="flex justify-end gap-3 pt-5">
                <button
                  type="button"
                  onClick={() => setShowLossModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={!lossReason}
                  onClick={handleLossReasonSubmit}
                  className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  Подтвердить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
