import { redirect } from 'next/navigation'

// Terminal onboarding (see src/components/TerminalOnboarding.tsx) is parked
// while we focus on the knowledge base. Restore by returning <TerminalOnboarding /> here.
export default function Home() {
  redirect('/explore')
}
