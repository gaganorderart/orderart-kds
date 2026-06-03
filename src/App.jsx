import { useState, useRef, useEffect } from 'react'
import { INITIAL_ORDERS } from './data'
import TopBar from './components/TopBar'
import OrderGrid from './components/OrderGrid'
import BottomBar from './components/BottomBar'
import UndoToast from './components/UndoToast'

const UNDO_SECS = 8

export default function App() {
  const [orders, setOrders] = useState(INITIAL_ORDERS)
  const [activeTab, setActiveTab] = useState('open')
  const [activeSrc, setActiveSrc] = useState('all')
  const [undoState, setUndoState] = useState(null)
  const [undoSessionId, setUndoSessionId] = useState(0)

  const undoTimerRef  = useRef(null)
  const undoCdTickRef = useRef(null)
  const cdLeftRef     = useRef(UNDO_SECS)

  // Simulate elapsed time ticking every minute
  useEffect(() => {
    const id = setInterval(() => {
      setOrders(prev =>
        prev.map(o => o.status === 'open' ? { ...o, elapsed: o.elapsed + 1 } : o)
      )
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const openCount = orders.filter(o => o.status === 'open').length
  const doneCount = orders.filter(o => o.status === 'completed').length

  function toggleItem(orderId, itemId) {
    navigator.vibrate?.(25)
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId || o.status === 'completed') return o
      return {
        ...o,
        items: o.items.map(item =>
          item.id === itemId ? { ...item, done: !item.done } : item
        ),
      }
    }))
  }

  function bumpOrder(orderId) {
    const order = orders.find(o => o.id === orderId)
    if (!order) return

    if (order.status === 'completed') {
      navigator.vibrate?.(40)
      setOrders(prev => prev.map(o =>
        o.id === orderId
          ? { ...o, status: 'open', items: o.items.map(i => ({ ...i, done: false })) }
          : o
      ))
      return
    }

    navigator.vibrate?.([40, 20, 60])
    const snapshot = JSON.parse(JSON.stringify(order))
    setOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, status: 'completed', items: o.items.map(i => ({ ...i, done: true })) }
        : o
    ))
    showUndo(order, snapshot)
  }

  function showUndo(order, snapshot) {
    clearTimeout(undoTimerRef.current)
    clearInterval(undoCdTickRef.current)

    cdLeftRef.current = UNDO_SECS
    setUndoSessionId(prev => prev + 1)
    setUndoState({ orderId: order.id, snapshot, cdLeft: UNDO_SECS, order })

    undoCdTickRef.current = setInterval(() => {
      cdLeftRef.current--
      if (cdLeftRef.current <= 0) {
        clearInterval(undoCdTickRef.current)
        setUndoState(null)
      } else {
        setUndoState(prev => prev ? { ...prev, cdLeft: cdLeftRef.current } : null)
      }
    }, 1000)

    undoTimerRef.current = setTimeout(() => {
      setUndoState(null)
    }, UNDO_SECS * 1000)
  }

  function doUndo() {
    if (!undoState) return
    navigator.vibrate?.(60)
    clearTimeout(undoTimerRef.current)
    clearInterval(undoCdTickRef.current)
    const { orderId, snapshot } = undoState
    setOrders(prev => prev.map(o => o.id === orderId ? snapshot : o))
    setUndoState(null)
  }

  return (
    <>
      <TopBar
        activeTab={activeTab}
        activeSrc={activeSrc}
        openCount={openCount}
        doneCount={doneCount}
        onSwitchTab={setActiveTab}
        onFilterSrc={setActiveSrc}
      />
      <OrderGrid
        orders={orders}
        activeTab={activeTab}
        activeSrc={activeSrc}
        onToggleItem={toggleItem}
        onBumpOrder={bumpOrder}
      />
      <BottomBar openCount={openCount} doneCount={doneCount} />
      <UndoToast
        undoState={undoState}
        sessionId={undoSessionId}
        onUndo={doUndo}
      />
    </>
  )
}
