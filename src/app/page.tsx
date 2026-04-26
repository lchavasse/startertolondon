import { redirect } from 'next/navigation'

// Terminal onboarding (see src/components/TerminalOnboarding.tsx) is parked
// while we focus on the knowledge base. Restore by returning <TerminalOnboarding /> here.
// In the meantime / is an alias for /explore — change here if /explore stops being the canonical landing.
export default function Home() {
  redirect('/explore')
}
