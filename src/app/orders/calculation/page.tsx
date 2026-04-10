'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';

interface ItemRow {
  width: number | '';
  height: number | '';
  qty: number | '';
  area: number;
  heating: string;
  chambers: string;
  thickness: string;
}

const emptyRow = (): ItemRow => ({
  width: '',
  height: '',
  qty: '',
  area: 0,
  heating: '',
  chambers: '',
  thickness: '',
});

function CalculationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get('lead_id');
  const clientId = searchParams.get('client_id');
  const clientName = searchParams.get('client_name') || '';
  const clientPhone = searchParams.get('client_phone') || '';

  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ItemRow[]>([emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow()]);

  const [form, setForm] = useState({
    object_city: '',
    heating_type: 'Основное',
    required_power: '',
    multifunctional_glass: 'нет',
    glass_color: 'прозрачная',
    room_type: 'Квартира',
    room_area: '',
  });

  // Auto-calculate area when width/height/qty changes
  const updateItem = (index: number, field: keyof ItemRow, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // Recalculate area
      const w = Number(item.width) || 0;
      const h = Number(item.height) || 0;
      const q = Number(item.qty) || 0;
      item.area = w > 0 && h > 0 ? Math.round((w * h * q) / 1_000_000 * 100) / 100 : 0;

      updated[index] = item;
      return updated;
    });
  };

  const totalArea = items.reduce((sum, item) => sum + item.area, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out empty rows
    const filledItems = items.filter((item) => item.width || item.height);
    if (filledItems.length === 0) {
      alert('Заполните хотя бы одну позицию');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: Number(clientId),
          lead_id: leadId ? Number(leadId) : null,
          product_type: 'steklopaket',
          description: `Заявка на расчет: ${clientName}`,
          object_city: form.object_city,
          items_json: JSON.stringify(filledItems),
          heating_type: form.heating_type,
          required_power: Number(form.required_power) || 0,
          multifunctional_glass: form.multifunctional_glass,
          glass_color: form.glass_color,
          room_type: form.room_type,
          room_area: Number(form.room_area) || 0,
          total_area: Math.round(totalArea * 100) / 100,
          quantity: filledItems.reduce((s, i) => s + (Number(i.qty) || 0), 0),
          amount: 0,
          prepayment: 0,
        }),
      });

      if (res.ok) {
        // Update lead status to converted if came from a lead
        if (leadId) {
          await fetch(`/api/leads/${leadId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'converted' }),
          });
        }
        const order = await res.json();
        router.push(`/orders/${order.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          &larr; Назад
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Заявка на расчет</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Данные клиента</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
              <input
                type="text"
                readOnly
                value={new Date().toLocaleDateString('ru-RU')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Клиент</label>
              <input
                type="text"
                readOnly
                value={`${clientName} (${clientPhone})`}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Объект, город *</label>
              <input
                type="text"
                required
                value={form.object_city}
                onChange={(e) => setForm({ ...form, object_city: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="Квартира, Астана"
              />
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Позиции стеклопакетов</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b bg-gray-50">
                  <th className="px-2 py-2 font-medium w-10 text-center">#</th>
                  <th className="px-2 py-2 font-medium">Ширина, мм</th>
                  <th className="px-2 py-2 font-medium">Высота, мм</th>
                  <th className="px-2 py-2 font-medium">Кол-во, шт</th>
                  <th className="px-2 py-2 font-medium">Площадь, м2</th>
                  <th className="px-2 py-2 font-medium">Нагрев</th>
                  <th className="px-2 py-2 font-medium">Кол-во камер</th>
                  <th className="px-2 py-2 font-medium">Толщина СП</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-2 py-1.5 text-center text-gray-400 font-medium">{i + 1}</td>
                    <td className="px-1 py-1.5">
                      <input
                        type="number"
                        value={item.width}
                        onChange={(e) => updateItem(i, 'width', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                        placeholder="мм"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="number"
                        value={item.height}
                        onChange={(e) => updateItem(i, 'height', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                        placeholder="мм"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="number"
                        min={0}
                        value={item.qty}
                        onChange={(e) => updateItem(i, 'qty', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                        placeholder="шт"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="text-sm text-gray-700 font-medium bg-gray-50 rounded px-2 py-1.5 text-center">
                        {item.area > 0 ? item.area.toFixed(2) : '\u2014'}
                      </div>
                    </td>
                    <td className="px-1 py-1.5">
                      <select
                        value={item.heating}
                        onChange={(e) => updateItem(i, 'heating', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                      >
                        <option value="">---</option>
                        <option value="Да">Да</option>
                        <option value="Нет">Нет</option>
                      </select>
                    </td>
                    <td className="px-1 py-1.5">
                      <select
                        value={item.chambers}
                        onChange={(e) => updateItem(i, 'chambers', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                      >
                        <option value="">---</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                      </select>
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="text"
                        value={item.thickness}
                        onChange={(e) => updateItem(i, 'thickness', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                        placeholder="мм"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={4} className="px-2 py-2 text-right text-gray-700">ИТОГО:</td>
                  <td className="px-2 py-2 text-center text-blue-700">{totalArea.toFixed(2)} м2</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Additional parameters */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Дополнительные параметры</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Основное / доп. отопление</label>
              <select
                value={form.heating_type}
                onChange={(e) => setForm({ ...form, heating_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="Основное">Основное</option>
                <option value="Дополнительное">Дополнительное</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Требуемая мощность (Вт)</label>
              <input
                type="number"
                value={form.required_power}
                onChange={(e) => setForm({ ...form, required_power: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="450"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Мультифункциональное стекло</label>
              <select
                value={form.multifunctional_glass}
                onChange={(e) => setForm({ ...form, multifunctional_glass: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="нет">Нет</option>
                <option value="да">Да</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Цвет стекла</label>
              <select
                value={form.glass_color}
                onChange={(e) => setForm({ ...form, glass_color: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="прозрачная">Прозрачная</option>
                <option value="бронза">Бронза</option>
                <option value="серая">Серая</option>
                <option value="зеленая">Зеленая</option>
                <option value="голубая">Голубая</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип помещения</label>
              <select
                value={form.room_type}
                onChange={(e) => setForm({ ...form, room_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="Квартира">Квартира</option>
                <option value="Дом">Дом</option>
                <option value="Офис">Офис</option>
                <option value="Ресторан">Ресторан</option>
                <option value="ТРЦ">ТРЦ</option>
                <option value="Другое">Другое</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Площадь помещения (м2)</label>
              <input
                type="number"
                step="0.1"
                value={form.room_area}
                onChange={(e) => setForm({ ...form, room_area: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="м2"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
          >
            {saving ? 'Отправка...' : 'Создать заявку на расчет'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CalculationPage() {
  return (
    <Layout>
      <Suspense fallback={<div className="text-gray-500">Загрузка...</div>}>
        <CalculationForm />
      </Suspense>
    </Layout>
  );
}
