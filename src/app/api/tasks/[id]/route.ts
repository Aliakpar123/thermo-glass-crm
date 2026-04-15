import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sql = await getDb();
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      description,
      task_type,
      priority,
      due_date,
      status,
      assigned_to,
      assigned_to_name,
      order_id,
      client_id,
    } = body;

    // If marking as completed, set completed_at
    if (status === 'completed') {
      const result = await sql`
        UPDATE tasks SET
          status = 'completed',
          completed_at = NOW()
        WHERE id = ${Number(id)}
        RETURNING *
      `;
      if (result.length === 0) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json(result[0]);
    }

    // If reopening
    if (status === 'pending') {
      const result = await sql`
        UPDATE tasks SET
          status = 'pending',
          completed_at = NULL
        WHERE id = ${Number(id)}
        RETURNING *
      `;
      if (result.length === 0) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json(result[0]);
    }

    // General update
    const result = await sql`
      UPDATE tasks SET
        title = COALESCE(${title || null}, title),
        description = COALESCE(${description !== undefined ? description : null}, description),
        task_type = COALESCE(${task_type || null}, task_type),
        priority = COALESCE(${priority || null}, priority),
        due_date = COALESCE(${due_date || null}, due_date),
        assigned_to = COALESCE(${assigned_to ? Number(assigned_to) : null}, assigned_to),
        assigned_to_name = COALESCE(${assigned_to_name || null}, assigned_to_name),
        order_id = COALESCE(${order_id !== undefined ? order_id : null}, order_id),
        client_id = COALESCE(${client_id !== undefined ? client_id : null}, client_id)
      WHERE id = ${Number(id)}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sql = await getDb();
    const { id } = await params;

    await sql`DELETE FROM tasks WHERE id = ${Number(id)}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
