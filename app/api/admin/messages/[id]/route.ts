import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import {
  getMessageById,
  setReadStatus,
  setRepliedStatus,
  deleteMessage,
} from '@/lib/messages'

async function requireAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

// ─── PATCH /api/admin/messages/[id] ──────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  let updated = null

  if (typeof body.read === 'boolean') {
    updated = await setReadStatus(id, body.read)
  } else if (typeof body.replied === 'boolean') {
    updated = await setRepliedStatus(id, body.replied)
  } else {
    return NextResponse.json(
      { error: 'Body must contain read (boolean) or replied (boolean)' },
      { status: 400 },
    )
  }

  if (!updated) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  return NextResponse.json({ message: updated })
}

// ─── DELETE /api/admin/messages/[id] ─────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const ok = await deleteMessage(id)
  if (!ok) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}

// ─── GET /api/admin/messages/[id] ────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const message = await getMessageById(id)
  if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  return NextResponse.json({ message })
}
