import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import {
  getClientIp,
  checkRateLimit,
  consumeRateLimit,
  verifyOtpSession,
  RATE_LIMIT_CONFIG,
} from '@/lib/rate-limit'
import { saveMessage } from '@/lib/messages'

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const { token, code } = await req.json()

    if (!token || !code || typeof token !== 'string' || typeof code !== 'string') {
      return NextResponse.json({ error: 'Missing verification token or code' }, { status: 400 })
    }

    // Re-check the daily send limit here too — time may have passed since
    // send-otp, and this is the step that actually delivers the message.
    const sendLimit = checkRateLimit(ip)
    if (!sendLimit.allowed) {
      return NextResponse.json(
        { error: `You've reached the limit of ${RATE_LIMIT_CONFIG.MAX_SENDS_PER_DAY} messages per day. Please try again tomorrow.` },
        { status: 429 },
      )
    }

    const result = verifyOtpSession(token, code.trim(), ip)

    if (!result.ok) {
      const messages: Record<typeof result.reason, string> = {
        not_found: 'This verification session is invalid or already used. Please request a new code.',
        expired: 'This code has expired. Please request a new one.',
        too_many_attempts: 'Too many incorrect attempts. Please request a new code.',
        mismatch: 'Incorrect code. Please try again.',
      }
      const status = result.reason === 'mismatch' ? 400 : 410
      return NextResponse.json({ error: messages[result.reason] }, { status })
    }

    const { name, email, subject, message } = result.formData

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    const mailOptions = {
      from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `Portfolio Contact: ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
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
                    Portfolio Contact
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <div style="padding: 32px;">
          <h2 style="margin: 0 0 24px; font-size: 24px; color: #ffffff; line-height: 1.2;">New Message Received</h2>

          <div style="background: #1f2024; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #3f3f46;">
            <p style="margin: 0 0 8px; font-family: monospace; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.08em;">From</p>
            <p style="margin: 0; font-size: 16px; color: #ffffff; font-weight: 500;">${name}</p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #b3ff3d;">${email} <span style="color:#71717a; font-size:11px;">(verified ✓)</span></p>
          </div>
          <div style="background: #1f2024; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #3f3f46;">
            <p style="margin: 0 0 8px; font-family: monospace; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.08em;">Subject</p>
            <p style="margin: 0; font-size: 16px; color: #ffffff; font-weight: 500;">${subject}</p>
          </div>
          <div style="background: #1f2024; border-radius: 12px; padding: 20px; border: 1px solid #3f3f46;">
            <p style="margin: 0 0 8px; font-family: monospace; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.08em;">Message</p>
            <p style="margin: 0; font-size: 15px; color: #e4e4e7; line-height: 1.6; white-space: pre-wrap;">${message}</p>
          </div>
        </div>

        <div style="padding: 20px 32px; background: #1f2024; border-top: 1px solid #3f3f46; text-align: center;">
          <p style="margin: 0; font-family: monospace; font-size: 11px; color: #71717a; letter-spacing: 0.08em;">© ${new Date().getFullYear()} Mohit Bansal Portfolio. All rights reserved.</p>
        </div>
      </div>
    </div>
  `,
    }

    await transporter.sendMail(mailOptions)

    // Persist the message so it appears in the admin dashboard.
    await saveMessage({ name, email, subject, message })

    // Only consume the daily quota once the message has actually sent.
    consumeRateLimit(ip)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Verify OTP Error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}