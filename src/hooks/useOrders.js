import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_KDS_SERVER ?? 'http://localhost:4000'

function getRestaurantId() {
  const param = new URLSearchParams(window.location.search).get('restaurant')
  return param ?? (import.meta.env.VITE_RESTAURANT_ID ?? '1')
}

// Server uses toId() which may return numbers; always compare as strings
const sameId = (a, b) => String(a) === String(b)

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
      socket.emit('join-room', { restaurantId })
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('snapshot', (data) => setOrders(data))

    socket.on('order.created', (order) => {
      setOrders(prev =>
        prev.find(o => sameId(o.id, order.id)) ? prev : [...prev, order]
      )
    })

    socket.on('order.cancelled', ({ id }) => {
      setOrders(prev => prev.filter(o => !sameId(o.id, id)))
    })

    socket.on('order.bumped', ({ id }) => {
      setOrders(prev => prev.map(o =>
        sameId(o.id, id)
          ? { ...o, status: 'completed', items: o.items.map(i => ({ ...i, done: true })) }
          : o
      ))
    })

    socket.on('order.reopened', ({ id }) => {
      setOrders(prev => prev.map(o =>
        sameId(o.id, id)
          ? { ...o, status: 'open', items: o.items.map(i => ({ ...i, done: false })) }
          : o
      ))
    })

    socket.on('item.toggled', ({ order_id, item_id, done }) => {
      setOrders(prev => prev.map(o =>
        sameId(o.id, order_id)
          ? { ...o, items: o.items.map(i => sameId(i.id, item_id) ? { ...i, done } : i) }
          : o
      ))
    })

    return () => socket.disconnect()
  }, [restaurantId])

  function bump(orderId) {
    fetch(`${SERVER_URL}/api/orders/${orderId}/bump`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId }),
    }).catch(() => {})
  }

  function reopen(orderId) {
    fetch(`${SERVER_URL}/api/orders/${orderId}/reopen`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId }),
    }).catch(() => {})
  }

  function toggleItem(orderId, itemId, done) {
    fetch(`${SERVER_URL}/api/orders/${orderId}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: done ? 'done' : 'pending', restaurant_id: restaurantId }),
    }).catch(() => {})
  }

  return { orders, setOrders, bump, reopen, toggleItem, connected, restaurantId }
}
