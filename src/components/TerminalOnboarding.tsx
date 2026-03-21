'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  applyLookingFor,
  applyTimeInLondon,
  clearStoredOnboarding,
  DEFAULT_IDENTITY_TEXT,
  extractProfile,
  finalizeProfile,
  loadStoredOnboarding,
  saveStoredOnboarding,
  TIME_OPTIONS,
} from '@/lib/profile'
import { StoredOnboardingState, UserProfile } from '@/lib/types'

const MATRIX_CHARS = '01アイウエオカキクケコサシスセソ0123456789'
const RAIN_DURATION = 2600
const MORPH_DURATION = 1100
const GLOBAL_COLUMN_SPACING = 16
const GLYPH_ROW_HEIGHT = 14

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
          columns: buildColumns(4, 3.9, 1.4, 28, 18, 0, true),
          xJitter: 1.5,
          yJitter: 0,
          opacityBoost: 1,
        },
        {
          columns: buildColumns(4, 3.4, 1.2, 24, 16, 2.0, true),
          xJitter: 2.2,
          yJitter: 7,
          opacityBoost: 0.82,
        },
        {
          columns: buildColumns(4, 3.1, 1.0, 22, 14, 1.0, true),
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
      context.font = '13px var(--font-plex-mono)'

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
      for (let y = 0; y < mask.height; y += 4) {
        for (let x = 0; x < mask.width; x += 4) {
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

const INTRO_TEXT = 'you just woke up.  who are you?'
const CHAR_SPEED = 22

const STEP_PROMPTS: Partial<Record<string, string>> = {
  time: 'how long are you here for?',
  'looking-for': 'what are you looking for?',
  returning: 'what are you looking for?',
}

type Step = 'identity' | 'time' | 'looking-for' | 'processing' | 'returning'
type HistoryEntry = { prompt: string; answer: string }

export function TerminalOnboarding() {
  const router = useRouter()
  const [shellVisible, setShellVisible] = useState(false)
  const [typedChars, setTypedChars] = useState(0)
  const [promptTypedChars, setPromptTypedChars] = useState(0)
  const [step, setStep] = useState<Step>(() => loadStoredOnboarding() ? 'returning' : 'identity')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [currentInput, setCurrentInput] = useState('')
  const [activeTimeIndex, setActiveTimeIndex] = useState(0)
  const activeTimeIndexRef = useRef(0)
  const [profile, setProfile] = useState<UserProfile | null>(() => loadStoredOnboarding()?.profile ?? null)

  const [otherTimeValue, setOtherTimeValue] = useState('')
  const otherTimeRef = useRef<HTMLInputElement | null>(null)
  const otherTimeValueRef = useRef('')

  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const windowRef = useRef<HTMLElement | null>(null)
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const introComplete = typedChars >= INTRO_TEXT.length
  const typedIntro = INTRO_TEXT.slice(0, typedChars)
  const isTextStep = step === 'identity' || step === 'looking-for' || step === 'returning'
  const stepPrompt = STEP_PROMPTS[step] ?? ''
  const promptComplete = promptTypedChars >= stepPrompt.length
  const typedPrompt = stepPrompt.slice(0, promptTypedChars)

  // Shell appear timer
  useEffect(() => {
    const t = window.setTimeout(() => setShellVisible(true), 1100)
    return () => window.clearTimeout(t)
  }, [])

  // Typewriter for intro
  useEffect(() => {
    if (!shellVisible || step !== 'identity' || typedChars >= INTRO_TEXT.length) return
    const t = window.setTimeout(() => setTypedChars((c) => c + 1), CHAR_SPEED)
    return () => window.clearTimeout(t)
  }, [shellVisible, typedChars, step])

  // Reset prompt typewriter when step changes
  useEffect(() => { setPromptTypedChars(0) }, [step])

  // Typewriter for step prompts (time, looking-for, returning)
  useEffect(() => {
    if (!stepPrompt || promptTypedChars >= stepPrompt.length) return
    const t = window.setTimeout(() => setPromptTypedChars((c) => c + 1), CHAR_SPEED)
    return () => window.clearTimeout(t)
  }, [stepPrompt, promptTypedChars])

  // Auto-scroll body to bottom on new content
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [history, step, typedChars, shellVisible])

  // Route all keypresses to hidden textarea for text input steps
  useEffect(() => {
    if (!isTextStep) return
    if (step === 'identity' && !introComplete) return
    if (step !== 'identity' && !promptComplete) return
    inputRef.current?.focus()
    const capture = (e: Event) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'BUTTON' || tag === 'A') return
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', capture, true)
    document.addEventListener('click', capture, true)
    return () => {
      document.removeEventListener('keydown', capture, true)
      document.removeEventListener('click', capture, true)
    }
  }, [isTextStep, step, introComplete, promptComplete])

  // Keep ref in sync with state so the keydown handler always reads the current index
  useEffect(() => { activeTimeIndexRef.current = activeTimeIndex }, [activeTimeIndex])

  // Keep otherTimeValueRef in sync with state
  useEffect(() => { otherTimeValueRef.current = otherTimeValue }, [otherTimeValue])

  // Auto-focus inline input when "other" is the active option
  useEffect(() => {
    if (step !== 'time') return
    const isOther = TIME_OPTIONS[activeTimeIndex]?.id === 'other'
    if (isOther) {
      otherTimeRef.current?.focus()
    }
  }, [step, activeTimeIndex])

  // Arrow keys + enter for time menu
  // Delay registering the Enter handler by 400ms to prevent the Enter from the
  // previous identity step immediately firing through.
  useEffect(() => {
    if (step !== 'time') return
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveTimeIndex((i) => (i + 1) % TIME_OPTIONS.length) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveTimeIndex((i) => (i - 1 + TIME_OPTIONS.length) % TIME_OPTIONS.length) }
      if (e.key === 'Enter') {
        e.preventDefault()
        const opt = TIME_OPTIONS[activeTimeIndexRef.current]
        if (!opt || !profile) return
        if (opt.id === 'other') return  // handled by inline input's onKeyDown
        const next = applyTimeInLondon(profile, opt.value)
        saveStoredOnboarding({ profile: next, stage: 'in-progress', lastAnsweredAt: new Date().toISOString() })
        setProfile(next)
        setHistory((h) => [...h, { prompt: 'how long are you here for?', answer: opt.label }])
        setCurrentInput('')
        setStep('looking-for')
      }
    }
    const t = window.setTimeout(() => window.addEventListener('keydown', handle), 400)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', handle)
    }
  }, [step, profile])


  function persist(p: UserProfile, stage: StoredOnboardingState['stage']) {
    saveStoredOnboarding({ profile: p, stage, lastAnsweredAt: new Date().toISOString() })
  }

  function advanceFromIdentity() {
    const source = currentInput.trim() || DEFAULT_IDENTITY_TEXT
    const { profile: next } = extractProfile(source)
    persist(next, 'in-progress')
    setProfile(next)
    setHistory([{ prompt: INTRO_TEXT, answer: source }])
    setCurrentInput('')
    setStep('time')
  }


  function advanceFromLookingFor() {
    if (!profile || !currentInput.trim()) return
    const next = finalizeProfile(applyLookingFor(profile, currentInput.trim()))
    persist(next, 'complete')
    setProfile(next)
    setHistory((h) => [...h, { prompt: 'what are you looking for?', answer: currentInput.trim() }])
    setStep('processing')
    window.setTimeout(() => router.push('/guide'), 900)
  }

  function advanceFromReturning() {
    if (!profile || !currentInput.trim()) return
    const next = finalizeProfile(applyLookingFor(profile, currentInput.trim()))
    persist(next, 'complete')
    router.push('/guide')
  }

  function handleTextKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (step === 'identity') advanceFromIdentity()
      else if (step === 'looking-for') advanceFromLookingFor()
      else if (step === 'returning') advanceFromReturning()
    }
  }

  function handleTitlebarMouseDown(event: React.MouseEvent) {
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    const el = windowRef.current
    if (!el) return
    el.style.transition = 'none'
    const startX = event.clientX - positionRef.current.x
    const startY = event.clientY - positionRef.current.y
    const onMove = (e: MouseEvent) => {
      positionRef.current = { x: e.clientX - startX, y: e.clientY - startY }
      el.style.transform = `translate(calc(-50% + ${positionRef.current.x}px), calc(-50% + ${positionRef.current.y}px))`
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const enoughInput = currentInput.trim().length >= 80

  return (
    <main className="terminal-screen">
      <MatrixCityMap />
      <div className="terminal-grid" aria-hidden="true" />
      <button type="button" className="terminal-reset" onClick={() => { clearStoredOnboarding(); window.location.reload() }}>
        [ reset session ]
      </button>

      <div className="terminal-stage">
        <section ref={windowRef} className={`terminal-window ${shellVisible ? 'is-visible' : ''}`}>
          <header className="terminal-window__titlebar" onMouseDown={handleTitlebarMouseDown}>
            <span className="terminal-window__dots"><i /><i /><i /></span>
            <span className="terminal-window__title">starter-london</span>
          </header>

          <div className="terminal-window__body" ref={bodyRef}>
            {shellVisible && (
              <div className="terminal-output">
                <p className="terminal-output__line terminal-output__line--dim">starter-london v0.1 — london guide runtime</p>
                <p className="terminal-output__line terminal-output__line--dim">──────────────────────────────────────────</p>

                {/* Completed steps shown as history */}
                {history.map((entry, i) => (
                  <div key={i}>
                    <p className="terminal-output__line terminal-output__line--dim">&nbsp;</p>
                    <p className="terminal-output__line terminal-output__line--dim">{entry.prompt}</p>
                    <div className="terminal-prompt-line">
                      <span className="terminal-prompt-line__user">traveller@ldn</span>
                      <span className="terminal-prompt-line__sep"> ~ % </span>
                      <span className="terminal-text-display">{entry.answer}</span>
                    </div>
                  </div>
                ))}

                {/* Returning greeting */}
                {step === 'returning' && profile && (
                  <>
                    <p className="terminal-output__line terminal-output__line--dim">&nbsp;</p>
                    <p className="terminal-output__line">{profile.name ? `hello, ${profile.name.toLowerCase()}.` : 'hello, traveller.'}</p>
                  </>
                )}

                {step !== 'processing' && (
                  <>
                    <p className="terminal-output__line terminal-output__line--dim">&nbsp;</p>

                    {/* Identity typewriter prompt */}
                    {step === 'identity' && (
                      <p className="terminal-output__line">
                        {typedIntro}{!introComplete && <span className="terminal-cursor">█</span>}
                      </p>
                    )}

                    {/* Time menu */}
                    {step === 'time' && (
                      <>
                        <p className="terminal-output__line">
                          {typedPrompt}{!promptComplete && <span className="terminal-cursor">█</span>}
                        </p>
                        {promptComplete && (<>
                        <p className="terminal-output__line terminal-output__line--dim">&nbsp;</p>
                        <div className="terminal-menu">
                          {TIME_OPTIONS.map((opt, i) => (
                            <div
                              key={opt.id}
                              className={`terminal-menu__item ${i === activeTimeIndex ? 'is-active' : ''}`}
                              onClick={() => {
                                setActiveTimeIndex(i)
                                if (opt.id !== 'other') {
                                  if (!profile) return
                                  const next = applyTimeInLondon(profile, opt.value)
                                  saveStoredOnboarding({ profile: next, stage: 'in-progress', lastAnsweredAt: new Date().toISOString() })
                                  setProfile(next)
                                  setHistory((h) => [...h, { prompt: 'how long are you here for?', answer: opt.label }])
                                  setCurrentInput('')
                                  setStep('looking-for')
                                }
                              }}
                            >
                              <span className="terminal-menu__arrow">{i === activeTimeIndex ? '▶' : ' '}</span>
                              {opt.id === 'other' && i === activeTimeIndex ? (
                                <input
                                  ref={otherTimeRef}
                                  value={otherTimeValue}
                                  onChange={(e) => setOtherTimeValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      if (!otherTimeValue.trim() || !profile) return
                                      const next = applyTimeInLondon(profile, otherTimeValue.trim())
                                      saveStoredOnboarding({ profile: next, stage: 'in-progress', lastAnsweredAt: new Date().toISOString() })
                                      setProfile(next)
                                      setHistory((h) => [...h, { prompt: 'how long are you here for?', answer: otherTimeValue.trim() }])
                                      setCurrentInput('')
                                      setStep('looking-for')
                                    }
                                    if (e.key === 'ArrowUp') {
                                      e.preventDefault()
                                      setActiveTimeIndex((i) => (i - 1 + TIME_OPTIONS.length) % TIME_OPTIONS.length)
                                    }
                                    if (e.key === 'ArrowDown') {
                                      e.preventDefault()
                                      setActiveTimeIndex((i) => (i + 1) % TIME_OPTIONS.length)
                                    }
                                  }}
                                  className="terminal-menu__input"
                                  placeholder="something else..."
                                />
                              ) : (
                                <span className="terminal-menu__label">{opt.id === 'other' ? 'other...' : opt.label}</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="terminal-output__line terminal-output__line--dim">↑↓ navigate · enter to select</p>
                        </>)}
                      </>
                    )}

                    {/* Looking-for / returning prompt */}
                    {(step === 'looking-for' || step === 'returning') && (
                      <p className="terminal-output__line">
                        {typedPrompt}{!promptComplete && <span className="terminal-cursor">█</span>}
                      </p>
                    )}

                    {/* Text input — shown only once the prompt has finished typing */}
                    {isTextStep && (step === 'identity' ? introComplete : promptComplete) && (
                      <>
                        <p className="terminal-output__line terminal-output__line--dim">&nbsp;</p>
                        <div className="terminal-prompt-line">
                          <span className="terminal-prompt-line__user">traveller@ldn</span>
                          <span className="terminal-prompt-line__sep"> ~ % </span>
                          <div className="terminal-text-display">
                            {currentInput}<span className="terminal-cursor">█</span>
                          </div>
                          <textarea
                            ref={inputRef}
                            value={currentInput}
                            onChange={(e) => setCurrentInput(e.target.value)}
                            onKeyDown={handleTextKeyDown}
                            className="terminal-hidden-input"
                            rows={4}
                          />
                        </div>
                        {enoughInput && (
                          <p className="terminal-output__line terminal-output__line--status is-ready">✓ press enter to continue</p>
                        )}
                      </>
                    )}
                  </>
                )}

                {step === 'processing' && (
                  <>
                    <p className="terminal-output__line terminal-output__line--dim">&nbsp;</p>
                    <p className="terminal-output__line terminal-output__line--dim">processing profile...</p>
                    <p className="terminal-output__line terminal-output__line--dim">building your map of london</p>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
