'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import VoiceRecorder from '@/components/VoiceRecorder';
import {
  TASK_TYPE_LABELS,
  TASK_TYPE_ICONS,
  TASK_PRIORITY_LABELS,
} from '@/types';

interface Task {
  id: number;
  title: string;
  description: string;
  task_type: string;
  priority: string;
  status: string;
  due_date: string | null;
  order_id: number | null;
  client_id: number | null;
  assigned_to: number;
  assigned_to_name: string;
  created_by: number;
  created_by_name: string;
  completed_at: string | null;
  created_at: string;
  is_overdue?: boolean;
}

interface StaffMember {
  id: number;
  name: string;
  role: string;
}

interface DealOption {
  id: number;
  client_name: string;
  description: string;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} мин`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 день';
  if (days < 7) return `${days} дн`;
  const weeks = Math.floor(days / 7);
  return `${weeks} нед`;
}

function formatDueDate(dateStr: string | null): { text: string; color: string } {
  if (!dateStr) return { text: '', color: 'text-gray-400' };
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((dueDay.getTime() - today.getTime()) / 86400000);

  const formatted = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (diffDays < 0) return { text: `До: ${formatted}`, color: 'text-red-500 font-medium' };
  if (diffDays === 0) return { text: `До: сегодня`, color: 'text-orange-500 font-medium' };
  if (diffDays === 1) return { text: `До: завтра`, color: 'text-gray-500' };
  return { text: `До: ${formatted}`, color: 'text-gray-400' };
}

export default function TasksPage() {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id || '';
  const userName = session?.user?.name || '';
  const userRole = (session?.user as { role?: string })?.role || '';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'my' | 'created' | 'all'>('my');
  const [subFilter, setSubFilter] = useState<'active' | 'completed' | 'overdue'>('active');

  // New task modal
  const [showModal, setShowModal] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    task_type: 'other',
    priority: 'normal',
    due_date: '',
    assigned_to: '',
    order_id: '',
  });
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    task_type: 'other',
    priority: 'normal',
    due_date: '',
    assigned_to: '',
    order_id: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Deal search
  const [dealSearch, setDealSearch] = useState('');

  useEffect(() => {
    fetch('/api/staff?period=all')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setStaff(data.map((s: Record<string, unknown>) => ({ id: Number(s.id), name: String(s.name), role: String(s.role) }))); })
      .catch(() => {});

    fetch('/api/orders')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDeals(data.map((d: Record<string, unknown>) => ({
            id: Number(d.id),
            client_name: String(d.client_name || ''),
            description: String(d.description || ''),
          })));
        }
      })
      .catch(() => {});
  }, []);

  const fetchTasks = () => {
    if (!userId) return;
    setLoading(true);
    const params = new URLSearchParams();

    if (tab === 'my') {
      params.set('assigned_to', userId);
    } else if (tab === 'created') {
      params.set('created_by', userId);
    }
    // 'all' - no user filter

    if (subFilter === 'completed') {
      params.set('status', 'completed');
    } else if (subFilter === 'overdue') {
      params.set('status', 'overdue');
    }
    // 'active' = pending (default)

    fetch(`/api/tasks?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTasks(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tab, subFilter]);

  const handleCreate = async () => {
    if (!newTask.title || !newTask.assigned_to) return;
    setSaving(true);
    const assignee = staff.find((s) => s.id === Number(newTask.assigned_to));
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description,
          task_type: newTask.task_type,
          priority: newTask.priority,
          due_date: newTask.due_date || null,
          order_id: newTask.order_id ? Number(newTask.order_id) : null,
          assigned_to: Number(newTask.assigned_to),
          assigned_to_name: assignee?.name || '',
          created_by: Number(userId),
          created_by_name: userName,
        }),
      });
      setShowModal(false);
      setNewTask({ title: '', description: '', task_type: 'other', priority: 'normal', due_date: '', assigned_to: '', order_id: '' });
      fetchTasks();
    } catch {
      // ignore
    }
    setSaving(false);
  };

  const handleComplete = async (taskId: number) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      fetchTasks();
    } catch {
      // ignore
    }
  };

  const handleReopen = async (taskId: number) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      });
      fetchTasks();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!confirm('Удалить задачу?')) return;
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      fetchTasks();
    } catch {
      // ignore
    }
  };

  const openEditModal = (task: Task) => {
    setEditTask(task);
    setEditForm({
      title: task.title,
      description: task.description,
      task_type: task.task_type,
      priority: task.priority,
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      assigned_to: String(task.assigned_to),
      order_id: task.order_id ? String(task.order_id) : '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editTask || !editForm.title || !editForm.assigned_to) return;
    setSavingEdit(true);
    const assignee = staff.find((s) => s.id === Number(editForm.assigned_to));
    try {
      await fetch(`/api/tasks/${editTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          task_type: editForm.task_type,
          priority: editForm.priority,
          due_date: editForm.due_date || null,
          assigned_to: Number(editForm.assigned_to),
          assigned_to_name: assignee?.name || '',
          order_id: editForm.order_id ? Number(editForm.order_id) : null,
        }),
      });
      setShowEditModal(false);
      setEditTask(null);
      fetchTasks();
    } catch {
      // ignore
    }
    setSavingEdit(false);
  };

  const filteredDeals = dealSearch
    ? deals.filter((d) =>
        `#${d.id} ${d.client_name} ${d.description}`.toLowerCase().includes(dealSearch.toLowerCase())
      ).slice(0, 10)
    : deals.slice(0, 10);

  const priorityBadge = (priority: string) => {
    if (priority === 'urgent') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">СРОЧНО</span>;
    if (priority === 'important') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">ВАЖНО</span>;
    return null;
  };

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Задачи</h1>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[#22c55e] text-white rounded-lg text-sm font-medium hover:bg-[#16a34a] transition"
          >
            + Новая задача
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('my')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === 'my' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Мои задачи
          </button>
          <button
            onClick={() => setTab('created')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === 'created' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Поставленные мной
          </button>
          {userRole === 'admin' && (
            <button
              onClick={() => setTab('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                tab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Все
            </button>
          )}
        </div>

        {/* Sub-filters */}
        <div className="flex items-center gap-3 mb-6">
          {(['active', 'completed', 'overdue'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setSubFilter(f)}
              className={`text-sm font-medium pb-1 transition ${
                subFilter === f
                  ? 'text-[#22c55e] border-b-2 border-[#22c55e]'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {f === 'active' ? 'Активные' : f === 'completed' ? 'Выполненные' : 'Просроченные'}
            </button>
          ))}
        </div>

        {/* Task list */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Загрузка...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-400 text-sm">Нет задач</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const due = formatDueDate(task.due_date);
              const typeIcon = TASK_TYPE_ICONS[task.task_type] || '📋';
              const typeLabel = TASK_TYPE_LABELS[task.task_type] || 'Другое';
              return (
                <div
                  key={task.id}
                  className={`bg-white rounded-xl shadow-sm border p-4 transition hover:shadow-md ${
                    task.status === 'completed' ? 'opacity-60 border-gray-100' : task.is_overdue ? 'border-red-200' : 'border-gray-100'
                  }`}
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {priorityBadge(task.priority)}
                      <span className="text-sm text-gray-500">{typeIcon} {typeLabel}</span>
                    </div>
                    {due.text && (
                      <span className={`text-xs ${due.color}`}>{due.text}</span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className={`text-sm font-semibold text-gray-900 mb-1 ${task.status === 'completed' ? 'line-through' : ''}`}>
                    {task.title}
                  </h3>

                  {/* Description */}
                  {task.description && (
                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
                  )}

                  {/* Linked deal */}
                  {task.order_id && (
                    <div className="mb-2">
                      <Link
                        href={`/deals/${task.order_id}`}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Сделка #{task.order_id}
                        {deals.find((d) => d.id === task.order_id)
                          ? ` ${deals.find((d) => d.id === task.order_id)?.client_name}`
                          : ''}
                      </Link>
                    </div>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <span>👤 {task.assigned_to_name || '?'}</span>
                      <span className="mx-1">←</span>
                      <span>назначил {task.created_by_name || '?'}</span>
                      <span className="mx-1">·</span>
                      <span>{timeAgo(task.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {task.status === 'pending' ? (
                        <button
                          onClick={() => handleComplete(task.id)}
                          className="px-3 py-1.5 bg-[#22c55e] text-white rounded-lg text-xs font-medium hover:bg-[#16a34a] transition"
                        >
                          Выполнено
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReopen(task.id)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition"
                        >
                          Вернуть
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(task)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition"
                      >
                        Изменить
                      </button>
                      {userRole === 'admin' && (
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="px-2 py-1.5 text-red-400 hover:text-red-600 text-xs transition"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Task Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Новая задача</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>

              <div className="space-y-4">
                {/* Assigned to */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Кому</label>
                  <select
                    value={newTask.assigned_to}
                    onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  >
                    <option value="">Выберите сотрудника</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Заголовок</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Что нужно сделать?"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>

                {/* Description */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-900">Описание</label>
                    <VoiceRecorder
                      onTranscript={(text) => {
                        setNewTask(prev => ({ ...prev, description: prev.description ? prev.description + ' ' + text : text }));
                      }}
                    />
                  </div>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    rows={2}
                    placeholder="Подробности..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Тип</label>
                    <select
                      value={newTask.task_type}
                      onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    >
                      {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{TASK_TYPE_ICONS[k]} {v}</option>
                      ))}
                    </select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Приоритет</label>
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    >
                      {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Due date */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Срок</label>
                  <input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>

                {/* Deal */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Сделка (необязательно)</label>
                  <input
                    type="text"
                    value={dealSearch}
                    onChange={(e) => setDealSearch(e.target.value)}
                    placeholder="Поиск сделки..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e] mb-1"
                  />
                  {newTask.order_id && (
                    <div className="flex items-center gap-2 text-xs text-gray-900 mb-1">
                      <span>Выбрано: #{newTask.order_id} {deals.find((d) => d.id === Number(newTask.order_id))?.client_name}</span>
                      <button onClick={() => setNewTask({ ...newTask, order_id: '' })} className="text-red-400 hover:text-red-600">&times;</button>
                    </div>
                  )}
                  <div className="max-h-32 overflow-y-auto border border-gray-100 rounded-lg">
                    {filteredDeals.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => { setNewTask({ ...newTask, order_id: String(d.id) }); setDealSearch(''); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition ${
                          String(d.id) === newTask.order_id ? 'bg-green-50 text-green-700' : 'text-gray-900'
                        }`}
                      >
                        #{d.id} {d.client_name} {d.description ? `· ${d.description.slice(0, 40)}` : ''}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCreate}
                  disabled={saving || !newTask.title || !newTask.assigned_to}
                  className="w-full py-2.5 bg-[#22c55e] text-white rounded-lg text-sm font-medium hover:bg-[#16a34a] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Создаём...' : 'Создать задачу'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Task Modal */}
        {showEditModal && editTask && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Редактировать задачу</h2>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Кому</label>
                  <select
                    value={editForm.assigned_to}
                    onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  >
                    <option value="">Выберите сотрудника</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Заголовок</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-900">Описание</label>
                    <VoiceRecorder
                      onTranscript={(text) => {
                        setEditForm(prev => ({ ...prev, description: prev.description ? prev.description + ' ' + text : text }));
                      }}
                    />
                  </div>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Тип</label>
                    <select
                      value={editForm.task_type}
                      onChange={(e) => setEditForm({ ...editForm, task_type: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    >
                      {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{TASK_TYPE_ICONS[k]} {v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Приоритет</label>
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    >
                      {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Срок</label>
                  <input
                    type="date"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>

                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editForm.title || !editForm.assigned_to}
                  className="w-full py-2.5 bg-[#22c55e] text-white rounded-lg text-sm font-medium hover:bg-[#16a34a] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingEdit ? 'Сохраняем...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
