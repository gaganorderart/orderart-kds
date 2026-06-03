import { urgency, timerCls, fmtTimer, getDueIn, SRC_META, CATEGORY_ORDER, CATEGORY_LABELS } from '../utils'
import OrderItem from './OrderItem'

export default function OrderCard({ order, onToggleItem, onBumpOrder }) {
  const isDone     = order.status === 'completed'
  const urg        = isDone ? 'done' : urgency(order.elapsed)
  const tc         = timerCls(order.elapsed)
  const meta       = SRC_META[order.source] || { icon: '?', label: order.source }
  const doneItems  = order.items.filter(i => i.done).length
  const total      = order.items.length
  const allDone    = doneItems === total
  const pct        = total > 0 ? Math.round((doneItems / total) * 100) : 0

  const isTable    = order.source === 'dine-in'
  const tableMatch = isTable && order.name ? order.name.match(/Table\s+(\S+)/i) : null
  const tableNum   = tableMatch ? tableMatch[1] : null

  const isFutureDate = !!order.sched_date
  const dueIn        = isFutureDate ? null : getDueIn(order.sched)
  const dueInCls     = dueIn !== null ? (dueIn <= 5 ? 'di-soon' : dueIn <= 15 ? 'di-close' : '') : ''
  const isUrgentDue  = !isDone && !isFutureDate && dueIn !== null && dueIn <= 5

  // Group items by category
  const catGroups = {}
  order.items.forEach(item => {
    const c = item.cat || 'mains'
    if (!catGroups[c]) catGroups[c] = []
    catGroups[c].push(item)
  })
  const activeCats = CATEGORY_ORDER.filter(c => catGroups[c])
  const multiCat   = activeCats.length > 1

  const showRow2 = !isDone && (isFutureDate || dueIn !== null || order.sched)

  return (
    <div className={`card${isUrgentDue ? ' urgent-due' : ''}`}>
      <div className={`card-hdr h-${urg}`}>
        <div className="hdr-r1">
          <div className="h-ordnum">{order.num}</div>

          {isTable && tableNum
            ? <div className="h-srcbadge h-tablebadge si-dine-in">Table {tableNum}</div>
            : <div className={`h-srcbadge si-${order.source}`}>{meta.icon}</div>
          }

          {!(isTable && tableNum) && order.name && (
            <div className="h-name">{order.name}</div>
          )}

          {isDone
            ? <div className="h-donetag">✓ DONE</div>
            : <div className={`h-elapsed ${tc}`}><span className="he-icon">⏱</span>{fmtTimer(order.elapsed)}</div>
          }
        </div>

        {showRow2 && (
          <div className="hdr-r2">
            {isFutureDate && (
              <div className="h-datedue"><span>📅</span>{order.sched_date}</div>
            )}
            {!isFutureDate && dueIn !== null && (
              <div className={`h-duein ${dueInCls}`}>
                {dueIn > 0 ? `Due in ${dueIn}m` : 'Due NOW'}
              </div>
            )}
            {order.sched && (
              <div className="h-duetime"><span>🕐</span>{order.sched}</div>
            )}
          </div>
        )}
      </div>

      {isUrgentDue && (
        <div className="urgent-banner">
          <span>⚡</span> Due in {dueIn > 0 ? `${dueIn}m` : 'NOW'} — Prepare immediately
        </div>
      )}

      <div className="prog-track">
        <div className="prog-fill" style={{ width: `${pct}%` }} />
      </div>

      {order.note && (
        <div className="note-banner">
          <span className="note-icon">⚠️</span>
          <span>{order.note}</span>
        </div>
      )}

      <div className="items-scroll">
        {activeCats.map((cat, idx) => (
          <div key={cat}>
            {multiCat && (
              <div className={`cat-header${idx === 0 ? ' cat-first' : ''}`}>
                {CATEGORY_LABELS[cat]}
              </div>
            )}
            {catGroups[cat].map(item => (
              <OrderItem
                key={item.id}
                item={item}
                orderId={order.id}
                isCompleted={isDone}
                onToggle={onToggleItem}
              />
            ))}
          </div>
        ))}
      </div>

      <button
        className={`bump-btn ${isDone ? 'b-reopen' : allDone ? 'b-ready' : 'b-partial'}`}
        onClick={() => onBumpOrder(order.id)}
      >
        {isDone
          ? '↩ REOPEN ORDER'
          : allDone
            ? '✓ BUMP ORDER — All Items Ready!'
            : `BUMP ORDER · ${doneItems}/${total} items done`
        }
      </button>
    </div>
  )
}
