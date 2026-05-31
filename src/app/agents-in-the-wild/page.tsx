import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { withUtm } from '@/lib/utm'

const APPLY_URL = withUtm('https://luma.com/qvvtbdlh')
const DEMO_URL = withUtm('https://luma.com/awkhqorw')

export const metadata: Metadata = {
  title: 'Agents in the Wild — build sprint & demo competition',
  description:
    'A two-week build sprint for autonomy in the physical world. 50 builders. £2k+ prize pool. Demo night at LocalGlobe.',
}

const TIMELINE = [
  { date: '13.06', event: 'Kickoff Day @ Blue Garage', note: 'access equipment' },
  { date: '21.06', event: 'Check In Day @ Blue Garage', note: 'optional · equipment' },
  { date: '28.06', event: 'Project submission deadline', note: 'submit' },
  { date: '07.07', event: 'Demo Night @ LocalGlobe', note: 'top five present', href: DEMO_URL },
]

// ratio = source width/height, so logos render at a uniform height with no
// distortion. invert lifts dark-on-transparent marks off the black background.
const LOGO_H = 30
const SPONSORS = [
  { name: 'Blue Garage', src: '/agents/sponsor-blue-garage.png', ratio: 225 / 88 },
  { name: 'Partner', src: '/agents/sponsor-gradient.png', ratio: 156 / 184 },
  { name: 'Raspberry Pi', src: '/agents/sponsor-raspberry-pi.png', ratio: 960 / 1226 },
  { name: 'Partner', src: '/agents/sponsor-unicorn.png', ratio: 1, invert: true },
]

const SHAPES = [
  'A Pi watching an office, killing the lights when nobody’s there',
  'A wildlife camera that decides when to move and what to capture',
  'A plant monitor that escalates only when something actually matters',
  'A bin that navigates the office, taking direction from a fixed camera overhead',
  'A conversational agent embedded in a real social setting, adapting to what it hears',
  'An arm, a robot, a drone — pushing further on something you’ve already started',
]

const CRITERIA = [
  { name: 'Innovation', desc: 'Is the idea novel, inspired, weird in the right way?' },
  { name: 'Impact', desc: 'Is this a real, hard, or civilisational problem worth taking on?' },
  { name: 'Progress', desc: 'What did you actually achieve in two weeks?' },
  { name: 'Deployment', desc: 'Did you get the system out of the lab and into the physical world?' },
]

const RHYTHM = [
  {
    phase: 'Day 0 — Kickoff',
    desc: '**Blue Garage, Lewisham.** Meet other builders, see the kit, scope your project, find collaborators.',
  },
  { phase: 'Days 1–7 — Build', desc: 'Get a deployable v0 working. **Don’t polish.**' },
  { phase: 'Days 7–13 — Deploy', desc: 'Put it in the wild. Watch it break. Iterate.' },
  { phase: 'Day 14 — Submit', desc: 'A short video and a written reflection. Slides also fine.' },
  { phase: 'Demo Night · 7 Jul', desc: 'Top five projects present live to win the prize pool.' },
]

const FAQ = [
  {
    q: 'Do I have to deploy on hardware?',
    a: 'Yes, broadly. We’ll accept submissions that don’t quite break earth, but we expect the winning projects to successfully interact with the physical world.',
  },
  {
    q: 'Does it have to be fully offline?',
    a: 'No. Hybrid is fine, and cloud inference is necessary for many projects. Local-first preserves privacy and unlocks environments where you can’t rely on internet access.',
  },
  {
    q: 'Can I build on OpenClaw or other existing robotics frameworks?',
    a: 'You can. But consider if you can be more innovative. Why not start with a Pi harness and build just the features you need — including appropriate guardrails?',
  },
  {
    q: 'Can I work on my existing project?',
    a: 'Yes, very much encouraged — but you’ll be judged specifically on progress during the two weeks. Maybe bring someone new from the hack on board to help push it forward.',
  },
  {
    q: 'How much time should I spend on this?',
    a: 'Up to you. We’ve intentionally given you two weeks rather than a single weekend so you have room to ideate, then deploy. We don’t expect you to work on this every day.',
  },
  {
    q: 'What does the submission look like?',
    a: 'A short video and a written reflection — what you set out to do, what you learned. Slides or notes are fine. The top five present at Demo Night — live demos preferred.',
  },
]

// minimal **bold** renderer for the small set of strings above
function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  )
}

export default function AgentsInTheWildPage() {
  return (
    <main className="aitw-shell">
      <div className="aitw-inner">
        {/* topbar */}
        <div className="aitw-topbar">
          <span className="aitw-brand">
            <Link href="/">london calling</Link> / agents in the wild
          </span>
          <a className="aitw-cta aitw-cta--ghost" href={APPLY_URL} target="_blank" rel="noopener noreferrer">
            apply <span className="aitw-cta__arrow">→</span>
          </a>
        </div>

        {/* HERO */}
        <section className="aitw-hero">
          <div>
            <p className="aitw-eyebrow">build sprint · demo competition</p>
            <h1 className="aitw-hero__title">
              <span>AGENTS</span>
              <span>IN THE WILD</span>
            </h1>
            <p className="aitw-hook">
              Fed up of vibe-coded hackathon projects that die on Sunday night?{' '}
              <strong>Agents in the Wild</strong> is a chance to start something bold — or lock in
              progress on that project gathering dust.
            </p>

            <div className="aitw-stats">
              <div className="aitw-stat">
                <span className="aitw-stat__value">50</span>
                <span className="aitw-stat__label">builders</span>
              </div>
              <div className="aitw-stat">
                <span className="aitw-stat__value">2 wks</span>
                <span className="aitw-stat__label">to build</span>
              </div>
              <div className="aitw-stat">
                <span className="aitw-stat__value">£2k+</span>
                <span className="aitw-stat__label">prize pool</span>
              </div>
              <div className="aitw-stat">
                <span className="aitw-stat__value">rPis</span>
                <span className="aitw-stat__label">3D printers &amp; more</span>
              </div>
            </div>

            <div className="aitw-herosponsors">
              <span className="aitw-herosponsors__label">with thanks</span>
              <div className="aitw-herosponsors__row">
                {SPONSORS.map((s, i) => (
                  <span className={`aitw-herosponsors__logo${s.invert ? ' aitw-herosponsors__logo--invert' : ''}`} key={i}>
                    <Image src={s.src} alt={s.name} height={LOGO_H} width={Math.round(LOGO_H * s.ratio)} />
                  </span>
                ))}
              </div>
            </div>

            <div className="aitw-ctarow">
              <a className="aitw-cta" href={APPLY_URL} target="_blank" rel="noopener noreferrer">
                apply now <span className="aitw-cta__arrow">→</span>
              </a>
              <a className="aitw-demolink" href={DEMO_URL} target="_blank" rel="noopener noreferrer">
                demo night at LocalGlobe →
              </a>
            </div>
          </div>

          <div className="aitw-frame aitw-hero__frame">
            <div className="aitw-frame__bar">
              <span className="aitw-frame__dots">
                <i /><i /><i />
              </span>
              <span className="aitw-frame__file">~/wild/deep-sea.cam — live</span>
            </div>
            <div className="aitw-frame__img">
              <Image src="/agents/sub.png" alt="An agent deployed deep in the wild" width={512} height={512} priority />
            </div>
            <p className="aitw-frame__caption">
              <b>perceive → decide → act</b> · out of the lab, into the physical world
            </p>
          </div>
        </section>

        {/* TIMELINE */}
        <section className="aitw-section">
          <p className="aitw-eyebrow">timeline</p>
          <h2 className="aitw-section__title">Two weeks, four checkpoints</h2>
          <div className="aitw-timeline">
            {TIMELINE.map((t) =>
              t.href ? (
                <a
                  className="aitw-timeline__row aitw-timeline__row--link"
                  key={t.date}
                  href={t.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="aitw-timeline__date">{t.date}</span>
                  <span className="aitw-timeline__event">{t.event}</span>
                  <span className="aitw-timeline__note">{t.note} →</span>
                </a>
              ) : (
                <div className="aitw-timeline__row" key={t.date}>
                  <span className="aitw-timeline__date">{t.date}</span>
                  <span className="aitw-timeline__event">{t.event}</span>
                  <span className="aitw-timeline__note">{t.note}</span>
                </div>
              )
            )}
          </div>
        </section>

        {/* BUILD */}
        <section className="aitw-section">
          <p className="aitw-eyebrow">build</p>
          <h2 className="aitw-section__title">What you&apos;re building</h2>
          <p className="aitw-section__lead">
            A contained system that perceives something in its real environment, makes a decision
            nobody pre-programmed, and takes an action that matters.{' '}<br/>
            <em>Start fresh, or take an existing project somewhere it hasn&apos;t been.</em>
          </p>
          <p className="aitw-eyebrow">ideas</p>
          <div className="aitw-grid">
            {SHAPES.map((shape, i) => (
              <div className="aitw-card" key={i}>
                <span className="aitw-card__idx">{String(i + 1).padStart(2, '0')}</span>
                <p className="aitw-card__text">{shape}</p>
              </div>
            ))}
          </div>
        </section>

        {/* JUDGING */}
        <section className="aitw-section">
          <p className="aitw-eyebrow">how we judge</p>
          <h2 className="aitw-section__title">Four criteria, equally weighted</h2>
          <div className="aitw-criteria">
            {CRITERIA.map((c) => (
              <div className="aitw-crit" key={c.name}>
                <div className="aitw-crit__head">
                  <h3 className="aitw-crit__name">{c.name}</h3>
                  <span className="aitw-crit__weight">25%</span>
                </div>
                <p className="aitw-crit__desc">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* WORKED EXAMPLE */}
        <section className="aitw-section">
          <p className="aitw-eyebrow">worked example</p>
          <h2 className="aitw-section__title">The office lights</h2>
          <div className="aitw-case">
            <div className="aitw-case__body">
              <span className="aitw-case__tag">case file · empty room</span>
              <p>
                A Pi with a camera, a small vision model running locally, a 3D-printed module that
                sits over the light switch and <b>physically flips it.</b> Local inference preserves
                privacy — no faces leave the device.
              </p>
              <p>
                Tricky things to navigate: how is the system powered? It has to figure out what
                counts as &quot;empty&quot; in a room where someone might just be very still at their
                desk. Can this be done with local inference — or does the final decision get
                escalated in a <b>hybrid model?</b>
              </p>
              <p className="aitw-case__kicker">
                A measured project that ships end-to-end will usually beat a wildly ambitious one
                that doesn&apos;t. Not always. Surprise us.
              </p>
            </div>
            <div className="aitw-frame">
              <div className="aitw-frame__bar">
                <span className="aitw-frame__dots">
                  <i /><i /><i />
                </span>
                <span className="aitw-frame__file">~/wild/lunar.deploy — idle</span>
              </div>
              <div className="aitw-frame__img">
                <Image src="/agents/moon.png" alt="An agent waiting in the wild" width={512} height={512} />
              </div>
              <p className="aitw-frame__caption">
                <b>deploy anywhere</b> · watch it break · iterate
              </p>
            </div>
          </div>
        </section>

        {/* RHYTHM */}
        <section className="aitw-section">
          <p className="aitw-eyebrow">the rhythm</p>
          <h2 className="aitw-section__title">Ideate, then deploy</h2>
          <div className="aitw-rhythm">
            {RHYTHM.map((r) => (
              <div className="aitw-rhythm__row" key={r.phase}>
                <span className="aitw-rhythm__phase">{r.phase}</span>
                <p className="aitw-rhythm__desc">{renderBold(r.desc)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PROVIDE */}
        <section className="aitw-section">
          <p className="aitw-eyebrow">what we provide</p>
          <h2 className="aitw-section__title">Kit, space, mentors</h2>
          <div className="aitw-provide">
            Kickoff at <b>Blue Garage</b> with loan equipment (<b>Raspberry Pis, cameras</b>), 3D
            printers, electronics facilities, and mentors on hand. Continued access throughout the
            sprint. Small budget for specific components if you need them.
          </div>
        </section>

        {/* FAQ */}
        <section className="aitw-section">
          <p className="aitw-eyebrow">faq</p>
          <h2 className="aitw-section__title">Questions, answered</h2>
          <div className="aitw-faq">
            {FAQ.map((f) => (
              <details className="aitw-faq__item" key={f.q}>
                <summary className="aitw-faq__q">{f.q}</summary>
                <p className="aitw-faq__a">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CLOSING CTA */}
        <section className="aitw-close">
          <p className="aitw-close__title">GET IT INTO THE WILD.</p>
          <p className="aitw-close__sub">
            50 builders · 2 weeks · £2k+ prize pool ·{' '}
            <a className="aitw-demolink" href={DEMO_URL} target="_blank" rel="noopener noreferrer">
              demo night at LocalGlobe →
            </a>
          </p>
          <a className="aitw-cta" href={APPLY_URL} target="_blank" rel="noopener noreferrer">
            apply now <span className="aitw-cta__arrow">→</span>
          </a>
        </section>
      </div>
    </main>
  )
}
