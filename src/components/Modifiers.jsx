export default function Modifiers({ mods }) {
  if (!mods || mods.length === 0) return null

  const g = {
    variant: mods.filter(m => m.t === 'variant'),
    remove:  mods.filter(m => m.t === 'remove'),
    extra:   mods.filter(m => m.t === 'extra'),
    add:     mods.filter(m => m.t === 'add'),
    dietary: mods.filter(m => m.t === 'dietary'),
  }

  return (
    <div className="mods-grouped">
      {g.variant.length > 0 && (
        <div className="mod-row">
          {g.variant.map((m, i) => (
            <span key={i} className="mod mod-variant">{m.v}</span>
          ))}
        </div>
      )}
      {g.remove.length > 0 && (
        <div className="mod-row">
          {g.remove.map((m, i) => (
            <span key={i} className="mod mod-remove">NO {m.v}</span>
          ))}
        </div>
      )}
      {g.extra.length > 0 && (
        <div className="mod-row">
          {g.extra.map((m, i) => (
            <span key={i} className="mod mod-extra">
              Extra {m.v}<span className="qty-badge">×{m.qty || 1}</span>
            </span>
          ))}
        </div>
      )}
      {g.add.length > 0 && (
        <div className="mod-row">
          {g.add.map((m, i) => (
            <span key={i} className="mod mod-add">+ {m.v}</span>
          ))}
        </div>
      )}
      {g.dietary.length > 0 && (
        <div className="mod-row">
          {g.dietary.map((m, i) => (
            <span key={i} className="mod mod-dietary">◆ {m.v}</span>
          ))}
        </div>
      )}
    </div>
  )
}
