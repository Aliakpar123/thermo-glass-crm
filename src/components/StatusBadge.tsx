import { OrderStatus, ORDER_STATUS_LABELS } from '@/types';

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-blue-50 text-blue-700 border border-blue-100',
  contacted: 'bg-amber-50 text-amber-700 border border-amber-100',
  measurement: 'bg-cyan-50 text-cyan-700 border border-cyan-100',
  sent_to_factory: 'bg-violet-50 text-violet-700 border border-violet-100',
  calculation: 'bg-orange-50 text-orange-700 border border-orange-100',
  approved: 'bg-purple-50 text-purple-700 border border-purple-100',
  paid: 'bg-green-50 text-green-700 border border-green-100',
  factory: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  delivery: 'bg-sky-50 text-sky-700 border border-sky-100',
  installation: 'bg-teal-50 text-teal-700 border border-teal-100',
  completed: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  cancelled: 'bg-red-50 text-red-700 border border-red-100',
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_COLORS[status] || 'bg-gray-50 text-gray-700 border border-gray-100'}`}>
      {ORDER_STATUS_LABELS[status] || status}
    </span>
  );
}
