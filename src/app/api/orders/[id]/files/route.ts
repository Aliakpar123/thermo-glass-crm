import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;

    const files = await sql`
      SELECT * FROM deal_files
      WHERE order_id = ${Number(id)}
      ORDER BY created_at DESC
    `;

    return NextResponse.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;
    const body = await request.json();
    const { file_name, file_data, file_type, uploaded_by, uploaded_by_name } = body;

    if (!file_name || !file_data) {
      return NextResponse.json({ error: 'file_name and file_data are required' }, { status: 400 });
    }

    // Check size: base64 string length * 0.75 gives approximate byte size
    const approxBytes = file_data.length * 0.75;
    if (approxBytes > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO deal_files (order_id, file_name, file_url, file_type, uploaded_by, uploaded_by_name)
      VALUES (${Number(id)}, ${file_name}, ${file_data}, ${file_type || ''}, ${uploaded_by || null}, ${uploaded_by_name || ''})
      RETURNING *
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
