'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { Order, OrderStatus, ORDER_STATUS_LABELS, PRODUCT_TYPE_LABELS, LOSS_REASON_LABELS } from '@/types';

const STATUS_COLUMNS: OrderStatus[] = [
  'new',
  'calculation',
  'approved',
  'factory',
  'production',
  'delivery',
  'installation',
  'completed',
];

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'border-blue-500 bg-blue-500',
  calculation: 'border-yellow-500 bg-yellow-500',
  approved: 'border-green-500 bg-green-500',
  factory: 'border-purple-500 bg-purple-500',
  production: 'border-orange-500 bg-orange-500',
  delivery: 'border-indigo-500 bg-indigo-500',
  installation: 'border-teal-500 bg-teal-500',
  completed: 'border-emerald-500 bg-emerald-500',
  cancelled: 'border-red-500 bg-red-500',
};

const CARD_BORDER_COLORS: Record<OrderStatus, string> = {
  new: 'border-l-blue-500',
  calculation: 'border-l-yellow-500',
  approved: 'border-l-green-500',
  factory: 'border-l-purple-500',
  production: 'border-l-orange-500',
  delivery: 'border-l-indigo-500',
  installation: 'border-l-teal-500',
  completed: 'border-l-emerald-500',
  cancelled: 'border-l-red-500',
};

export default function KanbanPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingOrderId, setMovingOrderId] = useState<number | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  function fetchOrders() {
    fetch('/api/orders')
      .then((r) => r.json())
      .then(setOrders)
      .finally(() => setLoading(false));
  }

  function getOrdersByStatus(status: OrderStatus): Order[] {
    return orders.filter((o) => o.status === status);
  }

  const [lossModal, setLossModal] = useState<{ orderId: number } | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [lossOtherText, setLossOtherText] = useState('');

  async function handleStatusChange(orderId: number, newStatus: OrderStatus) {
    setMovingOrderId(null);
    // If cancelling — show loss reason modal first
    if (newStatus === 'cancelled') {
      setLossModal({ orderId });
      setLossReason('');
      setLossOtherText('');
      return;
    }
    await updateOrderStatus(orderId, newStatus);
  }

  async function updateOrderStatus(orderId: number, newStatus: OrderStatus, loss_reason?: string) {
    try {
      const body: Record<string, string> = { status: newStatus };
      if (loss_reason) body.loss_reason = loss_reason;
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  async function handleLossSubmit() {
    if (!lossModal || !lossReason) return;
    const reason = lossReason === 'other' ? lossOtherText || 'Другое' : lossReason;
    await updateOrderStatus(lossModal.orderId, 'cancelled', reason);
    setLossModal(null);
  }

  const cancelledOrders = getOrdersByStatus('cancelled');

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Заказы</h1>
          <div className="flex gap-2">
            <a
              href="/api/export/orders"
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
            >
              Скачать Excel
            </a>
            <Link
              href="/orders/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              Новый заказ
            </Link>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-gray-200 rounded-lg p-1 w-fit">
          <Link
            href="/orders"
            className="px-4 py-1.5 rounded-md text-sm font-medium text-gray-900 hover:bg-white transition"
          >
            Таблица
          </Link>
          <span className="px-4 py-1.5 rounded-md text-sm font-medium bg-white text-gray-900 shadow-sm">
            Канбан
          </span>
        </div>

        {/* Kanban board */}
        {loading ? (
          <div className="text-gray-500">Загрузка...</div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
              {STATUS_COLUMNS.map((status) => {
                const columnOrders = getOrdersByStatus(status);
                const colorClass = STATUS_COLORS[status].split(' ')[1];
                return (
                  <div
                    key={status}
                    className="min-w-[220px] max-w-[260px] bg-gray-50 rounded-xl p-3 flex flex-col"
                  >
                    {/* Column header */}
                    <div
                      className={`border-t-4 ${STATUS_COLORS[status].split(' ')[0]} rounded-t-sm -mt-3 -mx-3 px-3 pt-3 mb-3`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {ORDER_STATUS_LABELS[status]}
                        </h3>
                        <span
                          className={`text-xs font-bold text-white rounded-full w-6 h-6 flex items-center justify-center ${colorClass}`}
                        >
                          {columnOrders.length}
                        </span>
                      </div>
                    </div>

                    {/* Cards */}
                    <div className="space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
                      {columnOrders.map((order) => (
                        <div
                          key={order.id}
                          className={`bg-white rounded-lg shadow-sm p-3 border-l-4 ${CARD_BORDER_COLORS[status]} hover:shadow-md transition relative`}
                        >
                          <div className="flex items-start justify-between">
                            <Link
                              href={`/orders/${order.id}`}
                              className="text-sm font-semibold text-blue-600 hover:underline"
                            >
                              #{order.id}
                            </Link>
                            {/* Move button */}
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setMovingOrderId(
                                    movingOrderId === order.id ? null : order.id
                                  )
                                }
                                className="text-gray-400 hover:text-gray-900 text-sm px-1 rounded hover:bg-gray-100"
                                title="Изменить статус"
                              >
                                &rarr;
                              </button>
                              {movingOrderId === order.id && (
                                <div className="absolute right-0 top-6 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-48">
                                  {STATUS_COLUMNS.filter((s) => s !== status)
                                    .concat(['cancelled' as OrderStatus])
                                    .map((s) => (
                                      <button
                                        key={s}
                                        onClick={() =>
                                          handleStatusChange(order.id, s)
                                        }
                                        className="w-full text-left px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-50 flex items-center gap-2"
                                      >
                                        <span
                                          className={`w-2 h-2 rounded-full ${STATUS_COLORS[s].split(' ')[1]}`}
                                        />
                                        {ORDER_STATUS_LABELS[s]}
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-1.5 text-sm text-gray-900">
                            {order.client_name || '\u2014'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {PRODUCT_TYPE_LABELS[order.product_type]}
                          </div>
                          <div className="text-sm font-medium text-gray-900 mt-1.5">
                            {order.amount.toLocaleString('ru-RU')} {'\u20B8'}
                          </div>
                          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                            <span>{order.manager_name || '\u2014'}</span>
                            <span>
                              {new Date(order.created_at).toLocaleDateString(
                                'ru-RU'
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                      {columnOrders.length === 0 && (
                        <div className="text-xs text-gray-400 text-center py-4">
                          Нет заказов
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cancelled orders section */}
        {cancelledOrders.length > 0 && (
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
              {ORDER_STATUS_LABELS.cancelled} ({cancelledOrders.length})
            </button>
            {showCancelled && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {cancelledOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`bg-white rounded-lg shadow-sm p-3 border-l-4 ${CARD_BORDER_COLORS.cancelled} opacity-60`}
                  >
                    <div className="flex items-start justify-between">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-sm font-semibold text-blue-600 hover:underline"
                      >
                        #{order.id}
                      </Link>
                      <div className="relative">
                        <button
                          onClick={() =>
                            setMovingOrderId(
                              movingOrderId === order.id ? null : order.id
                            )
                          }
                          className="text-gray-400 hover:text-gray-900 text-sm px-1 rounded hover:bg-gray-100"
                          title="Изменить статус"
                        >
                          &rarr;
                        </button>
                        {movingOrderId === order.id && (
                          <div className="absolute right-0 top-6 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-48">
                            {STATUS_COLUMNS.map((s) => (
                              <button
                                key={s}
                                onClick={() =>
                                  handleStatusChange(order.id, s)
                                }
                                className="w-full text-left px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${STATUS_COLORS[s].split(' ')[1]}`}
                                />
                                {ORDER_STATUS_LABELS[s]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 text-sm text-gray-900">
                      {order.client_name || '\u2014'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {PRODUCT_TYPE_LABELS[order.product_type]}
                    </div>
                    <div className="text-sm font-medium text-gray-900 mt-1.5">
                      {order.amount.toLocaleString('ru-RU')} {'\u20B8'}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>{order.manager_name || '\u2014'}</span>
                      <span>
                        {new Date(order.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Click outside to close dropdown */}
      {movingOrderId !== null && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setMovingOrderId(null)}
        />
      )}
      {/* Loss reason modal */}
      {lossModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Причина отмены заказа</h2>
            <p className="text-sm text-gray-500 mb-4">Выберите причину отмены для аналитики</p>
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
                Отменить заказ
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
