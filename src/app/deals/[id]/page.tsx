'use client';

import { useState, useEffect, use } from 'react';
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
  { key: 'contacted', short: 'Связались' },
  { key: 'calculation', short: 'КП' },
  { key: 'approved', short: 'Переговоры' },
  { key: 'invoiced', short: 'Счёт' },
  { key: 'paid', short: 'Оплачен' },
  { key: 'factory', short: 'Завод' },
  { key: 'production', short: 'Произв.' },
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
  const [activeTab, setActiveTab] = useState<'activity' | 'calculation'>('activity');

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
        <div className="mb-6">
          <button
            onClick={() => router.push('/deals')}
            className="text-sm text-gray-500 hover:text-blue-600 transition mb-3 inline-flex items-center gap-1"
          >
            <span>&larr;</span> Сделки
          </button>
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
              Сделка #{order.id} &mdash; {order.client_name || 'Клиент'}
            </h1>
            <StatusBadge status={order.status} />
            <span className="text-2xl font-bold text-gray-900 ml-auto">
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
                        <textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Написать комментарий..."
                          rows={2}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder:text-gray-400"
                        />
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
                              <p className="text-sm text-gray-600 mt-0.5">{item.text}</p>
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
                <div className="flex justify-between">
                  <span className="text-gray-500">Ответственный</span>
                  <span className="font-medium text-gray-900">{order.manager_name || '\u2014'}</span>
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
