'use client'

/**
 * components/site-paused-screen.tsx
 *
 * Part 3.2 — Full Site Pause Maintenance Screen
 * ---------------------------------------------------------------------------
 * A full-screen animated maintenance page that completely replaces the
 * portfolio when sitePaused is enabled in Settings. Features:
 *   - Animated geometric background with particle field
 *   - Pulsing logo with glow effects
 *   - Animated progress-like status indicator
 *   - Configurable title and message from settings
 *   - Fully theme-aware (uses CSS variables)
 *   - Mobile optimized with responsive sizing
 *   - Reduced motion support
 * ---------------------------------------------------------------------------
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import { Wrench, Clock, RefreshCw, Mail, Globe2, ShieldCheck } from 'lucide-react'

interface SitePausedScreenProps {
  title: string
  message: string
  contactEmail?: string
}

export function SitePausedScreen({ title, message, contactEmail }: SitePausedScreenProps) {
  const [dots, setDots] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isOnline, setIsOnline] = useState(true)

  // Animated dots for "working" indicator
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Track elapsed time since page load
  useEffect(() => {
    const start = Date.now()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Online/offline detection
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Particle field — similar to main site but simplified
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const isMobile = window.innerWidth < 768
    const COUNT = Math.min(isMobile ? 25 : 60, Math.floor((width * height) / (isMobile ? 30000 : 20000)))

    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.4 + 0.5,
    }))

    const getPrimary = () => {
      const c = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
      return c || 'oklch(0.86 0.22 115)'
    }

    let raf = 0
    const render = () => {
      ctx.clearRect(0, 0, width, height)
      const primary = getPrimary()

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        if (p.y > height) p.y = 0

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          const dx = p.x - q.x
          const dy = p.y - q.y
          const d = Math.hypot(dx, dy)
          if (d < 100) {
            const alpha = (1 - d / 100) * 0.15
            ctx.strokeStyle = primary
            ctx.globalAlpha = alpha
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.stroke()
            ctx.globalAlpha = 1
          }
        }
      }

      for (const p of particles) {
        ctx.fillStyle = primary
        ctx.globalAlpha = 0.4
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      raf = requestAnimationFrame(render)
    }
    render()

    const onResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const formatElapsed = useMemo(() => {
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    if (mins === 0) return `${secs}s`
    return `${mins}m ${secs}s`
  }, [elapsed])

  return (
    <div className="site-paused-overlay">
      {/* Canvas particle field */}
      <canvas ref={canvasRef} className="site-paused-canvas" aria-hidden="true" />

      {/* Background grid */}
      <div className="site-paused-grid" aria-hidden="true" />

      {/* Aurora blobs */}
      <div className="site-paused-aurora site-paused-aurora-1" aria-hidden="true" />
      <div className="site-paused-aurora site-paused-aurora-2" aria-hidden="true" />

      {/* Main content */}
      <div className="site-paused-content">
        {/* Animated logo */}
        <div className="site-paused-logo-wrapper">
          <div className="site-paused-logo-ring" aria-hidden="true" />
          <div className="site-paused-logo-ring site-paused-logo-ring-2" aria-hidden="true" />
          <div className="site-paused-logo">
            <Wrench className="site-paused-logo-icon" />
          </div>
        </div>

        {/* Title */}
        <h1 className="site-paused-title">
          {title || 'Site Under Maintenance'}
        </h1>

        {/* Message */}
        <p className="site-paused-message">
          {message || 'We are currently performing scheduled maintenance. We will be back shortly.'}
        </p>

        {/* Status indicator */}
        <div className="site-paused-status">
          <span className="site-paused-status-dot" aria-hidden="true" />
          <span className="site-paused-status-text">
            Maintenance in progress{dots}
          </span>
        </div>

        {/* Info cards */}
        <div className="site-paused-info-grid">
          <div className="site-paused-info-card">
            <Clock className="site-paused-info-icon" />
            <div>
              <p className="site-paused-info-label">Session Active</p>
              <p className="site-paused-info-value">{formatElapsed}</p>
            </div>
          </div>
          <div className="site-paused-info-card">
            <Globe2 className="site-paused-info-icon" />
            <div>
              <p className="site-paused-info-label">Status</p>
              <p className="site-paused-info-value">
                {isOnline ? 'Connected' : 'Offline'}
              </p>
            </div>
          </div>
          <div className="site-paused-info-card">
            <ShieldCheck className="site-paused-info-icon" />
            <div>
              <p className="site-paused-info-label">Security</p>
              <p className="site-paused-info-value">Enabled</p>
            </div>
          </div>
        </div>

        {/* Contact */}
        {contactEmail && (
          <div className="site-paused-contact">
            <Mail className="site-paused-contact-icon" />
            <span>
              Questions?{' '}
              <a href={`mailto:${contactEmail}`} className="site-paused-contact-link">
                {contactEmail}
              </a>
            </span>
          </div>
        )}

        {/* Auto-refresh note */}
        <p className="site-paused-refresh-note">
          <RefreshCw className="site-paused-refresh-icon" />
          This page will update automatically when the site is back online.
        </p>
      </div>
    </div>
  )
}