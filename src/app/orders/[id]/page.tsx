'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import StatusBadge from '@/components/StatusBadge';
import {
  Order,
  OrderHistory,
  OrderStatus,
  ORDER_STATUS_LABELS,
  PRODUCT_TYPE_LABELS,
  LOSS_REASON_LABELS,
} from '@/types';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newStatus, setNewStatus] = useState<OrderStatus>('new');
  const [comment, setComment] = useState('');
  const [factoryOrderNumber, setFactoryOrderNumber] = useState('');
  const [showLossModal, setShowLossModal] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [lossReasonOther, setLossReasonOther] = useState('');

  const fetchData = () => {
    Promise.all([
      fetch(`/api/orders/${id}`).then((r) => r.json()),
      fetch(`/api/orders/${id}/history`).then((r) => r.json()),
    ])
      .then(([orderData, historyData]) => {
        setOrder(orderData);
        setHistory(historyData);
        setNewStatus(orderData.status);
        setFactoryOrderNumber(orderData.factory_order_number || '');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [id]);

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
      const body: Record<string, string> = { status: newStatus, comment, ...extraFields };
      if (newStatus === 'factory' && factoryOrderNumber) {
        body.factory_order_number = factoryOrderNumber;
      }
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setComment('');
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

  if (loading) {
    return (
      <Layout>
        <div className="text-gray-500">Загрузка...</div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <div className="text-gray-500">Заказ не найден</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
            &larr; Назад
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Заказ #{order.id}</h1>
          <StatusBadge status={order.status} />
        </div>

        {/* Order Details Card */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Детали заказа</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Клиент:</span>
              <Link href={`/clients/${order.client_id}`} className="ml-2 text-blue-600 hover:underline font-medium">
                {order.client_name || `#${order.client_id}`}
              </Link>
            </div>
            <div>
              <span className="text-gray-500">Менеджер:</span>
              <span className="ml-2 font-medium">{order.manager_name || '\u2014'}</span>
            </div>
            <div>
              <span className="text-gray-500">Тип продукта:</span>
              <span className="ml-2 font-medium">{PRODUCT_TYPE_LABELS[order.product_type]}</span>
            </div>
            <div>
              <span className="text-gray-500">Размеры:</span>
              <span className="ml-2 font-medium">{order.dimensions || '\u2014'}</span>
            </div>
            <div>
              <span className="text-gray-500">Количество:</span>
              <span className="ml-2 font-medium">{order.quantity}</span>
            </div>
            <div>
              <span className="text-gray-500">Сумма:</span>
              <span className="ml-2 font-bold text-gray-900">{order.amount.toLocaleString('ru-RU')} \u20B8</span>
            </div>
            <div>
              <span className="text-gray-500">Предоплата:</span>
              <span className="ml-2 font-medium">{order.prepayment.toLocaleString('ru-RU')} \u20B8</span>
            </div>
            <div>
              <span className="text-gray-500">Остаток:</span>
              <span className="ml-2 font-medium text-orange-600">
                {(order.amount - order.prepayment).toLocaleString('ru-RU')} \u20B8
              </span>
            </div>
            {order.factory_order_number && (
              <div>
                <span className="text-gray-500">Номер заказа на заводе:</span>
                <span className="ml-2 font-medium">{order.factory_order_number}</span>
              </div>
            )}
            {order.description && (
              <div className="sm:col-span-2">
                <span className="text-gray-500">Описание:</span>
                <p className="mt-1">{order.description}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500">Создан:</span>
              <span className="ml-2">{new Date(order.created_at).toLocaleString('ru-RU')}</span>
            </div>
            <div>
              <span className="text-gray-500">Обновлён:</span>
              <span className="ml-2">{new Date(order.updated_at).toLocaleString('ru-RU')}</span>
            </div>
          </div>
        </div>

        {/* Status Change Form */}
        {order.status !== 'completed' && order.status !== 'cancelled' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Изменить статус</h2>
            <form onSubmit={handleStatusChange} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Новый статус</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  >
                    {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {newStatus === 'factory' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Номер заказа на заводе
                    </label>
                    <input
                      type="text"
                      value={factoryOrderNumber}
                      onChange={(e) => setFactoryOrderNumber(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                      placeholder="Введите номер"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
                <textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  placeholder="Добавьте комментарий к изменению статуса..."
                />
              </div>
              <button
                type="submit"
                disabled={saving || newStatus === order.status}
                className="px-5 py-2 text-sm text-white bg-[#22c55e] rounded-lg hover:bg-[#16a34a] transition disabled:opacity-50 font-medium"
              >
                {saving ? 'Сохранение...' : 'Изменить статус'}
              </button>
            </form>
          </div>
        )}

        {/* Order History Timeline */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">История изменений</h2>
          {history.length === 0 ? (
            <p className="text-gray-500 text-sm">Нет истории</p>
          ) : (
            <div className="space-y-0">
              {history.map((h, i) => (
                <div key={h.id} className="flex gap-4">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-[#22c55e] mt-1.5 shrink-0" />
                    {i < history.length - 1 && <div className="w-0.5 flex-1 bg-gray-200" />}
                  </div>
                  {/* Content */}
                  <div className="pb-6">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={h.status} />
                      <span className="text-xs text-gray-500">
                        {new Date(h.created_at).toLocaleString('ru-RU')}
                      </span>
                      {h.user_name && (
                        <span className="text-xs text-gray-400">&mdash; {h.user_name}</span>
                      )}
                    </div>
                    {h.comment && <p className="text-sm text-gray-600 mt-1">{h.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loss Reason Modal */}
      {showLossModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Причина отмены</h2>
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e] mt-1"
                  />
                )}
              </div>
              <div className="flex justify-end gap-3 pt-5">
                <button
                  type="button"
                  onClick={() => setShowLossModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={!lossReason}
                  onClick={handleLossReasonSubmit}
                  className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  Подтвердить отмену
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
