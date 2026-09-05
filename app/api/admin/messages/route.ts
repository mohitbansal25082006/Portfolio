import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import { getAllMessages, deleteMessages, getMessageStats } from '@/lib/messages'

async function requireAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

// ─── GET /api/admin/messages ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.toLowerCase().trim() ?? ''
  const filter = searchParams.get('filter') ?? 'all'

  let messages = await getAllMessages()

  if (filter === 'unread') messages = messages.filter(m => !m.read)
  else if (filter === 'read') messages = messages.filter(m => m.read)
  else if (filter === 'replied') messages = messages.filter(m => m.replied)

  if (search) {
    messages = messages.filter(
      m =>
        m.name.toLowerCase().includes(search) ||
        m.email.toLowerCase().includes(search) ||
        m.subject.toLowerCase().includes(search) ||
        m.message.toLowerCase().includes(search),
    )
  }

  const stats = await getMessageStats()
  return NextResponse.json({ messages, stats })
}

// ─── DELETE /api/admin/messages ──────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }

  const deleted = await deleteMessages(ids)
  const stats = await getMessageStats()
  return NextResponse.json({ deleted, stats })
}
