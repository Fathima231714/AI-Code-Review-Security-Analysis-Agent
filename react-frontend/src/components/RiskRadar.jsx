const AXES = [
  ['Critical', 'critical'], ['High', 'high'], ['Medium', 'medium'],
  ['Low', 'low'], ['Quality', 'quality'], ['Health', 'health'],
]

function point(index, value, radius = 82) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / AXES.length
  const distance = radius * value
  return [110 + Math.cos(angle) * distance, 110 + Math.sin(angle) * distance]
}

export default function RiskRadar({ review }) {
  const breakdown = review?.severity_breakdown || {}
  const quality = review?.code_quality?.length || 0
  const values = [
    Math.min(1, (breakdown.critical || 0) / 2),
    Math.min(1, (breakdown.high || 0) / 3),
    Math.min(1, (breakdown.medium || 0) / 4),
    Math.min(1, (breakdown.low || 0) / 5),
    Math.min(1, quality / 5),
    1 - Math.min(1, (review?.health_score ?? 100) / 100),
  ]
  const polygon = values.map((value, index) => point(index, value).join(',')).join(' ')
  const labels = AXES.map(([label], index) => {
    const [x, y] = point(index, 1.25)
    return <text key={label} x={x} y={y} textAnchor="middle" className="radar-label">{label}</text>
  })

  return <section className="radar-card" aria-label="Risk radar visualization">
    <div><p className="eyebrow">Visual risk analysis</p><h3>Security radar</h3><p>The violet area shows the current review profile. Further from the center means more attention is required.</p><div className="radar-legend"><span><i /> Current risk</span><span><b /> Low attention</span><span><b /> High attention</span></div></div>
    <div className="radar-plot"><svg viewBox="0 0 220 220" role="img" aria-label="Radar chart showing risk across severity and quality">
      {[.25, .5, .75, 1].map((level) => <polygon key={level} points={AXES.map((_, index) => point(index, level).join(',')).join(' ')} className="radar-grid" />)}
      {AXES.map((_, index) => <line key={index} x1="110" y1="110" x2={point(index, 1)[0]} y2={point(index, 1)[1]} className="radar-axis" />)}
      <polygon points={polygon} className="radar-area" />
      {values.map((value, index) => { const [x, y] = point(index, value); return <circle key={index} cx={x} cy={y} r="3" className="radar-dot" /> })}
      {labels}
    </svg><div className="radar-score"><strong>{review?.health_score ?? 100}</strong><span>health score</span></div></div>
  </section>
}

