'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { clearStoredOnboarding, loadStoredOnboarding } from '@/lib/profile'
import { rankGuideItems } from '@/lib/guide-data'
import { GuideItem, StoredOnboardingState, UserProfile } from '@/lib/types'

const EMPTY_PROFILE: UserProfile = {
  name: null,
  age: null,
  bio: '',
  timeInLondon: null,
  timeInLondonLabel: null,
  lookingFor: '',
  interests: [],
  vibeTags: [],
  summary: '',
  completedAt: null,
}

interface GuidePageClientProps {
  items: GuideItem[]
}

export function GuidePageClient({ items }: GuidePageClientProps) {
  const [state] = useState<StoredOnboardingState | null>(() => loadStoredOnboarding())
  const profile = state?.profile ?? EMPTY_PROFILE
  const ranked = useMemo(() => rankGuideItems(items, profile), [items, profile])
  const name = profile.name ?? 'traveller'

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#c8ff00] mb-2">
            London Calling / Guide
          </p>
          <p className="text-[#f0ede6] text-3xl font-bold mb-8">Your Guide</p>
          <p className="font-mono text-xs text-[#666] uppercase tracking-widest">
            No guide data available yet.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10 flex items-start justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#c8ff00] mb-2">
              London Calling / Guide
            </p>
            <p className="text-[#f0ede6] text-3xl font-bold">Your Guide</p>
            <p className="text-[#666] text-xs font-mono mt-2">hello {name.toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/events"
              className="text-[11px] uppercase tracking-widest font-mono text-[#666] hover:text-[#c8ff00] transition-colors duration-150"
            >
              Events
            </Link>
            <Link
              href="/explore"
              className="text-[11px] uppercase tracking-widest font-mono text-[#666] hover:text-[#c8ff00] transition-colors duration-150"
            >
              Explore
            </Link>
            <button
              type="button"
              onClick={() => {
                clearStoredOnboarding()
                window.location.href = '/'
              }}
              className="text-[11px] uppercase tracking-widest font-mono text-[#666] hover:text-[#c8ff00] transition-colors duration-150"
            >
              Restart
            </button>
          </div>
        </div>

        <div className="flex gap-8 items-start">
          {/* Profile sidebar */}
          <aside className="w-64 flex-shrink-0 hidden lg:flex flex-col gap-4">
            <div className="bg-[#111111] border border-[#1e1e1e] p-4 flex flex-col gap-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#666] mb-2">Profile Summary</p>
                <p className="text-[11px] text-[#888] font-mono leading-relaxed">
                  {profile.summary || 'No stored profile yet. Run the intro to shape recommendations.'}
                </p>
              </div>

              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#666] mb-2">Interests</p>
                <div className="flex flex-wrap gap-1">
                  {(profile.interests.length ? profile.interests : ['community', 'deeptech', 'music']).map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border border-[#2a2a2a] text-[#777] rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#666] mb-2">Quick Links</p>
                <div className="flex flex-col gap-1">
                  <Link href="/events" className="text-[11px] font-mono text-[#666] hover:text-[#c8ff00] transition-colors duration-150">
                    → live event stream
                  </Link>
                  <Link href="/explore" className="text-[11px] font-mono text-[#666] hover:text-[#c8ff00] transition-colors duration-150">
                    → browse knowledge base
                  </Link>
                  <Link href="/" className="text-[11px] font-mono text-[#666] hover:text-[#c8ff00] transition-colors duration-150">
                    → re-enter onboarding
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          {/* Guide list */}
          <div className="flex-1 flex flex-col gap-3">
            {ranked.slice(0, 8).map((item, index) => (
              <article
                key={item.id}
                className="group flex gap-4 bg-[#111111] border border-[#1e1e1e] hover:border-[#c8ff00] p-4 transition-colors duration-150"
              >
                <div className="font-mono text-[10px] text-[#333] pt-0.5 w-6 flex-shrink-0">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-[#666] mb-1">
                        {item.category} / {item.location}
                      </p>
                      <h2 className="font-bold text-[#f0ede6] text-sm group-hover:text-[#c8ff00] transition-colors duration-150">
                        {item.name}
                      </h2>
                    </div>
                    {item.vibe && (
                      <span className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border border-[#2a2a2a] text-[#777] rounded-full flex-shrink-0">
                        {item.vibe}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-[#888] font-mono">{item.strapline}</p>
                  <p className="text-[11px] text-[#666] font-mono leading-relaxed">{item.description}</p>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1a1a1a]">
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border border-[#2a2a2a] text-[#777] rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {item.href && (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-[#666] hover:text-[#c8ff00] transition-colors duration-150 flex-shrink-0"
                      >
                        visit →
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
