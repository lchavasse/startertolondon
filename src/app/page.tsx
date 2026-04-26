import { MatrixBackground } from '@/components/MatrixBackground'
import { LandingChooser } from '@/components/LandingChooser'

export default function Home() {
  return (
    <main className="landing-shell">
      <MatrixBackground />
      <LandingChooser />
    </main>
  )
}
