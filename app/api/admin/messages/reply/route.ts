import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import nodemailer from 'nodemailer'
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import { getMessageById, setRepliedStatus } from '@/lib/messages'

async function requireAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

/**
 * POST /api/admin/messages/reply
 * Body: { id: string; replyText: string }
 *
 * Sends a reply to the original sender via nodemailer (same Gmail creds as
 * the contact form) and marks the message as replied.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, replyText } = await req.json()

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing message id' }, { status: 400 })
  }
  if (!replyText || typeof replyText !== 'string' || !replyText.trim()) {
    return NextResponse.json({ error: 'Reply text cannot be empty' }, { status: 400 })
  }

  const original = await getMessageById(id)
  if (!original) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })

  const mailOptions = {
    from: `"Mohit Bansal" <${process.env.EMAIL_USER}>`,
    to: original.email,
    replyTo: process.env.EMAIL_USER,
    subject: `Re: ${original.subject}`,
    text: replyText.trim(),
    html: `
    <div style="font-family: 'Geist', 'Helvetica Neue', Arial, sans-serif; background: #1a1a1a; padding: 40px 0; margin: 0; color: #e4e4e7;">
      <div style="max-width: 560px; margin: 0 auto; background: #282923; border: 1px solid #3f3f46; border-radius: 16px; overflow: hidden;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #3f3f46;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td style="width: 36px; height: 36px; background: #b3ff3d; border-radius: 50%; text-align: center; vertical-align: middle; font-family: Arial, Helvetica, sans-serif; color: #282923; font-weight: 700; font-size: 14px; line-height: 36px;">
                    MB
                  </td>
                  <td style="padding-left: 12px; font-family: monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #a1a1aa; vertical-align: middle;">
                    Mohit Bansal
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <div style="padding: 32px;">
          <p style="margin: 0 0 8px; font-family: monospace; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.08em;">Hi ${original.name},</p>
          <div style="margin: 16px 0; font-size: 15px; color: #e4e4e7; line-height: 1.7; white-space: pre-wrap;">${replyText.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          <p style="margin: 24px 0 0; font-size: 13px; color: #71717a;">— Mohit Bansal</p>

          <hr style="margin: 28px 0; border: none; border-top: 1px solid #3f3f46;" />

          <p style="margin: 0 0 8px; font-family: monospace; font-size: 10px; color: #52525b; text-transform: uppercase; letter-spacing: 0.08em;">Your original message</p>
          <div style="background: #1f2024; border-radius: 8px; padding: 16px; font-size: 13px; color: #71717a; line-height: 1.6; white-space: pre-wrap;">${original.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>

        <div style="padding: 20px 32px; background: #1f2024; border-top: 1px solid #3f3f46; text-align: center;">
          <p style="margin: 0; font-family: monospace; font-size: 11px; color: #71717a; letter-spacing: 0.08em;">© ${new Date().getFullYear()} Mohit Bansal Portfolio.</p>
        </div>
      </div>
    </div>
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
    await setRepliedStatus(id, true)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reply send error:', error)
    return NextResponse.json({ error: 'Failed to send reply email' }, { status: 500 })
  }
}
