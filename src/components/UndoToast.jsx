import { useRef, useEffect } from 'react'

const UNDO_SECS = 8

export default function UndoToast({ undoState, sessionId, onUndo }) {
  const progRef = useRef(null)

  // Reset and animate progress bar each time a new undo session starts
  useEffect(() => {
    if (!undoState || !progRef.current) return
    const prog = progRef.current
    prog.style.transition = 'none'
    prog.style.width = '100%'
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        prog.style.transition = `width ${UNDO_SECS}s linear`
        prog.style.width = '0%'
      })
    )
  }, [sessionId])

  const visible = !!undoState
  const title   = undoState
    ? `${undoState.order.num}${undoState.order.name ? ' · ' + undoState.order.name : ''} bumped`
    : ''

  return (
    <div className={`toast${visible ? ' visible' : ''}`}>
      <div className="toast-icon">✅</div>
      <div className="toast-body">
        <div className="toast-title">{title}</div>
        <div className="toast-sub">
          Tap UNDO within <span className="toast-cd">{undoState?.cdLeft ?? UNDO_SECS}</span>s to restore
        </div>
      </div>
      <button className="toast-undo" onClick={onUndo}>↩ UNDO</button>
      <div className="toast-prog" ref={progRef} style={{ width: '100%' }} />
    </div>
  )
}
