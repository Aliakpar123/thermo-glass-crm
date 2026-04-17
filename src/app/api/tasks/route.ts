import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';

export async function GET(request: NextRequest) {
  try {
    const sql = await getDb();
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json([]);

    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get('assigned_to') || '';
    const createdBy = searchParams.get('created_by') || '';
    const status = searchParams.get('status') || '';
    const orderId = searchParams.get('order_id') || '';

    let tasks;

    if (orderId) {
      tasks = await sql`
        SELECT * FROM tasks
        WHERE order_id = ${Number(orderId)} AND company_id = ${companyId}
        ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, due_date ASC NULLS LAST, created_at DESC
      `;
    } else if (status === 'completed') {
      tasks = await sql`
        SELECT * FROM tasks
        WHERE status = 'completed' AND company_id = ${companyId}
          AND (${assignedTo} = '' OR assigned_to = ${assignedTo === '' ? 0 : Number(assignedTo)})
          AND (${createdBy} = '' OR created_by = ${createdBy === '' ? 0 : Number(createdBy)})
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
      `;
    } else if (status === 'overdue') {
      tasks = await sql`
        SELECT * FROM tasks
        WHERE status = 'pending' AND due_date < NOW() AND company_id = ${companyId}
          AND (${assignedTo} = '' OR assigned_to = ${assignedTo === '' ? 0 : Number(assignedTo)})
          AND (${createdBy} = '' OR created_by = ${createdBy === '' ? 0 : Number(createdBy)})
        ORDER BY due_date ASC NULLS LAST
      `;
    } else {
      // Default: pending tasks
      tasks = await sql`
        SELECT * FROM tasks
        WHERE status = 'pending' AND company_id = ${companyId}
          AND (${assignedTo} = '' OR assigned_to = ${assignedTo === '' ? 0 : Number(assignedTo)})
          AND (${createdBy} = '' OR created_by = ${createdBy === '' ? 0 : Number(createdBy)})
        ORDER BY due_date ASC NULLS LAST, created_at DESC
      `;
    }

    // Mark overdue in response
    const now = new Date();
    const tasksWithOverdue = tasks.map((t: Record<string, unknown>) => ({
      ...t,
      is_overdue: t.status === 'pending' && t.due_date && new Date(t.due_date as string) < now,
    }));

    return NextResponse.json(tasksWithOverdue);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = await getDb();
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json({ error: 'No active company' }, { status: 403 });

    const body = await request.json();
    const {
      title,
      description,
      task_type,
      priority,
      due_date,
      order_id,
      client_id,
      assigned_to,
      assigned_to_name,
      created_by,
      created_by_name,
    } = body;

    if (!title || !assigned_to || !created_by) {
      return NextResponse.json({ error: 'Title, assigned_to, and created_by are required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO tasks (title, description, task_type, priority, due_date, order_id, client_id, assigned_to, assigned_to_name, created_by, created_by_name, company_id)
      VALUES (
        ${title},
        ${description || ''},
        ${task_type || 'other'},
        ${priority || 'normal'},
        ${due_date || null},
        ${order_id || null},
        ${client_id || null},
        ${Number(assigned_to)},
        ${assigned_to_name || ''},
        ${Number(created_by)},
        ${created_by_name || ''},
        ${companyId}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
