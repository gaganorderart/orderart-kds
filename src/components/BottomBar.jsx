export default function BottomBar({ openCount, doneCount }) {
  return (
    <div className="botbar">
      <div className="bstat">Open <strong>{openCount}</strong></div>
      <div className="bsep" />
      <div className="bstat">Completed <strong>{doneCount}</strong></div>
      <div className="bsep" />
      <div className="legend">
        <div className="leg">
          <div className="leg-dot" style={{ background: '#7d2020' }} />Urgent 20+ min
        </div>
        <div className="leg">
          <div className="leg-dot" style={{ background: '#7d3d18' }} />Warning 10–20 min
        </div>
        <div className="leg">
          <div className="leg-dot" style={{ background: '#1a2038' }} />Normal
        </div>
      </div>
      <div className="b-spacer" />
      <div className="printer">
        <div className="pled" />KDS PRINTER 1
      </div>
    </div>
  )
}
