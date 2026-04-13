import { OrderStatus, ORDER_STATUS_LABELS } from '@/types';

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  measurement: 'bg-cyan-100 text-cyan-800',
  sent_to_factory: 'bg-violet-100 text-violet-800',
  calculation: 'bg-orange-100 text-orange-800',
  approved: 'bg-purple-100 text-purple-800',
  paid: 'bg-green-100 text-green-800',
  factory: 'bg-indigo-100 text-indigo-800',
  delivery: 'bg-sky-100 text-sky-800',
  installation: 'bg-teal-100 text-teal-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}`}>
      {ORDER_STATUS_LABELS[status] || status}
    </span>
  );
}
