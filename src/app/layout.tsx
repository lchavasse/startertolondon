import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'starter-london',
  description: 'An immersive starter guide to London for travellers, builders, and curious locals.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}<Analytics /></body>
    </html>
  )
}
