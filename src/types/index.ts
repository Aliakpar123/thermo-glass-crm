export type UserRole = 'admin' | 'order_manager' | 'client_manager';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export type LeadSource = 'whatsapp' | 'instagram' | 'website' | 'phone' | 'referral' | 'other';
export type LeadStatus = 'new' | 'contacted' | 'converted' | 'lost';

export interface Lead {
  id: number;
  name: string;
  phone: string;
  source: LeadSource;
  message: string;
  status: LeadStatus;
  assigned_to: number | null;
  loss_reason: string;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  source: LeadSource;
  notes: string;
  assigned_manager_id: number | null;
  created_at: string;
  updated_at: string;
}

export type ProductType = 'steklopaket' | 'krovlya' | 'dver' | 'pol' | 'zenitniy_fonar' | 'mansardnoe_okno' | 'zimniy_sad' | 'carbon_glass' | 'other';

export type OrderStatus = 'new' | 'calculation' | 'approved' | 'factory' | 'production' | 'delivery' | 'installation' | 'completed' | 'cancelled';

export interface Order {
  id: number;
  client_id: number;
  manager_id: number;
  product_type: ProductType;
  description: string;
  dimensions: string;
  quantity: number;
  amount: number;
  prepayment: number;
  status: OrderStatus;
  factory_order_number: string;
  loss_reason: string;
  created_at: string;
  updated_at: string;
  client_name?: string;
  manager_name?: string;
}

export interface OrderHistory {
  id: number;
  order_id: number;
  status: OrderStatus;
  changed_by: number;
  comment: string;
  created_at: string;
  user_name?: string;
}

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  steklopaket: 'Стеклопакет с электрообогревом',
  krovlya: 'Стеклянная кровля',
  dver: 'Дверь с обогреваемым стеклом',
  pol: 'Стеклянный пол',
  zenitniy_fonar: 'Зенитный фонарь',
  mansardnoe_okno: 'Мансардное окно',
  zimniy_sad: 'Зимний сад',
  carbon_glass: 'Carbon Glass',
  other: 'Другое',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  calculation: 'Расчёт',
  approved: 'Согласован',
  factory: 'Отправлен на завод',
  production: 'В производстве',
  delivery: 'Доставка',
  installation: 'Монтаж',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  website: 'Сайт',
  phone: 'Звонок',
  referral: 'Рекомендация',
  other: 'Другое',
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Новая',
  contacted: 'Связались',
  converted: 'Конвертирована',
  lost: 'Потеряна',
};

export const LOSS_REASON_LABELS: Record<string, string> = {
  expensive: 'Дорого',
  competitor: 'Выбрал конкурента',
  changed_mind: 'Передумал',
  no_answer: 'Не отвечает',
  slow: 'Долгие сроки',
  other: 'Другое',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  order_manager: 'Менеджер заявок',
  client_manager: 'Менеджер клиентов',
};
