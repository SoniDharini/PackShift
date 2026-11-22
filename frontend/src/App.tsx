import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage.tsx'
import { OptimisePage } from './pages/OptimisePage.tsx'
import { StudioPage } from './pages/StudioPage.tsx'
import { DesignProvider } from './state/DesignContext.tsx'

export default function App() {
  return (
    <DesignProvider>
      <BrowserRouter>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-card"
        >
          Skip to content
        </a>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/optimise" element={<OptimisePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </DesignProvider>
  )
}
