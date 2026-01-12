import { Outlet, useMatches } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import './App.scss'

function App() {
  const matches = useMatches()

  const pageTitle = useMemo(() => {
    // pick deepest route with a handle.title
    for (let i = matches.length - 1; i >= 0; i--) {
      const h = (matches[i].handle || {}) as { title?: string }
      if (h?.title) return h.title
    }
    return 'my-app'
  }, [matches])

  useEffect(() => {
    document.title = pageTitle
  }, [pageTitle])

  return (
    <>
      <Outlet />
    </>
  )
}

export default App
