import { Analytics } from '@vercel/analytics/next'
import { Geist, Geist_Mono } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'Mohit Bansal — Full Stack Developer & AI Engineer',
  description:
    'Mohit Bansal is a Computer Science student and full stack developer building scalable web applications, AI-powered products, and modern user experiences with React, Next.js, Node.js, and Generative AI.',
  applicationName: 'Mohit Bansal',
  // PWA — the admin layout overrides these with its own manifest/app title,
  // so the portfolio and the dashboard install as two separate apps.
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Mohit Bansal', statusBarStyle: 'black' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#282923',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${geist.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Analytics />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}