interface ScoreRingProps {
  value: number
  size?: number
}

function bandOf(value: number) {
  if (value >= 75) return 'high'
  if (value >= 50) return 'mid'
  return 'low'
}

export function ScoreRing({ value, size = 56 }: ScoreRingProps) {
  const stroke = Math.max(4, Math.round(size / 10))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.max(0, Math.min(100, value)) / 100)
  return (
    <span
      className={`score-ring score-ring--${bandOf(value)}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Match score ${value} out of 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="score-ring__track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="score-ring__arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="score-ring__value" style={{ fontSize: Math.round(size * 0.34) }}>
        {value}
      </span>
    </span>
  )
}
