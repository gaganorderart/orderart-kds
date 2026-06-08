import { getDueIn } from '../utils'
import OrderCard from './OrderCard'

export default function OrderGrid({ orders, activeTab, activeSrc, onToggleItem, onBumpOrder }) {
  const visible = orders
    .filter(o => {
      if (o.status !== activeTab) return false
      if (activeSrc !== 'all' && o.source !== activeSrc) return false
      return true
    })
    .sort((a, b) => {
      const aDueIn  = getDueIn(a.sched)
      const bDueIn  = getDueIn(b.sched)
      const aUrgent = aDueIn !== null && aDueIn <= 5
      const bUrgent = bDueIn !== null && bDueIn <= 5
      if (aUrgent && !bUrgent) return -1
      if (!aUrgent && bUrgent) return 1
      if (aUrgent && bUrgent)  return aDueIn - bDueIn
      return 0
    })

  if (visible.length === 0) {
    const [icon, title, sub] = activeTab === 'open'
      ? ['🍳', 'All caught up!', 'No open orders — new orders will appear here.']
      : ['✅', 'No completed orders', 'Bump an order to see it here.']
    return (
      <div className="grid">
        <div className="empty">
          <div className="ei">{icon}</div>
          <div className="et">{title}</div>
          <div className="es">{sub}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid">
      {visible.map(order => (
        <OrderCard
          key={order.id}
          order={order}
          onToggleItem={onToggleItem}
          onBumpOrder={onBumpOrder}
        />
      ))}
    </div>
  )
}
