import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CV Master PRO - AI-Powered Resume Optimization',
  description: 'Transform your CV with AI. Tailor, optimize, and ace your applications with intelligent analysis.',
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
