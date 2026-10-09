export function Enso({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle
        cx="32"
        cy="32"
        r="22"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray="118 20"
        transform="rotate(-72 32 32)"
      />
      <circle cx="32" cy="32" r="3.6" fill="currentColor" />
    </svg>
  )
}

export function WorkZenLogo({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className={`wz-logo${onDark ? ' wz-logo--dark' : ''}`}>
      <Enso size={24} />
      <span className="wz-logo__text">WorkZen</span>
    </span>
  )
}
