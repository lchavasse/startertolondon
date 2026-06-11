'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// The banner promotes /agents-in-the-wild, so hide it across that section
// (the landing page and its docs/guide pages).
const HIDDEN_PREFIXES = ['/agents-in-the-wild']

export function PromoBanner() {
  const pathname = usePathname()
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null

  return (
    <Link href="/agents-in-the-wild" className="promo-banner">
      <span className="promo-banner__tag">new</span>
      <span className="promo-banner__text">
        <strong>Agents in the Wild</strong> — a 2-week build sprint for autonomy in the
        physical world · £2k+ prize pool
      </span>
      <span className="promo-banner__cta">apply →</span>
    </Link>
  )
}
