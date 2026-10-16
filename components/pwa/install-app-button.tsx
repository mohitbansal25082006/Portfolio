'use client'

/**
 * Floating "Install admin app" button for the admin PWA.
 *
 * Desktop Chrome treats /admin as part of the already-installed portfolio
 * PWA (its scope "/" contains "/admin"), so its address-bar/menu UI offers
 * "Open in Mohit Bansal" instead of installing the admin app. Calling the
 * page's own install prompt installs the manifest linked on this page
 * (/admin.webmanifest, id "/admin") as its own app.
 *
 * The beforeinstallprompt event can fire before React hydrates, so the admin
 * layout stashes it on window.__pwaInstallPrompt with an inline script.
 */

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __pwaInstallPrompt?: InstallPromptEvent | null
  }
  interface Navigator {
    install?: () => Promise<unknown>
  }
}

const DISMISS_KEY = 'admin-pwa-install-dismissed'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function InstallAppButton({ label = 'Install admin app' }: { label?: string }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return
    } catch {}

    const show = (e: InstallPromptEvent) => {
      setPrompt(e)
      setVisible(true)
    }
    if (window.__pwaInstallPrompt) show(window.__pwaInstallPrompt)

    const onPrompt = (e: Event) => {
      e.preventDefault()
      window.__pwaInstallPrompt = e as InstallPromptEvent
      show(e as InstallPromptEvent)
    }
    const onInstalled = () => {
      window.__pwaInstallPrompt = null
      setVisible(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!visible) return null

  const install = async () => {
    if (prompt) {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      window.__pwaInstallPrompt = null
      setPrompt(null)
      if (outcome === 'accepted') setVisible(false)
    } else if (navigator.install) {
      await navigator.install().catch(() => {})
    }
  }

  const dismiss = () => {
    setVisible(false)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {}
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[90] flex items-center gap-1 rounded-full border p-1 pl-1 shadow-lg"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
        color: 'var(--foreground)',
        marginBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
      >
        <Download className="h-4 w-4" />
        {label}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/10"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
