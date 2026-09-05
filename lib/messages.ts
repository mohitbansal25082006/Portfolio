/**
 * lib/messages.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Dual-backend message store for contact form submissions.
 *
 * Backend selection (automatic, no config needed locally):
 *   • Production (Vercel)  → Upstash Redis via @upstash/redis
 *                            Requires: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *                            (Vercel injects these automatically when you link the store)
 *   • Local dev / fallback → JSON file at .data/portfolio-messages.json
 *
 * All public functions are async so callers use `await` uniformly regardless
 * of which backend is active.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { randomUUID } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContactMessage {
  id: string
  name: string
  email: string
  subject: string
  message: string
  timestamp: string   // ISO-8601
  read: boolean
  replied: boolean
}

// Single Redis key that holds the entire messages array as JSON.
// For a personal portfolio the total will stay tiny (< a few hundred),
// so one serialised blob is simpler and cheaper than hash-per-message.
const KV_KEY = 'portfolio:messages'

// ─── Backend detection ────────────────────────────────────────────────────────

function hasUpstash(): boolean {
  return !!(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN
  )
}

// ─── Upstash Redis backend ────────────────────────────────────────────────────

async function getRedis() {
  const { Redis } = await import('@upstash/redis')
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  })
}

async function kvReadAll(): Promise<ContactMessage[]> {
  const redis = await getRedis()
  const data = await redis.get<ContactMessage[]>(KV_KEY)
  return data ?? []
}

async function kvWriteAll(messages: ContactMessage[]): Promise<void> {
  const redis = await getRedis()
  await redis.set(KV_KEY, messages)
}

// ─── Local JSON-file fallback backend ────────────────────────────────────────

async function fileReadAll(): Promise<ContactMessage[]> {
  const fs = await import('fs')
  const path = await import('path')

  const dir = path.join(process.cwd(), '.data')
  const file = process.env.MESSAGES_FILE ?? path.join(dir, 'portfolio-messages.json')

  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    if (!fs.existsSync(file)) return []
    const raw = fs.readFileSync(file, 'utf-8').trim()
    if (!raw) return []
    return JSON.parse(raw) as ContactMessage[]
  } catch {
    return []
  }
}

async function fileWriteAll(messages: ContactMessage[]): Promise<void> {
  const fs = await import('fs')
  const path = await import('path')

  const dir = path.join(process.cwd(), '.data')
  const file = process.env.MESSAGES_FILE ?? path.join(dir, 'portfolio-messages.json')

  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(messages, null, 2), 'utf-8')
}

// ─── Unified read / write (picks backend automatically) ──────────────────────

async function readAll(): Promise<ContactMessage[]> {
  return hasUpstash() ? kvReadAll() : fileReadAll()
}

async function writeAll(messages: ContactMessage[]): Promise<void> {
  return hasUpstash() ? kvWriteAll(messages) : fileWriteAll(messages)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Save a new message from the contact form. Returns the saved record. */
export async function saveMessage(data: {
  name: string
  email: string
  subject: string
  message: string
}): Promise<ContactMessage> {
  const messages = await readAll()
  const record: ContactMessage = {
    id: randomUUID(),
    ...data,
    timestamp: new Date().toISOString(),
    read: false,
    replied: false,
  }
  messages.unshift(record) // newest first
  await writeAll(messages)
  return record
}

/** Return all messages, newest first. */
export async function getAllMessages(): Promise<ContactMessage[]> {
  return readAll()
}

/** Return a single message by id, or null. */
export async function getMessageById(id: string): Promise<ContactMessage | null> {
  const messages = await readAll()
  return messages.find(m => m.id === id) ?? null
}

/** Mark a message read or unread. Returns updated record or null if not found. */
export async function setReadStatus(id: string, read: boolean): Promise<ContactMessage | null> {
  const messages = await readAll()
  const idx = messages.findIndex(m => m.id === id)
  if (idx === -1) return null
  messages[idx].read = read
  await writeAll(messages)
  return messages[idx]
}

/** Mark a message as replied. Returns updated record or null if not found. */
export async function setRepliedStatus(id: string, replied: boolean): Promise<ContactMessage | null> {
  const messages = await readAll()
  const idx = messages.findIndex(m => m.id === id)
  if (idx === -1) return null
  messages[idx].replied = replied
  await writeAll(messages)
  return messages[idx]
}

/** Delete a message by id. Returns true if deleted, false if not found. */
export async function deleteMessage(id: string): Promise<boolean> {
  const messages = await readAll()
  const next = messages.filter(m => m.id !== id)
  if (next.length === messages.length) return false
  await writeAll(next)
  return true
}

/** Delete multiple messages. Returns count of deleted. */
export async function deleteMessages(ids: string[]): Promise<number> {
  const messages = await readAll()
  const set = new Set(ids)
  const next = messages.filter(m => !set.has(m.id))
  const deleted = messages.length - next.length
  if (deleted > 0) await writeAll(next)
  return deleted
}

/** Stats summary. */
export async function getMessageStats(): Promise<{
  total: number
  unread: number
  read: number
  replied: number
}> {
  const messages = await readAll()
  const unread = messages.filter(m => !m.read).length
  const replied = messages.filter(m => m.replied).length
  return { total: messages.length, unread, read: messages.length - unread, replied }
}
