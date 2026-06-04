import { useState, useRef, useEffect } from 'react'
import { useOrders } from './hooks/useOrders'
import TopBar from './components/TopBar'
import OrderGrid from './components/OrderGrid'
import BottomBar from './components/BottomBar'
import UndoToast from './components/UndoToast'

const UNDO_SECS = 8

export default function App() {
  const { orders, setOrders, bump, reopen, toggleItem: serverToggle, connected } = useOrders()
  const [activeTab, setActiveTab] = useState('open')
  const [activeSrc, setActiveSrc] = useState('all')
  const [undoState, setUndoState] = useState(null)
  const [undoSessionId, setUndoSessionId] = useState(0)

  const undoTimerRef  = useRef(null)
  const undoCdTickRef = useRef(null)
  const cdLeftRef     = useRef(UNDO_SECS)

  // Tick elapsed time every minute for open orders
  useEffect(() => {
    const id = setInterval(() => {
      setOrders(prev =>
        prev.map(o => o.status === 'open' ? { ...o, elapsed: (o.elapsed ?? 0) + 1 } : o)
      )
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const openCount = orders.filter(o => o.status === 'open').length
  const doneCount = orders.filter(o => o.status === 'completed').length

  function toggleItem(orderId, itemId) {
    navigator.vibrate?.(25)
    const order = orders.find(o => o.id === orderId)
    if (!order || order.status === 'completed') return
    const item = order.items.find(i => i.id === itemId)
    if (!item) return
    const nextDone = !item.done
    setOrders(prev => prev.map(o =>
      o.id !== orderId ? o : {
        ...o,
        items: o.items.map(i => i.id === itemId ? { ...i, done: nextDone } : i),
      }
    ))
    serverToggle(orderId, itemId, nextDone)
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
      reopen(orderId)
      return
    }

    navigator.vibrate?.([40, 20, 60])
    const snapshot = JSON.parse(JSON.stringify(order))
    setOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, status: 'completed', items: o.items.map(i => ({ ...i, done: true })) }
        : o
    ))
    bump(orderId)
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
    reopen(orderId)
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
      <BottomBar openCount={openCount} doneCount={doneCount} connected={connected} />
      <UndoToast
        undoState={undoState}
        sessionId={undoSessionId}
        onUndo={doUndo}
      />
    </>
  )
}
