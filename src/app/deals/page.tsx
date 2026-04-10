'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { useSession } from 'next-auth/react';
import {
  OrderStatus,
  ORDER_STATUS_LABELS,
  PRODUCT_TYPE_LABELS,
  LOSS_REASON_LABELS,
  LeadSource,
  LEAD_SOURCE_LABELS,
} from '@/types';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Pipeline stages (single unified pipeline) ---

const PIPELINE_STAGES: OrderStatus[] = [
  'new',
  'contacted',
  'calculation',
  'approved',
  'invoiced',
  'paid',
  'factory',
  'production',
  'delivery',
  'installation',
  'completed',
];

const ALL_STATUSES: OrderStatus[] = [...PIPELINE_STAGES, 'cancelled'];

// --- Color maps ---

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'border-blue-500 bg-blue-500',
  contacted: 'border-yellow-500 bg-yellow-500',
  calculation: 'border-orange-500 bg-orange-500',
  approved: 'border-purple-500 bg-purple-500',
  invoiced: 'border-indigo-500 bg-indigo-500',
  paid: 'border-green-500 bg-green-500',
  factory: 'border-violet-500 bg-violet-500',
  production: 'border-amber-500 bg-amber-500',
  delivery: 'border-cyan-500 bg-cyan-500',
  installation: 'border-teal-500 bg-teal-500',
  completed: 'border-emerald-500 bg-emerald-500',
  cancelled: 'border-red-500 bg-red-500',
};

const CARD_BORDER_COLORS: Record<OrderStatus, string> = {
  new: 'border-l-blue-500',
  contacted: 'border-l-yellow-500',
  calculation: 'border-l-orange-500',
  approved: 'border-l-purple-500',
  invoiced: 'border-l-indigo-500',
  paid: 'border-l-green-500',
  factory: 'border-l-violet-500',
  production: 'border-l-amber-500',
  delivery: 'border-l-cyan-500',
  installation: 'border-l-teal-500',
  completed: 'border-l-emerald-500',
  cancelled: 'border-l-red-500',
};

// --- Deal type ---

interface Deal {
  id: number;
  client_id: number;
  manager_id: number;
  product_type: string;
  description: string;
  amount: number;
  status: OrderStatus;
  loss_reason: string;
  created_at: string;
  updated_at: string;
  client_name: string;
  client_phone: string;
  client_city: string;
  manager_name: string;
  days_in_stage: number;
}

// --- WhatsApp SVG icon ---

function WhatsAppIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// --- Draggable Card ---

function DealCard({ deal, status }: { deal: Deal; status: OrderStatus }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id, data: { status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const phone = deal.client_phone?.replace(/\D/g, '');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white rounded-lg shadow-sm p-3 border-l-4 ${CARD_BORDER_COLORS[status]} hover:shadow-md transition cursor-grab active:cursor-grabbing`}
    >
      {/* Row 1: name + WhatsApp */}
      <div className="flex items-center justify-between">
        <Link
          href={`/deals/${deal.id}`}
          className="text-sm font-semibold text-gray-900 hover:text-blue-600 truncate"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {deal.client_name || '\u2014'}
        </Link>
        {phone && (
          <a
            href={`https://wa.me/${phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-500 hover:text-green-600 shrink-0 ml-1"
            title="WhatsApp"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <WhatsAppIcon />
          </a>
        )}
      </div>

      {/* Row 2: product type */}
      <div className="text-xs text-gray-500 mt-1 truncate">
        {PRODUCT_TYPE_LABELS[deal.product_type as keyof typeof PRODUCT_TYPE_LABELS] || deal.product_type}
      </div>

      {/* Row 3: amount */}
      <div className="text-sm font-bold text-gray-900 mt-1">
        {Number(deal.amount).toLocaleString('ru-RU')} {'\u20B8'}
      </div>

      {/* Row 4: manager + days in stage */}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span className="truncate mr-1">{deal.manager_name || '\u2014'}</span>
        <span className="whitespace-nowrap">
          {deal.days_in_stage != null ? `${deal.days_in_stage} \u0434\u043D` : ''}
        </span>
      </div>
    </div>
  );
}

// --- Droppable Column ---

function DroppableColumn({
  status,
  deals,
}: {
  status: OrderStatus;
  deals: Deal[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const colorClass = STATUS_COLORS[status].split(' ')[1];

  const totalAmount = deals.reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <div className="min-w-[220px] max-w-[260px] bg-gray-50 rounded-xl p-3 flex flex-col shrink-0">
      {/* Column header */}
      <div
        className={`border-t-4 ${STATUS_COLORS[status].split(' ')[0]} rounded-t-sm -mt-3 -mx-3 px-3 pt-3 mb-2`}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900">
            {ORDER_STATUS_LABELS[status]}
          </h3>
          <span
            className={`text-xs font-bold text-white rounded-full w-6 h-6 flex items-center justify-center ${colorClass}`}
          >
            {deals.length}
          </span>
        </div>
        {totalAmount > 0 && (
          <div className="text-xs text-gray-500 mb-2">
            {totalAmount.toLocaleString('ru-RU')} {'\u20B8'}
          </div>
        )}
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-300px)] min-h-[60px] rounded-lg transition-colors ${
          isOver ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset' : ''
        }`}
      >
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} status={status} />
          ))}
        </SortableContext>
        {deals.length === 0 && !isOver && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-400 text-center py-6">
            Перетащите сюда
          </div>
        )}
      </div>
    </div>
  );
}

// --- Overlay card (shown while dragging) ---

function OverlayCard({ deal }: { deal: Deal }) {
  const status = deal.status;
  return (
    <div
      className={`bg-white rounded-lg shadow-lg p-3 border-l-4 ${CARD_BORDER_COLORS[status]} w-[220px] rotate-2`}
    >
      <div className="text-sm font-semibold text-gray-900 truncate">
        {deal.client_name || '\u2014'}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {PRODUCT_TYPE_LABELS[deal.product_type as keyof typeof PRODUCT_TYPE_LABELS] || deal.product_type}
      </div>
      <div className="text-sm font-bold text-gray-900 mt-1">
        {Number(deal.amount).toLocaleString('ru-RU')} {'\u20B8'}
      </div>
    </div>
  );
}

// --- Quick-add modal ---

function QuickAddModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (deal: Deal) => void;
}) {
  const { data: session } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState<LeadSource>('whatsapp');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    try {
      const userId = (session?.user as { id?: number })?.id || 1;
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          source,
          comment: comment.trim(),
          manager_id: userId,
        }),
      });
      if (res.ok) {
        const deal = await res.json();
        onCreated(deal);
        onClose();
      }
    } catch (err) {
      console.error('Failed to create deal:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Новая сделка</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Имя клиента *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Аслан"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Телефон *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 777 123 45 67"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Источник</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as LeadSource)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(LEAD_SOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Комментарий</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Интересуется стеклопакетом с обогревом..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !name.trim() || !phone.trim()}
              className="flex-1 px-4 py-2.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
            >
              {saving ? 'Создание...' : 'Создать сделку'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Main page ---

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrder, setActiveOrder] = useState<Deal | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Loss reason modal
  const [lossModal, setLossModal] = useState<{ dealId: number } | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [lossOtherText, setLossOtherText] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    fetchDeals();
  }, []);

  function fetchDeals() {
    fetch('/api/deals')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDeals(data);
      })
      .finally(() => setLoading(false));
  }

  const getDealsByStatus = useCallback(
    (status: OrderStatus): Deal[] => {
      return deals.filter((d) => d.status === status);
    },
    [deals]
  );

  async function updateDealStatus(dealId: number, newStatus: OrderStatus, loss_reason?: string) {
    try {
      const body: Record<string, string> = { status: newStatus };
      if (loss_reason) body.loss_reason = loss_reason;
      const res = await fetch(`/api/orders/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setDeals((prev) =>
          prev.map((d) =>
            d.id === dealId
              ? { ...d, status: newStatus, updated_at: new Date().toISOString(), days_in_stage: 0 }
              : d
          )
        );
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  async function handleLossSubmit() {
    if (!lossModal || !lossReason) return;
    const reason = lossReason === 'other' ? lossOtherText || 'Другое' : lossReason;
    await updateDealStatus(lossModal.dealId, 'cancelled', reason);
    setLossModal(null);
    setLossReason('');
    setLossOtherText('');
  }

  // --- DnD handlers ---

  function handleDragStart(event: DragStartEvent) {
    const dealId = event.active.id as number;
    const deal = deals.find((d) => d.id === dealId);
    setActiveOrder(deal || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveOrder(null);

    if (!over) return;

    const dealId = active.id as number;
    const overIdStr = String(over.id);

    let newStatus: OrderStatus;
    const isStatus = ALL_STATUSES.includes(overIdStr as OrderStatus);
    if (isStatus) {
      newStatus = overIdStr as OrderStatus;
    } else {
      const targetDeal = deals.find((d) => d.id === Number(over.id));
      if (!targetDeal) return;
      newStatus = targetDeal.status;
    }

    const currentDeal = deals.find((d) => d.id === dealId);
    if (!currentDeal || currentDeal.status === newStatus) return;

    if (newStatus === 'cancelled') {
      setLossModal({ dealId });
      setLossReason('');
      setLossOtherText('');
      return;
    }

    updateDealStatus(dealId, newStatus);
  }

  const cancelledDeals = getDealsByStatus('cancelled');

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Сделки</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + Сделка
          </button>
        </div>

        {/* Kanban board */}
        {loading ? (
          <div className="text-gray-500">Загрузка...</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
                {PIPELINE_STAGES.map((status) => (
                  <DroppableColumn
                    key={status}
                    status={status}
                    deals={getDealsByStatus(status)}
                  />
                ))}
              </div>
            </div>

            <DragOverlay dropAnimation={null}>
              {activeOrder ? <OverlayCard deal={activeOrder} /> : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Cancelled deals section */}
        {cancelledDeals.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowCancelled(!showCancelled)}
              className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-gray-700"
            >
              <span
                className={`transition-transform ${showCancelled ? 'rotate-90' : ''}`}
              >
                &#9654;
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {ORDER_STATUS_LABELS.cancelled} ({cancelledDeals.length})
              </span>
            </button>
            {showCancelled && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {cancelledDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className={`bg-white rounded-lg shadow-sm p-3 border-l-4 ${CARD_BORDER_COLORS.cancelled} opacity-60`}
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/deals/${deal.id}`}
                        className="text-sm font-semibold text-gray-900 hover:text-blue-600 truncate"
                      >
                        {deal.client_name || '\u2014'}
                      </Link>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {PRODUCT_TYPE_LABELS[deal.product_type as keyof typeof PRODUCT_TYPE_LABELS] || deal.product_type}
                    </div>
                    <div className="text-sm font-bold text-gray-900 mt-1">
                      {Number(deal.amount).toLocaleString('ru-RU')} {'\u20B8'}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>{deal.manager_name || '\u2014'}</span>
                      <span>
                        {new Date(deal.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    {deal.loss_reason && (
                      <div className="mt-1.5 text-xs text-red-500">
                        {LOSS_REASON_LABELS[deal.loss_reason] || deal.loss_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick-add modal */}
      {showAddModal && (
        <QuickAddModal
          onClose={() => setShowAddModal(false)}
          onCreated={(deal) => setDeals((prev) => [deal, ...prev])}
        />
      )}

      {/* Loss reason modal */}
      {lossModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Причина потери сделки</h2>
            <p className="text-sm text-gray-500 mb-4">Выберите причину для аналитики</p>
            <div className="space-y-2 mb-4">
              {Object.entries(LOSS_REASON_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="loss_reason"
                    value={key}
                    checked={lossReason === key}
                    onChange={() => setLossReason(key)}
                    className="accent-red-500"
                  />
                  <span className="text-sm text-gray-900">{label}</span>
                </label>
              ))}
              {lossReason === 'other' && (
                <input
                  type="text"
                  value={lossOtherText}
                  onChange={(e) => setLossOtherText(e.target.value)}
                  placeholder="Укажите причину..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 mt-1"
                />
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleLossSubmit}
                disabled={!lossReason}
                className="flex-1 px-4 py-2.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50 font-medium"
              >
                Потерять сделку
              </button>
              <button
                onClick={() => setLossModal(null)}
                className="px-4 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Назад
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
