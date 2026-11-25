export default function ConfidenceBadge({ score, label }) {
  const pct = Math.round((score ?? 0) * 100)

  let colorClasses
  if (label === 'high' || score >= 0.75) {
    colorClasses = 'bg-green-100 text-green-800 border-green-200'
  } else if (label === 'medium' || score >= 0.55) {
    colorClasses = 'bg-yellow-100 text-yellow-800 border-yellow-200'
  } else {
    colorClasses = 'bg-orange-100 text-orange-800 border-orange-200'
  }

  const displayLabel = label
    ? label.charAt(0).toUpperCase() + label.slice(1)
    : score >= 0.75
    ? 'High'
    : score >= 0.55
    ? 'Medium'
    : 'Low'

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colorClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {displayLabel} {pct}%
    </span>
  )
}
