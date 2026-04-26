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
import { MatrixBackground } from './MatrixBackground'

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
      <MatrixBackground />
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
