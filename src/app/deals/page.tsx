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
  measurement: 'border-cyan-500 bg-cyan-500',
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
  measurement: 'border-l-cyan-500',
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
  measurement: '#06b6d4',
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
}: {
  deal: Deal;
  status: OrderStatus;
  canDrag: boolean;
  userRole: string;
  onTransfer: (dealId: number) => void;
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
  const managerName = deal.manager_name || '\u2014';
  const managerColor = getManagerColor(managerName);
  const managerInitial = (managerName).charAt(0).toUpperCase();
  const productShort = PRODUCT_TYPE_LABELS[deal.product_type as keyof typeof PRODUCT_TYPE_LABELS] || deal.product_type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(canDrag ? listeners : {})}
      className={`deal-card bg-white rounded-xl shadow-sm p-3 border-l-4 ${CARD_BORDER_COLORS[status]} ${
        canDrag
          ? 'cursor-grab active:cursor-grabbing hover:shadow-md hover:scale-[1.02] transition-all duration-150'
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

      {/* Transfer button for client_manager on new/contacted stages */}
      {canDrag && ['new', 'contacted', 'measurement'].includes(status) && userRole === 'client_manager' && (
        <button
          onClick={(e) => { e.stopPropagation(); onTransfer(deal.id); }}
          className="mt-1 w-full text-xs text-blue-600 bg-blue-50 rounded py-1 hover:bg-blue-100 transition font-medium"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {'\u2192'} \u041F\u0435\u0440\u0435\u0434\u0430\u0442\u044C \u0432 \u0440\u0430\u0431\u043E\u0442\u0443
        </button>
      )}

      {/* Non-draggable indicator */}
      {!canDrag && (
        <div className="mt-1.5 text-[11px] text-gray-400 flex items-center gap-1">
          <LockIcon /> <span>\u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439: {managerName}</span>
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
}: {
  status: OrderStatus;
  deals: Deal[];
  onAddDeal?: () => void;
  canDrag: (deal: Deal) => boolean;
  userRole: string;
  onTransfer: (dealId: number) => void;
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
            <DealCard
              key={deal.id}
              deal={deal}
              status={status}
              canDrag={canDrag(deal)}
              userRole={userRole}
              onTransfer={onTransfer}
            />
          ))}
        </SortableContext>
        {deals.length === 0 && !isOver && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-400 text-center py-6">
            \u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 \u0441\u044E\u0434\u0430
          </div>
        )}
        {onAddDeal && (
          <button
            onClick={onAddDeal}
            className="w-full mt-2 py-2 border-2 border-dashed border-blue-300 rounded-lg text-sm text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition font-medium"
          >
            + \u041D\u043E\u0432\u0430\u044F \u0441\u0434\u0435\u043B\u043A\u0430
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">\u041D\u043E\u0432\u0430\u044F \u0441\u0434\u0435\u043B\u043A\u0430</h2>

        {duplicateInfo && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
            <p className="text-sm font-medium text-gray-900 mb-2">
              \u041A\u043B\u0438\u0435\u043D\u0442 {duplicateInfo.name} \u0441 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u043E\u043C {duplicateInfo.phone} \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => createDealForClient(duplicateInfo.id)}
                disabled={saving}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u0441\u0434\u0435\u043B\u043A\u0443 \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u043A\u043B\u0438\u0435\u043D\u0442\u0430
              </button>
              <button
                type="button"
                onClick={() => setDuplicateInfo(null)}
                className="px-3 py-2 text-xs font-medium text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                \u041E\u0442\u043C\u0435\u043D\u0430
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">\u0418\u043C\u044F \u043A\u043B\u0438\u0435\u043D\u0442\u0430 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="\u0410\u0441\u043B\u0430\u043D"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">\u0422\u0435\u043B\u0435\u0444\u043E\u043D *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="+7 777 123 45 67"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">\u0413\u043E\u0440\u043E\u0434</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="\u0410\u0441\u0442\u0430\u043D\u0430"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A</label>
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
              <label className="block text-sm font-medium text-gray-900 mb-1">\u0422\u0438\u043F \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0430</label>
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
              <label className="block text-sm font-medium text-gray-900 mb-1">\u0421\u0443\u043C\u043C\u0430 ({'\u20B8'})</label>
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
            <label className="block text-sm font-medium text-gray-900 mb-1">\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="\u0427\u0442\u043E \u0445\u043E\u0447\u0435\u0442 \u043A\u043B\u0438\u0435\u043D\u0442, \u043E\u0442\u043A\u0443\u0434\u0430 \u043D\u0430\u043F\u0438\u0441\u0430\u043B..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">\u0411\u043E\u043B\u044C \u043A\u043B\u0438\u0435\u043D\u0442\u0430</label>
            <select
              value={clientPain}
              onChange={(e) => setClientPain(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430</option>
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
              {saving ? '\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435...' : '\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0441\u0434\u0435\u043B\u043A\u0443'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              \u041E\u0442\u043C\u0435\u043D\u0430
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

  // Role-based permissions
  const userId = (session?.user as { id?: string })?.id || '';
  const userRole = (session?.user as { role?: string })?.role || '';
  const isAdmin = userRole === 'admin';

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
  }, []);

  // Fetch overdue notifications
  useEffect(() => {
    const nUserId = (session?.user as { id?: string })?.id || '';
    const nUserRole = (session?.user as { role?: string })?.role || '';
    const params = nUserRole !== 'admin' && nUserId ? `?manager_id=${nUserId}` : '';
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
    await updateDealStatus(dealId, 'calculation', undefined, orderManagerId);
  }

  async function handleLossSubmit() {
    if (!lossModal || !lossReason) return;
    const reason = lossReason === 'other' ? lossOtherText || '\u0414\u0440\u0443\u0433\u043E\u0435' : lossReason;
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
      ['calculation', 'approved', 'invoiced', 'paid'].includes(newStatus) &&
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
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-900 min-w-0">
              <span className="text-lg flex-shrink-0">&#9888;&#65039;</span>
              <span className="truncate">
                \u0423 \u0432\u0430\u0441 {overdueNotifications.length} \u043F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043D\u044B\u0445 \u0437\u0430\u0434\u0430\u0447
                {overdueNotifications.length <= 3
                  ? ' \u2014 ' + overdueNotifications.map((n) => {
                      const label = n.days_overdue > 0 ? `${n.days_overdue} \u0434\u043D` : n.days_overdue === 0 ? '\u0441\u0435\u0433\u043E\u0434\u043D\u044F' : '\u0437\u0430\u0432\u0442\u0440\u0430';
                      return `${n.client_name || '\u0411\u0435\u0437 \u0438\u043C\u0435\u043D\u0438'} (${label})`;
                    }).join(', ')
                  : ' \u2014 ' + overdueNotifications.slice(0, 2).map((n) => {
                      const label = n.days_overdue > 0 ? `${n.days_overdue} \u0434\u043D` : n.days_overdue === 0 ? '\u0441\u0435\u0433\u043E\u0434\u043D\u044F' : '\u0437\u0430\u0432\u0442\u0440\u0430';
                      return `${n.client_name || '\u0411\u0435\u0437 \u0438\u043C\u0435\u043D\u0438'} (${label})`;
                    }).join(', ') + '...'
                }
              </span>
              <button
                onClick={() => setShowAllNotifications(!showAllNotifications)}
                className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap ml-1"
              >
                {showAllNotifications ? '\u0421\u043A\u0440\u044B\u0442\u044C' : '\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0432\u0441\u0435'}
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
              const label = n.days_overdue > 0 ? `\u041F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043E ${n.days_overdue} \u0434\u043D` : n.days_overdue === 0 ? '\u0421\u0435\u0433\u043E\u0434\u043D\u044F' : '\u0417\u0430\u0432\u0442\u0440\u0430';
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
                      <div className="text-sm font-medium text-gray-900 truncate">{n.client_name || '\u0411\u0435\u0437 \u0438\u043C\u0435\u043D\u0438'}</div>
                      <div className="text-xs text-gray-500 truncate">{n.next_action_text || '\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043E'}</div>
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
          <h1 className="text-2xl font-bold text-gray-900">\u0421\u0434\u0435\u043B\u043A\u0438</h1>
          <div className="flex items-center gap-3">
            {/* My deals / All deals toggle */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setShowMyDeals(true)}
                className={`px-3 py-2 text-sm font-medium transition ${
                  showMyDeals
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-900 hover:bg-gray-50'
                }`}
              >
                \u041C\u043E\u0438 \u0441\u0434\u0435\u043B\u043A\u0438
              </button>
              <button
                onClick={() => setShowMyDeals(false)}
                className={`px-3 py-2 text-sm font-medium transition ${
                  !showMyDeals
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-900 hover:bg-gray-50'
                }`}
              >
                \u0412\u0441\u0435 \u0441\u0434\u0435\u043B\u043A\u0438
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0438\u043C\u0435\u043D\u0438 \u0438\u043B\u0438 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0443..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm font-bold"
                  title="\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C"
                >
                  &times;
                </button>
              )}
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              + \u0421\u0434\u0435\u043B\u043A\u0430
            </button>
          </div>
        </div>

        {/* Kanban board */}
        {loading ? (
          <div className="text-gray-500">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...</div>
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
                    canDrag={canDragDeal}
                    userRole={userRole}
                    onTransfer={handleTransfer}
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
            <h2 className="text-lg font-bold text-gray-900 mb-2">\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043F\u043E\u0442\u0435\u0440\u0438 \u0441\u0434\u0435\u043B\u043A\u0438</h2>
            <p className="text-sm text-gray-500 mb-4">\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0440\u0438\u0447\u0438\u043D\u0443 \u0434\u043B\u044F \u0430\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0438</p>
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
                  placeholder="\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0440\u0438\u0447\u0438\u043D\u0443..."
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
                \u041F\u043E\u0442\u0435\u0440\u044F\u0442\u044C \u0441\u0434\u0435\u043B\u043A\u0443
              </button>
              <button
                onClick={() => setLossModal(null)}
                className="px-4 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                \u041D\u0430\u0437\u0430\u0434
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
