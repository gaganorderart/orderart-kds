import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_KDS_SERVER ?? 'http://localhost:4000'

// Restaurant ID from URL ?restaurant=1 or env, default 1
function getRestaurantId() {
  const param = new URLSearchParams(window.location.search).get('restaurant')
  return param ?? (import.meta.env.VITE_RESTAURANT_ID ?? '1')
}

export function useOrders() {
  const [orders, setOrders]       = useState([])
  const [connected, setConnected] = useState(false)
  const socketRef                 = useRef(null)
  const restaurantId              = getRestaurantId()

  useEffect(() => {
    const socket = io(SERVER_URL, { reconnectionDelay: 1000 })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      // Join restaurant room — server sends snapshot of current open orders
      socket.emit('join-room', { restaurantId })
    })

    socket.on('disconnect', () => setConnected(false))

    // Server sends all current open orders on room join
    socket.on('snapshot', (data) => setOrders(data))

    // New order arrives from any source (Yii2 job or test HTML)
    socket.on('order.created', (order) => {
      setOrders(prev =>
        prev.find(o => o.id === order.id) ? prev : [...prev, order]
      )
    })

    // Order cancelled in Yii2 (e.g. Uber cancels)
    socket.on('order.cancelled', ({ id }) => {
      setOrders(prev => prev.filter(o => o.id !== id))
    })

    // Another KDS screen bumped this order
    socket.on('order.bumped', ({ id }) => {
      setOrders(prev => prev.map(o =>
        o.id === id
          ? { ...o, status: 'completed', items: o.items.map(i => ({ ...i, done: true })) }
          : o
      ))
    })

    // Another KDS screen reopened this order
    socket.on('order.reopened', ({ id }) => {
      setOrders(prev => prev.map(o =>
        o.id === id ? { ...o, status: 'open' } : o
      ))
    })

    // Another KDS screen toggled an item
    socket.on('item.toggled', ({ order_id, item_id, done }) => {
      setOrders(prev => prev.map(o =>
        o.id === order_id
          ? { ...o, items: o.items.map(i => i.id === item_id ? { ...i, done } : i) }
          : o
      ))
    })

    return () => socket.disconnect()
  }, [restaurantId])

  // Called by bumpOrder in App.jsx — notifies server so other screens sync
  function bump(orderId) {
    fetch(`${SERVER_URL}/api/orders/${orderId}/bump`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId }),
    }).catch(() => {})
  }

  // Called by bumpOrder (reopen path) in App.jsx
  function reopen(orderId) {
    fetch(`${SERVER_URL}/api/orders/${orderId}/reopen`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {})
  }

  // Called by toggleItem in App.jsx — notifies server so other screens sync
  function toggleItem(orderId, itemId, done) {
    fetch(`${SERVER_URL}/api/orders/${orderId}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: done ? 'done' : 'pending' }),
    }).catch(() => {})
  }

  return { orders, setOrders, bump, reopen, toggleItem, connected, restaurantId }
}
