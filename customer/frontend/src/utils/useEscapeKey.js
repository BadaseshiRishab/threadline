import { useEffect } from 'react'

// Calls onEscape when the Escape key is pressed, while active is true (e.g. to close an open dialog).
export function useEscapeKey(active, onEscape) {
  useEffect(() => {
    if (!active) return
    const closeOnEscape = (event) => { if (event.key === 'Escape') onEscape() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [active])
}
