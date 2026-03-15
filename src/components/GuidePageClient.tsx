'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { clearStoredOnboarding, loadStoredOnboarding } from '@/lib/profile'
import { rankGuideItems } from '@/lib/guide-data'
import { StoredOnboardingState, UserProfile } from '@/lib/types'

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

export function GuidePageClient() {
  const [state] = useState<StoredOnboardingState | null>(() => loadStoredOnboarding())
  const profile = state?.profile ?? EMPTY_PROFILE
  const items = useMemo(() => rankGuideItems(profile), [profile])
  const name = profile.name ?? 'traveller'

  return (
    <main className="guide-shell">
      <div className="guide-shell__inner guide-shell__inner--wide">
        <section className="guide-console terminal-panel">
          <div className="guide-console__topbar">
            <div>
              <p className="terminal-eyebrow">starter-london / guide</p>
              <h1 className="guide-console__title">what do you want today.</h1>
            </div>
            <div className="guide-console__actions">
              <Link href="/events" className="terminal-ghost">live events</Link>
              <button
                type="button"
                className="terminal-ghost"
                onClick={() => {
                  clearStoredOnboarding()
                  window.location.href = '/'
                }}
              >
                restart intro
              </button>
            </div>
          </div>

          <div className="guide-console__status">
            <span className="terminal-tag">hello {name.toLowerCase()}</span>
            <span className="terminal-tag">{profile.timeInLondonLabel || 'new signal'}</span>
            <span className="terminal-tag">{profile.lookingFor || 'open-ended search'}</span>
          </div>

          <div className="guide-dossier">
            <aside className="guide-dossier__rail">
              <div className="guide-dossier__block">
                <p className="app-section__meta">profile summary</p>
                <p className="terminal-copy">{profile.summary || 'No stored profile yet. Run the intro to shape recommendations.'}</p>
              </div>
              <div className="guide-dossier__block">
                <p className="app-section__meta">interest tags</p>
                <div className="terminal-tags">
                  {(profile.interests.length ? profile.interests : ['community', 'deeptech', 'music']).map((tag) => (
                    <span key={tag} className="terminal-tag">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="guide-dossier__block">
                <p className="app-section__meta">quick commands</p>
                <div className="guide-commandlist">
                  <Link href="/events">open live event stream</Link>
                  <Link href="/">re-enter onboarding shell</Link>
                  <span>social login: planned</span>
                </div>
              </div>
            </aside>

            <section className="guide-dossier__main">
              <div className="guide-list">
                {items.slice(0, 6).map((item, index) => (
                  <article key={item.id} className="guide-list__item">
                    <div className="guide-list__index">{String(index + 1).padStart(2, '0')}</div>
                    <div className="guide-list__body">
                      <div className="guide-list__header">
                        <div>
                          <p className="app-section__meta">{item.category} / {item.location}</p>
                          <h2>{item.name}</h2>
                        </div>
                        <span className="guide-list__vibe">{item.vibe}</span>
                      </div>
                      <p className="guide-list__strapline">{item.strapline}</p>
                      <p className="guide-list__description">{item.description}</p>
                      <div className="guide-list__footer">
                        <div className="terminal-tags">
                          {item.tags.map((tag) => (
                            <span key={tag} className="terminal-tag">{tag}</span>
                          ))}
                        </div>
                        <p className="terminal-copy--muted">why now: {item.reason}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}
