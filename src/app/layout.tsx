import type { Metadata } from 'next'
import { Geist, IBM_Plex_Mono, Press_Start_2P } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500'],
  variable: '--font-plex-mono-loaded',
  subsets: ['latin'],
  display: 'swap',
})

const pressStart2P = Press_Start_2P({
  weight: '400',
  variable: '--font-pixel',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'london calling',
  description: 'London tech events, spaces, and more',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${pressStart2P.variable} ${ibmPlexMono.variable} ${geistSans.variable}`}
    >
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
