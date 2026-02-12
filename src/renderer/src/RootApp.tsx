import { useEffect } from 'react'
import { DashboardApp } from './features/dashboard/DashboardApp'
import { OverlayApp } from './features/overlay/OverlayApp'

export function RootApp() {
  const view = new URLSearchParams(window.location.search).get('view')
  const resolvedView = view === 'dashboard' ? 'dashboard' : 'overlay'

  useEffect(() => {
    document.body.dataset.echoView = resolvedView
    return () => {
      delete document.body.dataset.echoView
    }
  }, [resolvedView])

  if (view === 'dashboard') {
    return <DashboardApp />
  }

  return <OverlayApp />
}
