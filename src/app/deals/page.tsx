'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useSession } from 'next-auth/react';
import {
  OrderStatus,
  ORDER_STATUS_LABELS,
  PRODUCT_TYPE_LABELS,
  LOSS_REASON_LABELS,
  PAIN_CATEGORIES,
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
  next_action_date: string | null;
  next_action_text: string | null;
}

// --- Manager avatar colors ---

const MANAGER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function getManagerColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return MANAGER_COLORS[Math.abs(hash) % MANAGER_COLORS.length];
}

// --- Format amount short ---

function formatAmount(amount: number): string {
  if (amount >= 1000000) return (amount / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (amount >= 1000) return (amount / 1000).toFixed(0) + 'K';
  return String(amount);
}

// --- Status dot colors (hex) ---

const STATUS_DOT_COLORS: Record<OrderStatus, string> = {
  new: '#3b82f6',
  contacted: '#eab308',
  calculation: '#f97316',
  approved: '#a855f7',
  invoiced: '#6366f1',
  paid: '#22c55e',
  factory: '#8b5cf6',
  production: '#f59e0b',
  delivery: '#06b6d4',
  installation: '#14b8a6',
  completed: '#10b981',
  cancelled: '#ef4444',
};

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
  const managerName = deal.manager_name || '\u2014';
  const managerColor = getManagerColor(managerName);
  const managerInitial = (managerName).charAt(0).toUpperCase();
  const productShort = PRODUCT_TYPE_LABELS[deal.product_type as keyof typeof PRODUCT_TYPE_LABELS] || deal.product_type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`deal-card bg-white rounded-xl shadow-sm p-3 border-l-4 ${CARD_BORDER_COLORS[status]} cursor-grab active:cursor-grabbing`}
    >
      {/* Row 1: status dot + name + amount + WhatsApp */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: STATUS_DOT_COLORS[status] }}
        />
        <Link
          href={`/deals/${deal.id}`}
          className="text-sm font-bold text-gray-900 hover:text-blue-600 truncate flex-1"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {deal.client_name || '\u2014'}
        </Link>
        <span className="text-sm font-semibold text-gray-900 shrink-0 ml-auto">
          {'\u20B8'}{formatAmount(Number(deal.amount))}
        </span>
        {phone && (
          <a
            href={`https://wa.me/${phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-500 hover:text-green-600 shrink-0 ml-0.5"
            title="WhatsApp"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <WhatsAppIcon />
          </a>
        )}
      </div>

      {/* Row 2: product + city */}
      <div className="text-xs text-gray-500 mt-1 truncate">
        {productShort}{deal.client_city ? ` \u00B7 ${deal.client_city}` : ''}
      </div>

      {/* Row 3: manager avatar + manager name + days */}
      <div className="flex items-center gap-1.5 mt-2">
        <div
          className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
          style={{ backgroundColor: managerColor }}
        >
          {managerInitial}
        </div>
        <span className="text-xs text-gray-900 truncate">{managerName}</span>
        {deal.days_in_stage != null && (
          <>
            <span className="text-xs text-gray-400">&middot;</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">{deal.days_in_stage} \u0434\u043D</span>
          </>
        )}
      </div>

      {/* Row 4: Reminder / next action (optional) */}
      {deal.next_action_date && (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const actionDate = new Date(deal.next_action_date);
        actionDate.setHours(0, 0, 0, 0);
        const text = deal.next_action_text || '';
        if (actionDate.getTime() < today.getTime()) {
          return <div className="mt-1.5 text-[11px] text-red-600 truncate">{'\uD83D\uDD34'} \u041F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043E: {text}</div>;
        } else if (actionDate.getTime() === today.getTime()) {
          return <div className="mt-1.5 text-[11px] text-orange-600 truncate">{'\uD83D\uDFE0'} \u0421\u0435\u0433\u043E\u0434\u043D\u044F: {text}</div>;
        } else {
          const dateStr = actionDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
          return <div className="mt-1.5 text-[11px] text-gray-500 truncate">{text} ({dateStr})</div>;
        }
      })()}
    </div>
  );
}

// --- Droppable Column ---

function DroppableColumn({
  status,
  deals,
  onAddDeal,
}: {
  status: OrderStatus;
  deals: Deal[];
  onAddDeal?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const colorHex = STATUS_DOT_COLORS[status];
  const isEmpty = deals.length === 0;

  const totalAmount = deals.reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <div className={`${isEmpty ? 'min-w-[180px]' : 'min-w-[220px]'} max-w-[260px] bg-gray-50 rounded-xl p-3 flex flex-col shrink-0 transition-all duration-200`}>
      {/* Column header with gradient */}
      <div
        className="rounded-t-lg -mt-3 -mx-3 px-3 pt-3 mb-2"
        style={{
          background: `linear-gradient(135deg, ${colorHex}22 0%, ${colorHex}08 100%)`,
          borderTop: `3px solid ${colorHex}`,
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900">
            {ORDER_STATUS_LABELS[status]}
          </h3>
          <span
            className="text-xs font-bold text-white rounded-full w-7 h-7 flex items-center justify-center shadow-sm"
            style={{ backgroundColor: colorHex }}
          >
            {deals.length}
          </span>
        </div>
        {totalAmount > 0 && (
          <div className="text-xs font-semibold text-gray-900 mb-2">
            {'\u20B8'} {formatAmount(totalAmount)}
          </div>
        )}
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-300px)] min-h-[60px] rounded-lg transition-colors duration-200 ${
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
        {onAddDeal && (
          <button
            onClick={onAddDeal}
            className="w-full mt-2 py-2 border-2 border-dashed border-blue-300 rounded-lg text-sm text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition font-medium"
          >
            + Новая сделка
          </button>
        )}
      </div>
    </div>
  );
}

// --- Overlay card (shown while dragging) ---

function OverlayCard({ deal }: { deal: Deal }) {
  const status = deal.status;
  const managerName = deal.manager_name || '\u2014';
  const managerColor = getManagerColor(managerName);
  const managerInitial = managerName.charAt(0).toUpperCase();

  return (
    <div
      className={`bg-white rounded-xl p-3 border-l-4 ${CARD_BORDER_COLORS[status]} w-[230px] opacity-90 rotate-1`}
      style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.2)', transform: 'scale(1.05) rotate(1deg)' }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: STATUS_DOT_COLORS[status] }}
        />
        <span className="text-sm font-bold text-gray-900 truncate flex-1">
          {deal.client_name || '\u2014'}
        </span>
        <span className="text-sm font-semibold text-gray-900 shrink-0">
          {'\u20B8'}{formatAmount(Number(deal.amount))}
        </span>
      </div>
      <div className="text-xs text-gray-500 mt-1 truncate">
        {PRODUCT_TYPE_LABELS[deal.product_type as keyof typeof PRODUCT_TYPE_LABELS] || deal.product_type}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <div
          className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
          style={{ backgroundColor: managerColor }}
        >
          {managerInitial}
        </div>
        <span className="text-xs text-gray-900">{managerName}</span>
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
  const [city, setCity] = useState('');
  const [source, setSource] = useState<LeadSource>('whatsapp');
  const [productType, setProductType] = useState('steklopaket');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [clientPain, setClientPain] = useState('');
  const [saving, setSaving] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ name: string; phone: string; id: number } | null>(null);

  async function createDealForClient(clientId: number) {
    setSaving(true);
    try {
      const userId = (session?.user as { id?: number })?.id || 1;
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existing_client_id: clientId,
          product_type: productType,
          amount: Number(amount) || 0,
          comment: comment.trim(),
          manager_id: userId,
          client_pain: clientPain,
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    setDuplicateInfo(null);
    try {
      const userId = (session?.user as { id?: number })?.id || 1;
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          city: city.trim(),
          source,
          product_type: productType,
          amount: Number(amount) || 0,
          comment: comment.trim(),
          manager_id: userId,
          client_pain: clientPain,
        }),
      });
      if (res.status === 409) {
        const data = await res.json();
        if (data.duplicate && data.existing_client) {
          setDuplicateInfo({
            name: data.existing_client.name,
            phone: data.existing_client.phone,
            id: data.existing_client.id,
          });
        }
        return;
      }
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

        {duplicateInfo && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
            <p className="text-sm font-medium text-gray-900 mb-2">
              Клиент {duplicateInfo.name} с телефоном {duplicateInfo.phone} уже существует
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => createDealForClient(duplicateInfo.id)}
                disabled={saving}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                Создать новую сделку для этого клиента
              </button>
              <button
                type="button"
                onClick={() => setDuplicateInfo(null)}
                className="px-3 py-2 text-xs font-medium text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Город</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Астана"
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Тип продукта</label>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(PRODUCT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Сумма ({'\u20B8'})</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Комментарий</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Что хочет клиент, откуда написал..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Боль клиента</label>
            <select
              value={clientPain}
              onChange={(e) => setClientPain(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Не указана</option>
              {Object.entries(PAIN_CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
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

interface OverdueNotification {
  id: number;
  next_action_date: string;
  next_action_text: string;
  status: string;
  client_name: string;
  client_phone: string;
  manager_name: string;
  days_overdue: number;
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrder, setActiveOrder] = useState<Deal | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Loss reason modal
  const [lossModal, setLossModal] = useState<{ dealId: number } | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [lossOtherText, setLossOtherText] = useState('');

  // Notifications
  const { data: session } = useSession();
  const router = useRouter();
  const [overdueNotifications, setOverdueNotifications] = useState<OverdueNotification[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    fetchDeals();
  }, []);

  // Fetch overdue notifications
  useEffect(() => {
    const userId = (session?.user as { id?: string })?.id || '';
    const userRole = (session?.user as { role?: string })?.role || '';
    const params = userRole !== 'admin' && userId ? `?manager_id=${userId}` : '';
    fetch(`/api/notifications${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setOverdueNotifications(data);
      })
      .catch(() => {});
  }, [session]);

  function fetchDeals() {
    fetch('/api/deals')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDeals(data);
      })
      .finally(() => setLoading(false));
  }

  const filteredDeals = deals.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (d.client_name || '').toLowerCase().includes(q) ||
      (d.client_phone || '').toLowerCase().includes(q)
    );
  });

  const getDealsByStatus = useCallback(
    (status: OrderStatus): Deal[] => {
      return filteredDeals.filter((d) => d.status === status);
    },
    [filteredDeals]
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
        {/* Overdue notifications banner */}
        {overdueNotifications.length > 0 && !bannerDismissed && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-900 min-w-0">
              <span className="text-lg flex-shrink-0">&#9888;&#65039;</span>
              <span className="truncate">
                У вас {overdueNotifications.length} просроченных задач
                {overdueNotifications.length <= 3
                  ? ' — ' + overdueNotifications.map((n) => {
                      const label = n.days_overdue > 0 ? `${n.days_overdue} дн` : n.days_overdue === 0 ? 'сегодня' : 'завтра';
                      return `${n.client_name || 'Без имени'} (${label})`;
                    }).join(', ')
                  : ' — ' + overdueNotifications.slice(0, 2).map((n) => {
                      const label = n.days_overdue > 0 ? `${n.days_overdue} дн` : n.days_overdue === 0 ? 'сегодня' : 'завтра';
                      return `${n.client_name || 'Без имени'} (${label})`;
                    }).join(', ') + '...'
                }
              </span>
              <button
                onClick={() => setShowAllNotifications(!showAllNotifications)}
                className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap ml-1"
              >
                {showAllNotifications ? 'Скрыть' : 'Показать все'}
              </button>
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-gray-400 hover:text-gray-600 ml-3 text-lg leading-none flex-shrink-0"
            >
              &times;
            </button>
          </div>
        )}
        {showAllNotifications && overdueNotifications.length > 0 && !bannerDismissed && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg max-h-[300px] overflow-y-auto">
            {overdueNotifications.map((n) => {
              const label = n.days_overdue > 0 ? `Просрочено ${n.days_overdue} дн` : n.days_overdue === 0 ? 'Сегодня' : 'Завтра';
              const labelColor = n.days_overdue > 0 ? 'text-red-500' : n.days_overdue === 0 ? 'text-orange-500' : 'text-yellow-500';
              const dotColor = n.days_overdue > 0 ? 'bg-red-500' : n.days_overdue === 0 ? 'bg-orange-500' : 'bg-yellow-500';
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    setShowAllNotifications(false);
                    router.push(`/deals/${n.id}`);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition"
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-1.5 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{n.client_name || 'Без имени'}</div>
                      <div className="text-xs text-gray-500 truncate">{n.next_action_text || 'Действие не указано'}</div>
                      <div className={`text-xs font-medium ${labelColor} mt-0.5`}>{label}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Сделки</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Поиск по имени или телефону..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm font-bold"
                  title="Очистить"
                >
                  &times;
                </button>
              )}
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              + Сделка
            </button>
          </div>
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
                    onAddDeal={status === 'new' ? () => setShowAddModal(true) : undefined}
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
