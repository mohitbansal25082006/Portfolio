import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import {
  getClientIp,
  checkRateLimit,
  checkOtpRequestLimit,
  consumeOtpRequest,
  generateOtpCode,
  createOtpSession,
  RATE_LIMIT_CONFIG,
} from '@/lib/rate-limit'

// RFC-5322-ish practical email regex — good enough to reject obvious typos
// without rejecting valid addresses with plus-tags, subdomains, etc.
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const { name, email, subject, message } = await req.json()

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()) || email.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    // The daily "2 emails" cap is checked here too (not just at final send)
    // so we don't burn an OTP email on someone who has already hit today's
    // limit — they'd never be able to complete the flow anyway.
    const sendLimit = checkRateLimit(ip)
    if (!sendLimit.allowed) {
      return NextResponse.json(
        { error: `You've reached the limit of ${RATE_LIMIT_CONFIG.MAX_SENDS_PER_DAY} messages per day. Please try again tomorrow.` },
        { status: 429 },
      )
    }

    // Separate, slightly more lenient cap on OTP *requests* themselves,
    // to stop someone from spamming the send-otp endpoint (and thus our
    // email quota) without ever finishing verification.
    const otpLimit = checkOtpRequestLimit(ip)
    if (!otpLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many verification requests from this IP today. Please try again tomorrow.' },
        { status: 429 },
      )
    }

    const code = generateOtpCode()
    const token = createOtpSession({
      code,
      email: email.trim(),
      ip,
      formData: {
        name: String(name).slice(0, 200),
        email: email.trim(),
        subject: String(subject).slice(0, 300),
        message: String(message).slice(0, 5000),
      },
    })

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    const mailOptions = {
      from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
      to: email.trim(),
      subject: `Your verification code: ${code}`,
      text: `Your verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`,
      html: `
    <div style="font-family: 'Geist', 'Helvetica Neue', Arial, sans-serif; background: #1a1a1a; padding: 40px 0; margin: 0; color: #e4e4e7;">
      <div style="max-width: 480px; margin: 0 auto; background: #282923; border: 1px solid #3f3f46; border-radius: 16px; overflow: hidden;">
        <div style="padding: 24px 32px; border-bottom: 1px solid #3f3f46;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <tr>
              <td style="width: 36px; height: 36px; background: #b3ff3d; border-radius: 50%; text-align: center; vertical-align: middle; font-family: Arial, Helvetica, sans-serif; color: #282923; font-weight: 700; font-size: 14px; line-height: 36px;">
                MB
              </td>
              <td style="padding-left: 12px; font-family: monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #a1a1aa; vertical-align: middle;">
                Email Verification
              </td>
            </tr>
          </table>
        </div>
        <div style="padding: 32px; text-align: center;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #a1a1aa;">Your verification code is</p>
          <p style="margin: 0 0 16px; font-size: 40px; letter-spacing: 0.15em; font-weight: 700; color: #b3ff3d; font-family: monospace;">${code}</p>
          <p style="margin: 0; font-size: 13px; color: #71717a;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
        <div style="padding: 20px 32px; background: #1f2024; border-top: 1px solid #3f3f46; text-align: center;">
          <p style="margin: 0; font-family: monospace; font-size: 11px; color: #71717a; letter-spacing: 0.08em;">© ${new Date().getFullYear()} Mohit Bansal Portfolio. All rights reserved.</p>
        </div>
      </div>
    </div>
  `,
    }

    await transporter.sendMail(mailOptions)

    // Only consume the OTP-request quota after the email actually sends.
    consumeOtpRequest(ip)

    return NextResponse.json({ success: true, token })
  } catch (error) {
    console.error('Send OTP Error:', error)
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 })
  }
}