'use client'

import { useState } from 'react'
import { HighlightCard } from './HighlightCard'
import { ExploreGrid } from './ExploreGrid'
import type {
  HighlightCard as HighlightData,
  KBSpace,
  KBCommunity,
  KBVC,
  KBProgramme,
} from '@/lib/kb'

type Mode = 'highlights' | 'all'

const MODE_KEYS: Mode[] = ['highlights', 'all']
const MODE_LABEL: Record<Mode, string> = {
  highlights: 'highlights',
  all: 'all',
}

interface Props {
  highlights: HighlightData[]
  spaces: KBSpace[]
  communities: KBCommunity[]
  vcs: KBVC[]
  programmes: KBProgramme[]
  availableSectors: string[]
}

export function HighlightsExplorer({
  highlights,
  spaces,
  communities,
  vcs,
  programmes,
  availableSectors,
}: Props) {
  const [mode, setMode] = useState<Mode>('highlights')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {MODE_KEYS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-colors duration-150 ${
              mode === m
                ? 'bg-[#c8ff00] text-black border-[#c8ff00]'
                : 'bg-transparent text-[#888] border-[#2a2a2a] hover:border-[#555] hover:text-[#aaa]'
            }`}
          >
            [ {MODE_LABEL[m]} ]
          </button>
        ))}
      </div>

      {mode === 'highlights' ? (
        highlights.length > 0 ? (
          <div className="kb-highlights">
            {highlights.map((h) => (
              <HighlightCard
                key={h.kind === 'space' ? h.space.id : h.community.id}
                card={h}
              />
            ))}
          </div>
        ) : (
          <p className="font-mono text-xs text-[#666] uppercase tracking-widest">
            no highlights yet
          </p>
        )
      ) : (
        <ExploreGrid
          spaces={spaces}
          communities={communities}
          vcs={vcs}
          programmes={programmes}
          availableSectors={availableSectors}
        />
      )}
    </div>
  )
}
