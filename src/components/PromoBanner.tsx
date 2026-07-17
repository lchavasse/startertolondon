'use client'

import Link from 'next/link'

export function PromoBanner() {
  return (
    <Link
      href="https://luma.com/deeptechldn26"
      target="_blank"
      rel="noopener noreferrer"
      className="promo-banner"
    >
      <span className="promo-banner__tag">oct 8</span>
      <span className="promo-banner__text">
        <strong>DeepTech London</strong> — we&apos;re bringing the sci-fi future to Brick Lane
      </span>
      <span className="promo-banner__cta">get tickets →</span>
    </Link>
  )
}
