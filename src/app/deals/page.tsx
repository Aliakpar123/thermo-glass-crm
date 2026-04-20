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
  'measurement',
  'sent_to_factory',
  'calculation',
  'approved',
  'paid',
  'factory',
  'delivery',
  'installation',
  'completed',
];

const ALL_STATUSES: OrderStatus[] = [...PIPELINE_STAGES, 'cancelled'];

// --- Color maps ---

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'border-blue-500 bg-blue-500',
  contacted: 'border-yellow-500 bg-yellow-500',
  measurement: 'border-cyan-500 bg-cyan-500',
  sent_to_factory: 'border-violet-500 bg-violet-500',
  calculation: 'border-orange-500 bg-orange-500',
  approved: 'border-purple-500 bg-purple-500',
  paid: 'border-green-500 bg-green-500',
  factory: 'border-indigo-500 bg-indigo-500',
  delivery: 'border-sky-500 bg-sky-500',
  installation: 'border-teal-500 bg-teal-500',
  completed: 'border-emerald-500 bg-emerald-500',
  cancelled: 'border-red-500 bg-red-500',
};

const CARD_BORDER_COLORS: Record<OrderStatus, string> = {
  new: 'border-l-blue-500',
  contacted: 'border-l-yellow-500',
  measurement: 'border-l-cyan-500',
  sent_to_factory: 'border-l-violet-500',
  calculation: 'border-l-orange-500',
  approved: 'border-l-purple-500',
  paid: 'border-l-green-500',
  factory: 'border-l-indigo-500',
  delivery: 'border-l-sky-500',
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

// --- Suggestion type ---

interface Suggestion {
  deal_id: number;
  client_name: string;
  client_phone: string;
  type: 'call' | 'whatsapp' | 'followup' | 'discount' | 'urgency' | 'upsell';
  priority: 'high' | 'medium' | 'low';
  message: string;
  action_text: string;
  reason: string;
}

const SUGGESTION_TYPE_ICONS: Record<string, string> = {
  call: '\uD83D\uDCDE',
  whatsapp: '\uD83D\uDCAC',
  followup: '\uD83D\uDD04',
  discount: '\uD83C\uDFF7\uFE0F',
  urgency: '\u26A1',
  upsell: '\uD83D\uDC8E',
};

const PRIORITY_DOTS: Record<string, string> = {
  high: '\uD83D\uDD34',
  medium: '\uD83D\uDFE1',
  low: '\uD83D\uDFE2',
};

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
  measurement: '#06b6d4',
  sent_to_factory: '#7c3aed',
  calculation: '#f97316',
  approved: '#a855f7',
  paid: '#22c55e',
  factory: '#6366f1',
  delivery: '#0ea5e9',
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

// --- Lock icon ---

function LockIcon() {
  return (
    <svg className="w-3 h-3 inline-block" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  );
}

// --- Draggable Card ---

function DealCard({
  deal,
  status,
  canDrag,
  userRole,
  onTransfer,
  onDelete,
}: {
  deal: Deal;
  status: OrderStatus;
  canDrag: boolean;
  userRole: string;
  onTransfer: (dealId: number) => void;
  onDelete: (dealId: number, clientName: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id, data: { status }, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : canDrag ? 1 : 0.8,
  };

  const phone = deal.client_phone?.replace(/\D/g, '');
  const managerName = deal.manager_name || '—';
  const managerColor = getManagerColor(managerName);
  const managerInitial = (managerName).charAt(0).toUpperCase();
  const productShort = PRODUCT_TYPE_LABELS[deal.product_type as keyof typeof PRODUCT_TYPE_LABELS] || deal.product_type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(canDrag ? listeners : {})}
      className={`deal-card bg-white rounded-xl border border-gray-100 p-3 border-l-[3px] ${CARD_BORDER_COLORS[status]} relative ${
        canDrag
          ? 'cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gray-200 transition-all duration-150'
          : 'cursor-default'
      }`}
    >
      {/* Row 1: status dot + name + amount + WhatsApp */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: STATUS_DOT_COLORS[status] }}
        />
        <Link
          href={`/deals/${deal.id}`}
          className="text-[13px] font-semibold text-gray-900 hover:text-[#22c55e] truncate flex-1"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {deal.client_name || '—'}
        </Link>
        <span className="text-[13px] font-medium text-gray-900 shrink-0 ml-auto">
          {'₸'}{formatAmount(Number(deal.amount))}
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
        {userRole === 'admin' && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(deal.id, deal.client_name || '—'); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="shrink-0 ml-0.5 w-5 h-5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
            title="Удалить сделку"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
            </svg>
          </button>
        )}
      </div>

      {/* Row 2: product + city */}
      <div className="text-xs text-gray-500 mt-1 truncate">
        {productShort}{deal.client_city ? ` · ${deal.client_city}` : ''}
      </div>

      {/* Row 3: manager avatar + manager name + days */}
      <div className="flex items-center gap-1.5 mt-2">
        <div
          className="w-5 h-5 rounded-full text-white text-[9px] font-semibold flex items-center justify-center shrink-0"
          style={{ backgroundColor: managerColor }}
        >
          {managerInitial}
        </div>
        <span className="text-[11px] text-gray-500 truncate">{managerName}</span>
        {deal.days_in_stage != null && (
          <>
            <span className="text-xs text-gray-400">&middot;</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">{deal.days_in_stage} дн</span>
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
          return <div className="mt-1.5 text-[11px] text-red-600 truncate">{'\uD83D\uDD34'} Просрочено: {text}</div>;
        } else if (actionDate.getTime() === today.getTime()) {
          return <div className="mt-1.5 text-[11px] text-orange-600 truncate">{'\uD83D\uDFE0'} Сегодня: {text}</div>;
        } else {
          const dateStr = actionDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
          return <div className="mt-1.5 text-[11px] text-gray-500 truncate">{text} ({dateStr})</div>;
        }
      })()}

      {/* Transfer button for client_manager on new/contacted stages */}
      {canDrag && ['new', 'contacted', 'measurement'].includes(status) && userRole === 'client_manager' && (
        <button
          onClick={(e) => { e.stopPropagation(); onTransfer(deal.id); }}
          className="mt-1 w-full text-[11px] text-[#22c55e] bg-[#dcfce7] rounded-md py-1 hover:bg-[#bbf7d0] transition-all duration-150 font-medium"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {'→'} Передать в работу
        </button>
      )}

      {/* Non-draggable indicator */}
      {!canDrag && (
        <div className="mt-1.5 text-[11px] text-gray-400 flex items-center gap-1">
          <LockIcon /> <span>Ответственный: {managerName}</span>
        </div>
      )}

    </div>
  );
}

// --- Droppable Column ---

function DroppableColumn({
  status,
  deals,
  onAddDeal,
  canDrag,
  userRole,
  onTransfer,
  onDelete,
}: {
  status: OrderStatus;
  deals: Deal[];
  onAddDeal?: () => void;
  canDrag: (deal: Deal) => boolean;
  userRole: string;
  onTransfer: (dealId: number) => void;
  onDelete: (dealId: number, clientName: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const colorHex = STATUS_DOT_COLORS[status];
  const isEmpty = deals.length === 0;

  const totalAmount = deals.reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <div className="min-w-[220px] max-w-[260px] bg-gray-50/50 rounded-xl p-3 flex flex-col shrink-0 transition-all duration-200 border border-gray-100/60">
      {/* Column header */}
      <div
        className="rounded-t-lg -mt-3 -mx-3 px-3 pt-3 mb-2"
        style={{
          background: `linear-gradient(135deg, ${colorHex}10 0%, ${colorHex}05 100%)`,
          borderTop: `2px solid ${colorHex}`,
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[13px] font-medium uppercase tracking-wide text-gray-500">
            {ORDER_STATUS_LABELS[status]}
          </h3>
          <span
            className="text-[10px] font-semibold text-gray-500 rounded-md w-5 h-5 flex items-center justify-center shrink-0 bg-white border border-gray-200"
          >
            {deals.length}
          </span>
        </div>
        {totalAmount > 0 && (
          <div className="text-[11px] font-medium text-gray-400 mb-2">
            {'₸'} {formatAmount(totalAmount)}
          </div>
        )}
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-250px)] min-h-[80px] rounded-lg transition-colors duration-200 ${
          isOver ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset' : ''
        }`}
      >
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              status={status}
              canDrag={canDrag(deal)}
              userRole={userRole}
              onTransfer={onTransfer}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
        {deals.length === 0 && !isOver && (
          <div className="border border-dashed border-gray-200 rounded-lg text-[11px] text-gray-300 text-center py-6">
            Перетащите сюда
          </div>
        )}
        {onAddDeal && (
          <button
            onClick={onAddDeal}
            className="w-full mt-2 py-2 border border-dashed border-[#22c55e]/30 rounded-lg text-[12px] text-[#22c55e] hover:bg-[#dcfce7] hover:border-[#22c55e]/50 transition-all duration-150 font-medium"
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
  const managerName = deal.manager_name || '—';
  const managerColor = getManagerColor(managerName);
  const managerInitial = managerName.charAt(0).toUpperCase();

  return (
    <div
      className={`bg-white rounded-xl p-3 border-l-[3px] border border-gray-100 ${CARD_BORDER_COLORS[status]} w-[230px] opacity-90 rotate-1`}
      style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.12)', transform: 'scale(1.05) rotate(1deg)' }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: STATUS_DOT_COLORS[status] }}
        />
        <span className="text-sm font-bold text-gray-900 truncate flex-1">
          {deal.client_name || '—'}
        </span>
        <span className="text-sm font-semibold text-gray-900 shrink-0">
          {'₸'}{formatAmount(Number(deal.amount))}
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
  const [phone, setPhone] = useState('+7 ');

  const formatPhone = (val: string) => {
    // Keep +7 prefix, only allow digits after
    let digits = val.replace(/\D/g, '');
    if (!digits.startsWith('7')) digits = '7' + digits;
    if (digits.length > 11) digits = digits.slice(0, 11);
    // Format: +7 XXX XXX XX XX
    let formatted = '+7';
    if (digits.length > 1) formatted += ' ' + digits.slice(1, 4);
    if (digits.length > 4) formatted += ' ' + digits.slice(4, 7);
    if (digits.length > 7) formatted += ' ' + digits.slice(7, 9);
    if (digits.length > 9) formatted += ' ' + digits.slice(9, 11);
    return formatted;
  };

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-[2px]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-gray-100 animate-fadeIn">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Новая сделка</h2>

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
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-[#22c55e] rounded-lg hover:bg-[#16a34a] transition disabled:opacity-50"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Телефон *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="+7 777 123 45 67"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e]"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Источник</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as LeadSource)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e]"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e]"
              >
                {Object.entries(PRODUCT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Сумма ({'₸'})</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e]"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Боль клиента</label>
            <select
              value={clientPain}
              onChange={(e) => setClientPain(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e]"
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
              className="flex-1 px-4 py-2.5 text-sm text-white bg-[#22c55e] rounded-lg hover:bg-[#16a34a] transition disabled:opacity-50 font-medium"
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

// --- Autopilot suggestion card ---

function AutopilotCard({
  suggestion,
  onDismiss,
}: {
  suggestion: Suggestion;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const priorityDot = PRIORITY_DOTS[suggestion.priority] || '';
  const typeIcon = SUGGESTION_TYPE_ICONS[suggestion.type] || '';
  const waLink = suggestion.client_phone
    ? `https://wa.me/${suggestion.client_phone}?text=${encodeURIComponent(suggestion.action_text)}`
    : '';

  function handleCopy() {
    navigator.clipboard.writeText(suggestion.action_text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-w-[280px] max-w-[320px] bg-gray-50 border border-gray-200 rounded-xl p-3 shrink-0 flex flex-col gap-2">
      {/* Header: priority + type + message */}
      <div className="flex items-start gap-1.5">
        <span className="text-sm shrink-0">{priorityDot}</span>
        <span className="text-sm shrink-0">{typeIcon}</span>
        <span className="text-[13px] font-semibold text-gray-900 leading-tight flex-1">{suggestion.message}</span>
      </div>

      {/* Reason */}
      <div className="text-[11px] text-gray-400">{suggestion.reason}</div>

      {/* Action text (expandable) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-left text-[11px] text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        {'\uD83D\uDCAC'} {expanded ? '\u0421\u043a\u0440\u044b\u0442\u044c \u0442\u0435\u043a\u0441\u0442' : '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0442\u0435\u043a\u0441\u0442 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f'}
      </button>
      {expanded && (
        <div className="bg-white border border-gray-200 rounded-lg p-2 text-[12px] text-gray-900 whitespace-pre-line leading-relaxed">
          {suggestion.action_text}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-auto">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-all duration-150"
        >
          {copied ? '\u2705' : '\uD83D\uDCCB'} {copied ? '\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e' : '\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c'}
        </button>
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white rounded-lg hover:opacity-90 transition-all duration-150"
            style={{ backgroundColor: '#22c55e' }}
          >
            <WhatsAppIcon /> WhatsApp
          </a>
        )}
        <button
          onClick={onDismiss}
          className="ml-auto text-gray-400 hover:text-gray-600 text-sm leading-none px-1"
          title={'\u0423\u0431\u0440\u0430\u0442\u044c'}
        >
          {'\u2715'}
        </button>
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

  // Role-based permissions
  const userId = (session?.user as { id?: string })?.id || '';
  const userRole = (session?.user as { role?: string })?.role || '';
  const isAdmin = userRole === 'admin';

  // Autopilot suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showAutopilot, setShowAutopilot] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  // My deals filter - default: my deals for non-admin, all deals for admin
  const [showMyDeals, setShowMyDeals] = useState(!isAdmin);

  // Update showMyDeals default when role loads
  useEffect(() => {
    if (userRole) {
      setShowMyDeals(userRole !== 'admin');
    }
  }, [userRole]);

  // Order manager id for auto-assignment
  const [orderManagerId, setOrderManagerId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/staff?period=all')
      .then(r => r.json())
      .then(staff => {
        if (Array.isArray(staff)) {
          const om = staff.find((s: { role?: string }) => s.role === 'order_manager');
          if (om) setOrderManagerId(om.id);
        }
      })
      .catch(() => {});
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    fetchDeals();
    // Auto-refresh every 15 seconds
    const interval = setInterval(() => {
      fetchDeals();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Fetch overdue notifications + auto-refresh
  useEffect(() => {
    function fetchNotifications() {
      const nUserId = (session?.user as { id?: string })?.id || '';
      const nUserRole = (session?.user as { role?: string })?.role || '';
      const params = nUserRole !== 'admin' && nUserId ? `?manager_id=${nUserId}` : '';
      fetch(`/api/notifications${params}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setOverdueNotifications(data);
        })
        .catch(() => {});
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [session]);

  // Fetch autopilot suggestions
  useEffect(() => {
    function fetchSuggestions() {
      const params = isAdmin ? '' : `?manager_id=${userId}`;
      fetch(`/api/suggestions${params}`)
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setSuggestions(data); })
        .catch(() => {});
    }
    fetchSuggestions();
    const interval = setInterval(fetchSuggestions, 30000);
    return () => clearInterval(interval);
  }, [userId, isAdmin]);

  const activeSuggestions = suggestions.filter(s => !dismissedIds.has(s.deal_id));

  function fetchDeals() {
    fetch('/api/deals')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDeals(data);
      })
      .finally(() => setLoading(false));
  }

  // Admin: архивировать сделку (с возможностью восстановить)
  const handleDeleteDeal = useCallback(async (dealId: number, clientName: string) => {
    if (!confirm(`Отправить сделку "${clientName}" в архив?\n\nЕё можно будет восстановить из раздела "Архив".`)) return;
    try {
      const res = await fetch(`/api/orders/${dealId}`, { method: 'DELETE' });
      if (res.ok) {
        setDeals((prev) => prev.filter((d) => d.id !== dealId));
      } else {
        alert('Не удалось архивировать сделку.');
      }
    } catch {
      alert('Ошибка сети.');
    }
  }, []);

  const filteredDeals = deals.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (d.client_name || '').toLowerCase().includes(q) ||
      (d.client_phone || '').toLowerCase().includes(q)
    );
  });

  // Apply "my deals" filter
  const visibleDeals = showMyDeals && userId
    ? filteredDeals.filter(d => String(d.manager_id) === userId)
    : filteredDeals;

  const getDealsByStatus = useCallback(
    (status: OrderStatus): Deal[] => {
      return visibleDeals.filter((d) => d.status === status);
    },
    [visibleDeals]
  );

  // Check if user can drag a specific deal
  const canDragDeal = useCallback(
    (deal: Deal): boolean => {
      return isAdmin || String(deal.manager_id) === userId;
    },
    [isAdmin, userId]
  );

  async function updateDealStatus(dealId: number, newStatus: OrderStatus, loss_reason?: string, newManagerId?: number) {
    try {
      const body: Record<string, unknown> = { status: newStatus };
      if (loss_reason) body.loss_reason = loss_reason;
      if (newManagerId) body.manager_id = newManagerId;
      const res = await fetch(`/api/orders/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updatedDeal = await res.json();
        setDeals((prev) =>
          prev.map((d) =>
            d.id === dealId
              ? {
                  ...d,
                  status: newStatus,
                  updated_at: new Date().toISOString(),
                  days_in_stage: 0,
                  ...(newManagerId ? { manager_id: newManagerId, manager_name: updatedDeal.manager_name || d.manager_name } : {}),
                }
              : d
          )
        );
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  async function handleTransfer(dealId: number) {
    if (!orderManagerId) return;
    await updateDealStatus(dealId, 'sent_to_factory', undefined, orderManagerId);
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

    // Check permission: only admin or responsible manager can move
    if (!isAdmin && String(currentDeal.manager_id) !== userId) return;

    if (newStatus === 'cancelled') {
      setLossModal({ dealId });
      setLossReason('');
      setLossOtherText('');
      return;
    }

    // Auto-assign: when moving to calculation/approved/invoiced/paid, assign to order_manager
    let newManagerId: number | undefined;
    if (
      ['sent_to_factory', 'calculation', 'approved', 'paid'].includes(newStatus) &&
      orderManagerId &&
      currentDeal.manager_id !== orderManagerId
    ) {
      newManagerId = orderManagerId;
    }

    updateDealStatus(dealId, newStatus, undefined, newManagerId);
  }

  const cancelledDeals = getDealsByStatus('cancelled');

  return (
    <Layout>
      <div className="space-y-4">
        {/* Overdue notifications banner */}
        {overdueNotifications.length > 0 && !bannerDismissed && (
          <div className="bg-red-50/70 border border-red-100 rounded-xl px-4 py-3 flex items-center justify-between">
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
                className="text-[#22c55e] hover:text-[#16a34a] font-medium whitespace-nowrap ml-1 text-[13px]"
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
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Сделки</h1>
          <div className="flex items-center gap-3">
            {/* My deals / All deals toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setShowMyDeals(true)}
                className={`px-3 py-1.5 text-[13px] font-medium transition-all duration-150 ${
                  showMyDeals
                    ? 'bg-[#22c55e] text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                Мои сделки
              </button>
              <button
                onClick={() => setShowMyDeals(false)}
                className={`px-3 py-1.5 text-[13px] font-medium transition-all duration-150 ${
                  !showMyDeals
                    ? 'bg-[#22c55e] text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                Все сделки
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Поиск по имени или телефону..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 border border-gray-200 rounded-lg px-3 py-1.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] pr-8 shadow-sm transition-all duration-150 placeholder:text-gray-300"
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
              className="bg-[#22c55e] text-white px-4 py-1.5 rounded-lg text-[13px] font-medium hover:bg-[#16a34a] transition-all duration-150 shadow-sm"
            >
              + Сделка
            </button>
          </div>
        </div>

        {/* Autopilot panel */}
        {activeSuggestions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Autopilot header */}
            <button
              onClick={() => setShowAutopilot(!showAutopilot)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-gray-100 hover:from-orange-100 hover:to-amber-100 transition-all duration-150"
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                {'\uD83E\uDD16'} {'\u0410\u0432\u0442\u043e\u043f\u0438\u043b\u043e\u0442'}
                <span className="text-[11px] font-medium text-gray-500 bg-white/80 px-2 py-0.5 rounded-full border border-gray-200">
                  {activeSuggestions.length} {activeSuggestions.length === 1 ? '\u043f\u043e\u0434\u0441\u043a\u0430\u0437\u043a\u0430' : activeSuggestions.length < 5 ? '\u043f\u043e\u0434\u0441\u043a\u0430\u0437\u043a\u0438' : '\u043f\u043e\u0434\u0441\u043a\u0430\u0437\u043e\u043a'}
                </span>
              </span>
              <span className="text-xs text-gray-400">{showAutopilot ? '\u25B2 \u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c' : '\u25BC \u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c'}</span>
            </button>

            {/* Suggestion cards */}
            {showAutopilot && (
              <div className="flex gap-3 p-3 overflow-x-auto">
                {activeSuggestions.map((s, idx) => (
                  <AutopilotCard
                    key={`${s.deal_id}-${s.type}-${idx}`}
                    suggestion={s}
                    onDismiss={() => setDismissedIds(prev => new Set(prev).add(s.deal_id))}
                  />
                ))}
              </div>
            )}
          </div>
        )}

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
                {(() => {
                  // Filter columns by role when "Мои сделки" is active
                  const CLIENT_MANAGER_STAGES: OrderStatus[] = ['new', 'contacted'];
                  const ORDER_MANAGER_STAGES: OrderStatus[] = ['sent_to_factory', 'calculation'];
                  const DELIVERY_MANAGER_STAGES: OrderStatus[] = ['measurement', 'factory', 'delivery', 'installation', 'completed'];
                  const ACCOUNTANT_STAGES: OrderStatus[] = ['approved', 'paid'];

                  let stages = PIPELINE_STAGES;
                  if (showMyDeals && !isAdmin) {
                    if (userRole === 'client_manager') stages = CLIENT_MANAGER_STAGES;
                    else if (userRole === 'order_manager') stages = ORDER_MANAGER_STAGES;
                    else if (userRole === 'delivery_manager') stages = DELIVERY_MANAGER_STAGES;
                    else if (userRole === 'accountant') stages = ACCOUNTANT_STAGES;
                  }

                  return stages.map((status) => (
                    <DroppableColumn
                      key={status}
                      status={status}
                      deals={getDealsByStatus(status)}
                      onAddDeal={status === 'new' ? () => setShowAddModal(true) : undefined}
                      canDrag={canDragDeal}
                      userRole={userRole}
                      onTransfer={handleTransfer}
                      onDelete={handleDeleteDeal}
                    />
                  ));
                })()}
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
                        {deal.client_name || '—'}
                      </Link>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {PRODUCT_TYPE_LABELS[deal.product_type as keyof typeof PRODUCT_TYPE_LABELS] || deal.product_type}
                    </div>
                    <div className="text-sm font-bold text-gray-900 mt-1">
                      {Number(deal.amount).toLocaleString('ru-RU')} {'₸'}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>{deal.manager_name || '—'}</span>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-gray-100 animate-fadeIn">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Причина потери сделки</h2>
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
