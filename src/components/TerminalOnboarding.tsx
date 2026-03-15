'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  applyLookingFor,
  applyTimeInLondon,
  clearStoredOnboarding,
  DEFAULT_IDENTITY_TEXT,
  extractProfile,
  finalizeProfile,
  loadStoredOnboarding,
  planQuestions,
  saveStoredOnboarding,
} from '@/lib/profile'
import { FollowUpQuestion, StoredOnboardingState, UserProfile } from '@/lib/types'

const BOOT_LINES = [
  '> booting london guide runtime',
  '> calibrating city map',
  '> syncing terminal shell',
]

const INTRO_COPY = ['*You just woke up.', 'Time to figure out where you are.*']
const MATRIX_CHARS = '01アイウエオカキクケコサシスセソ0123456789'
const RAIN_DURATION = 2600
const MORPH_DURATION = 1100
const GLOBAL_COLUMN_SPACING = 16
const GLYPH_ROW_HEIGHT = 18

function Mascot() {
  return (
    <div className="terminal-mascot" aria-hidden="true">
      <div className="terminal-mascot__head">
        <span />
        <span />
      </div>
      <div className="terminal-mascot__body">
        <span />
        <span />
        <span />
      </div>
      <div className="terminal-mascot__legs">
        <span />
        <span />
      </div>
    </div>
  )
}

type RainColumn = { x: number; y: number; speed: number; length: number; seed: number }
type MaskSample = { width: number; height: number; data: Uint8Array }
type MaskedLayer = {
  columns: RainColumn[]
  xJitter: number
  yJitter: number
  opacityBoost: number
}

type StaticGlyph = { x: number; y: number; seed: number; alpha: number }

function MatrixCityMap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const image = new Image()
    image.src = '/london-threshold.png'

    let width = 0
    let height = 0
    let dpr = 1
    let animationFrame = 0
    let start = 0
    let ready = false
    let globalColumns: RainColumn[] = []
    let maskedLayers: MaskedLayer[] = []
    let mask: MaskSample | null = null
    let staticGlyphs: StaticGlyph[] = []

    const buildColumns = (
      spacing: number,
      minSpeed: number,
      speedRange: number,
      minLength: number,
      lengthRange: number,
      xOffset = 0,
      distributed = false
    ) => {
      const count = Math.ceil(width / spacing) + 3
      return Array.from({ length: count }, (_, index) => ({
        x: index * spacing + xOffset,
        y: distributed ? Math.random() * height : -Math.random() * height,
        speed: minSpeed + Math.random() * speedRange,
        length: minLength + Math.floor(Math.random() * lengthRange),
        seed: Math.random() * 500,
      }))
    }

    const buildMaskedLayers = () => {
      maskedLayers = [
        {
          columns: buildColumns(5, 3.9, 1.4, 28, 18, 0, true),
          xJitter: 1.5,
          yJitter: 0,
          opacityBoost: 1,
        },
        {
          columns: buildColumns(5, 3.4, 1.2, 24, 16, 2.5, true),
          xJitter: 2.2,
          yJitter: 7,
          opacityBoost: 0.82,
        },
        {
          columns: buildColumns(5, 3.1, 1.0, 22, 14, 1.2, true),
          xJitter: 1.1,
          yJitter: -5,
          opacityBoost: 0.6,
        },
      ]
    }

    const setupCanvas = () => {
      dpr = window.devicePixelRatio || 1
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.textBaseline = 'top'
      context.font = '16px var(--font-plex-mono)'

      globalColumns = buildColumns(GLOBAL_COLUMN_SPACING, 15, 18, 14, 14)
      buildMaskedLayers()

      if (ready) {
        mask = buildMask(image, width, height)
        staticGlyphs = buildStaticGlyphs()
      }
    }

    const buildMask = (source: HTMLImageElement, viewportWidth: number, viewportHeight: number): MaskSample | null => {
      const offscreen = document.createElement('canvas')
      const offscreenContext = offscreen.getContext('2d')
      if (!offscreenContext) return null

      const scale = Math.max(viewportWidth / source.width, viewportHeight / source.height)
      const targetWidth = Math.ceil(source.width * scale)
      const targetHeight = Math.ceil(source.height * scale)
      const xOffset = Math.floor((viewportWidth - targetWidth) / 2)
      const yOffset = Math.floor((viewportHeight - targetHeight) / 2)

      offscreen.width = viewportWidth
      offscreen.height = viewportHeight
      offscreenContext.fillStyle = '#ffffff'
      offscreenContext.fillRect(0, 0, viewportWidth, viewportHeight)
      offscreenContext.drawImage(source, xOffset, yOffset, targetWidth, targetHeight)
      const pixels = offscreenContext.getImageData(0, 0, viewportWidth, viewportHeight).data
      const data = new Uint8Array(viewportWidth * viewportHeight)

      for (let y = 0; y < viewportHeight; y += 1) {
        for (let x = 0; x < viewportWidth; x += 1) {
          const index = (y * viewportWidth + x) * 4
          const r = pixels[index]
          const g = pixels[index + 1]
          const b = pixels[index + 2]
          const a = pixels[index + 3]
          if (a < 40) continue
          const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
          data[y * viewportWidth + x] = luminance < 0.6 ? 1 : 0
        }
      }

      return { width: viewportWidth, height: viewportHeight, data }
    }

    const isMaskedPixel = (x: number, y: number) => {
      if (!mask) return false
      const px = Math.max(0, Math.min(mask.width - 1, Math.floor(x)))
      const py = Math.max(0, Math.min(mask.height - 1, Math.floor(y)))
      return mask.data[py * mask.width + px] === 1
    }

    const buildStaticGlyphs = (): StaticGlyph[] => {
      if (!mask) return []
      const glyphs: StaticGlyph[] = []
      for (let y = 0; y < mask.height; y += 5) {
        for (let x = 0; x < mask.width; x += 5) {
          if (!isMaskedPixel(x, y)) continue
          if ((x + y) % 3 !== 0) continue
          glyphs.push({
            x,
            y,
            seed: Math.random() * 400,
            alpha: 0.12 + ((x * y) % 7) / 90,
          })
        }
      }
      return glyphs
    }

    const drawStaticGlyphs = (timestamp: number, opacity: number) => {
      if (!staticGlyphs.length || opacity <= 0) return
      const pulse = 0.36 + ((Math.sin(timestamp / 620) + 1) / 2) * 0.16
      staticGlyphs.forEach((glyph, index) => {
        const shimmer = ((index % 11) / 11) * 0.05
        const char = MATRIX_CHARS[Math.floor((timestamp / 280 + glyph.seed + index) % MATRIX_CHARS.length)]
        context.fillStyle = `rgba(150, 210, 166, ${Math.min(0.42, (glyph.alpha * pulse + shimmer) * opacity)})`
        context.fillText(char, glyph.x, glyph.y)
      })
    }

    const drawColumns = (columns: RainColumn[], opacity: number, timestamp: number) => {
      columns.forEach((column) => {
        for (let index = 0; index < column.length; index += 1) {
          const y = column.y - index * GLYPH_ROW_HEIGHT
          if (y < -40 || y > height + 40) continue
          const head = index === 0
          const tailFade = Math.max(0.04, 0.26 - index * 0.02)
          const alpha = opacity * (head ? 0.72 : tailFade)
          const char = MATRIX_CHARS[Math.floor((timestamp / 220 + column.seed + index * 2) % MATRIX_CHARS.length)]
          context.fillStyle = head ? `rgba(229, 249, 236, ${alpha})` : `rgba(146, 198, 159, ${alpha})`
          context.fillText(char, column.x, y)
        }

        column.y += column.speed
        if (column.y - column.length * GLYPH_ROW_HEIGHT > height) {
          column.y = -Math.random() * 120
        }
      })
    }

    const drawMaskedLayer = (layer: MaskedLayer, opacity: number, timestamp: number, settle: number) => {
      layer.columns.forEach((column) => {
        for (let index = 0; index < column.length; index += 1) {
          const x = column.x + Math.sin((timestamp / 260 + column.seed + index) * 0.9) * layer.xJitter
          const y = column.y - index * GLYPH_ROW_HEIGHT + layer.yJitter
          if (y < -40 || y > height + 40) continue

          const inMask = isMaskedPixel(x, y)
          const keepByChance = settle > 0.76 && Math.random() < (settle - 0.74) * 0.08
          if (!inMask && !keepByChance) continue

          const head = index === 0
          const tailFade = Math.max(0.18, 0.62 - index * 0.015)
          const alpha = Math.min(1, opacity * layer.opacityBoost * (head ? 1 : tailFade))
          const char = MATRIX_CHARS[Math.floor((timestamp / 210 + column.seed * 1.7 + index * 5) % MATRIX_CHARS.length)]
          context.fillStyle = head ? `rgba(236, 252, 240, ${alpha})` : `rgba(156, 212, 171, ${alpha})`
          context.fillText(char, x, y)
        }

        column.y += column.speed
        if (column.y - column.length * GLYPH_ROW_HEIGHT > height) {
          column.y = Math.random() * height * 0.55 - height * 0.15
        }
      })
    }

    const frame = (timestamp: number) => {
      if (!start) start = timestamp
      const elapsed = timestamp - start
      const settle = Math.min(1, Math.max(0, (elapsed - RAIN_DURATION) / MORPH_DURATION))
      const globalOpacity = elapsed < RAIN_DURATION ? 0.96 : 0.96 - settle * 0.96
      const maskedOpacity = ready ? Math.min(1, 0.2 + settle * 1.02) : 0
      const staticOpacity = ready ? Math.min(1, Math.max(0, (elapsed - RAIN_DURATION * 0.72) / (MORPH_DURATION * 0.8))) : 0

      context.fillStyle = '#040506'
      context.fillRect(0, 0, width, height)

      drawColumns(globalColumns, globalOpacity, timestamp)

      if (ready && elapsed > RAIN_DURATION * 0.42) {
        maskedLayers.forEach((layer, index) => {
          const layerOpacity = index === 0 ? 1 : index === 1 ? 0.92 : 0.72
          drawMaskedLayer(layer, maskedOpacity * layerOpacity, timestamp, settle)
        })
      }

      if (ready && staticOpacity > 0) {
        drawStaticGlyphs(timestamp, staticOpacity)
      }

      animationFrame = window.requestAnimationFrame(frame)
    }

    image.onload = () => {
      ready = true
      setupCanvas()
    }

    setupCanvas()
    animationFrame = window.requestAnimationFrame(frame)
    window.addEventListener('resize', setupCanvas)

    return () => {
      window.removeEventListener('resize', setupCanvas)
      window.cancelAnimationFrame(animationFrame)
    }
  }, [])

  return <canvas ref={canvasRef} className="matrix-canvas" aria-hidden="true" />
}

function TerminalMenu({
  question,
  onSubmit,
}: {
  question: FollowUpQuestion
  onSubmit: (value: string) => void
}) {
  const options = useMemo(() => question.options ?? [], [question.options])
  const [activeIndex, setActiveIndex] = useState(0)
  const [customValue, setCustomValue] = useState('')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (question.kind !== 'menu') return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((current) => (current + 1) % options.length)
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((current) => (current - 1 + options.length) % options.length)
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const activeOption = options[activeIndex]
        if (!activeOption) return
        if (activeOption.id === 'other') {
          if (customValue.trim()) onSubmit(customValue.trim())
          return
        }
        onSubmit(activeOption.value)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, customValue, onSubmit, options, question.kind])

  return (
    <div className="terminal-stack terminal-stack--tight">
      <p className="terminal-prompt terminal-prompt--question">{question.prompt}</p>
      <div className="terminal-menu" role="listbox" aria-label={question.prompt}>
        {options.map((option, index) => {
          const selected = index === activeIndex
          const isOther = option.id === 'other'
          return (
            <div key={option.id} className={`terminal-menu__item ${selected ? 'is-active' : ''}`}>
              <span className="terminal-menu__arrow">{selected ? '>' : ' '}</span>
              <span className="terminal-menu__label">{option.label}</span>
              {isOther && selected && (
                <input
                  value={customValue}
                  onChange={(event) => setCustomValue(event.target.value)}
                  className="terminal-menu__input terminal-menu__input--inline"
                  placeholder="type other"
                />
              )}
            </div>
          )
        })}
      </div>
      <p className="terminal-hint">arrow keys to navigate, enter to confirm</p>
    </div>
  )
}

export function TerminalOnboarding() {
  const router = useRouter()
  const [shellVisible, setShellVisible] = useState(false)
  const [introVisible, setIntroVisible] = useState(false)
  const [identityValue, setIdentityValue] = useState('')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(() => loadStoredOnboarding()?.profile ?? null)
  const [phase, setPhase] = useState<'identity' | 'questions' | 'processing' | 'returning'>(() => loadStoredOnboarding() ? 'returning' : 'identity')
  const [whatToSee, setWhatToSee] = useState('')
  const [typedChars, setTypedChars] = useState(0)
  const [allowContinue, setAllowContinue] = useState(false)
  const [identityHeight, setIdentityHeight] = useState(40)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const shellTimer = window.setTimeout(() => setShellVisible(true), 1100)
    const introTimer = window.setTimeout(() => setIntroVisible(true), 1550)

    return () => {
      window.clearTimeout(shellTimer)
      window.clearTimeout(introTimer)
    }
  }, [])

  useEffect(() => {
    if (shellVisible && phase === 'identity') {
      inputRef.current?.focus()
    }
  }, [phase, shellVisible])

  useEffect(() => {
    if (phase !== 'returning') return
    const timer = window.setTimeout(() => setAllowContinue(true), 450)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'returning') return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && allowContinue) {
        event.preventDefault()
        router.push('/guide')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [allowContinue, phase, router])

  useEffect(() => {
    if (!introVisible) return
    const total = INTRO_COPY.join(' ').length
    const interval = window.setInterval(() => {
      setTypedChars((current) => {
        if (current >= total) {
          window.clearInterval(interval)
          return current
        }
        return current + 1
      })
    }, 18)

    return () => window.clearInterval(interval)
  }, [introVisible])

  useEffect(() => {
    const node = inputRef.current
    if (!node) return
    node.style.height = '0px'
    const nextHeight = Math.max(40, node.scrollHeight)
    node.style.height = `${nextHeight}px`
    setIdentityHeight(nextHeight)
  }, [identityValue, phase])

  const typedIntro = useMemo(() => {
    const full = INTRO_COPY.join('\n')
    return full.slice(0, typedChars)
  }, [typedChars])

  const enoughIdentity = identityValue.trim().length >= 100
  const currentQuestion = questions[questionIndex] ?? null

  function resetExperience() {
    clearStoredOnboarding()
    window.location.reload()
  }

  function persist(nextProfile: UserProfile, stage: StoredOnboardingState['stage']) {
    const nextState: StoredOnboardingState = {
      profile: nextProfile,
      stage,
      lastAnsweredAt: new Date().toISOString(),
    }
    saveStoredOnboarding(nextState)
  }

  function handleIdentitySubmit() {
    const source = identityValue.trim() || DEFAULT_IDENTITY_TEXT
    if (source.length < 100) return
    const extraction = extractProfile(source)
    const nextQuestions = planQuestions(extraction).questions
    const nextProfile = extraction.profile
    setProfile(nextProfile)
    persist(nextProfile, 'in-progress')
    setQuestions(nextQuestions)
    setPhase('questions')
    setQuestionIndex(0)
  }

  function handleQuestionSubmit(value: string) {
    if (!profile || !currentQuestion) return

    let nextProfile = profile
    if (currentQuestion.id === 'time-in-london') {
      nextProfile = applyTimeInLondon(profile, value)
    }
    if (currentQuestion.id === 'what-to-see') {
      nextProfile = applyLookingFor(profile, value, currentQuestion.suggestedTags)
      setWhatToSee(value)
    }

    setProfile(nextProfile)
    const nextIndex = questionIndex + 1
    if (nextIndex >= questions.length) {
      setPhase('processing')
      persist(nextProfile, 'in-progress')
      window.setTimeout(() => {
        const finalProfile = finalizeProfile(nextProfile)
        setProfile(finalProfile)
        persist(finalProfile, 'complete')
        router.push('/guide')
      }, 900)
      return
    }

    persist(nextProfile, 'in-progress')
    setQuestionIndex(nextIndex)
  }

  return (
    <main className="terminal-screen">
      <MatrixCityMap />
      <div className="terminal-grid" aria-hidden="true" />
      <button type="button" className="terminal-reset" onClick={resetExperience}>
        [ reset session ]
      </button>

      <div className="terminal-stage">
        <section className={`terminal-window ${shellVisible ? 'is-visible' : ''}`}>
          <header className="terminal-window__titlebar">
            <span className="terminal-window__dots">
              <i />
              <i />
              <i />
            </span>
            <span className="terminal-window__title">starter-london / immersive shell</span>
          </header>

          <div className="terminal-window__body">
            <div className="terminal-header">
              <Mascot />
              <div>
                <p className="terminal-kicker">A Starter Guide to London v0.1</p>
                <p className="terminal-meta">~/init</p>
              </div>
            </div>

            <div className="terminal-bootlog">
              {BOOT_LINES.map((line, index) => (
                <p key={line} className="terminal-line" style={{ animationDelay: `${index * 100}ms` }}>
                  {line}
                </p>
              ))}
            </div>

            {introVisible && (
              <div className="terminal-stack">
                <pre className="terminal-copy">{typedIntro}<span className="terminal-cursor">_</span></pre>

                {phase === 'returning' && profile ? (
                  <div className="terminal-stack terminal-stack--tight">
                    <p className="terminal-prompt terminal-prompt--question">
                      {profile.name ? `hello ${profile.name.toLowerCase()}` : 'hello traveller'}
                    </p>
                    <p className="terminal-copy terminal-copy--muted">what do you want today.</p>
                    <p className="terminal-hint">press enter to continue</p>
                  </div>
                ) : null}

                {phase === 'identity' && (
                  <div className="terminal-stack terminal-stack--tight">
                    <p className="terminal-prompt terminal-prompt--question">Q: who are you..?</p>
                    <div className="terminal-inline-input" style={{ minHeight: `${identityHeight + 12}px` }}>
                      <span className="terminal-inline-input__prompt">traveller@ldn:~$</span>
                      <textarea
                        ref={inputRef}
                        value={identityValue}
                        onChange={(event) => setIdentityValue(event.target.value)}
                        className="terminal-textarea terminal-textarea--inline"
                        rows={1}
                        placeholder={DEFAULT_IDENTITY_TEXT}
                      />
                    </div>
                    <div className="terminal-statusrow">
                      <span className={`terminal-meter ${enoughIdentity ? 'is-ready' : ''}`}>
                        [{enoughIdentity ? 'ready' : 'need 100 chars'}]
                      </span>
                      <span className="terminal-copy terminal-copy--muted">{identityValue.trim().length} chars</span>
                    </div>
                    <button type="button" className="terminal-action" onClick={handleIdentitySubmit} disabled={!enoughIdentity}>
                      continue
                    </button>
                  </div>
                )}

                {phase === 'questions' && currentQuestion?.kind === 'menu' && (
                  <TerminalMenu question={currentQuestion} onSubmit={handleQuestionSubmit} />
                )}

                {phase === 'questions' && currentQuestion?.kind === 'text' && (
                  <div className="terminal-stack terminal-stack--tight">
                    <p className="terminal-prompt terminal-prompt--question">{currentQuestion.prompt}</p>
                    {!!currentQuestion.suggestedTags?.length && (
                      <div className="terminal-tags">
                        {currentQuestion.suggestedTags.map((tag) => (
                          <span key={tag} className="terminal-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="terminal-inline-input terminal-inline-input--single">
                      <span className="terminal-inline-input__prompt">query@ldn:~$</span>
                      <input
                        autoFocus
                        value={whatToSee}
                        onChange={(event) => setWhatToSee(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && whatToSee.trim()) {
                            event.preventDefault()
                            handleQuestionSubmit(whatToSee.trim())
                          }
                        }}
                        className="terminal-input terminal-input--inline"
                        placeholder={currentQuestion.placeholder}
                      />
                    </div>
                    <button type="button" className="terminal-action" onClick={() => handleQuestionSubmit(whatToSee.trim())} disabled={!whatToSee.trim()}>
                      continue
                    </button>
                  </div>
                )}

                {phase === 'processing' && (
                  <div className="terminal-stack terminal-stack--tight">
                    <p className="terminal-prompt terminal-prompt--question">processing traveller profile...</p>
                    <p className="terminal-copy terminal-copy--muted">building your first map of london</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
