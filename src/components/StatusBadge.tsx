import { OrderStatus, ORDER_STATUS_LABELS } from '@/types';

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  calculation: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  factory: 'bg-purple-100 text-purple-800',
  production: 'bg-orange-100 text-orange-800',
  delivery: 'bg-indigo-100 text-indigo-800',
  installation: 'bg-teal-100 text-teal-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
