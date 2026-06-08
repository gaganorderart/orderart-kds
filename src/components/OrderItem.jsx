import { useState } from 'react'
import Modifiers from './Modifiers'

export default function OrderItem({ item, orderId, isCompleted, onToggle }) {
  const [flashing, setFlashing] = useState(false)

  function handleClick() {
    if (isCompleted) return
    if (!item.done) {
      setFlashing(true)
      setTimeout(() => setFlashing(false), 300)
    }
    onToggle(orderId, item.id)
  }

  return (
    <div
      className={`item${item.done ? ' done' : ''}${flashing ? ' flash' : ''}`}
      onClick={handleClick}
    >
      <div className="chk">{item.done ? '✓' : ''}</div>
      <div className="item-qty">{item.qty}</div>
      <div className="item-body">
        <div className="item-name">{item.name}</div>
        <Modifiers mods={item.mods} />
        {item.comment && (
          <div className="item-comment">
            <span className="ic-icon">💬</span>{item.comment}
          </div>
        )}
      </div>
      <div className="item-hint">tap<br />undo</div>
    </div>
  )
}
