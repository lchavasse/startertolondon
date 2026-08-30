'use client'

import { useRouter } from 'next/navigation'

export function CrmLogoutButton() {
  const router = useRouter()

  async function logout() {
    await fetch('/api/crm/auth', { method: 'DELETE' })
    router.push('/crm/login')
    router.refresh()
  }

  return (
    <button
      onClick={logout}
      className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] hover:text-[var(--muted-strong)]"
    >
      Sign out
    </button>
  )
}
