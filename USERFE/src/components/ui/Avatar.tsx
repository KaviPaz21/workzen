function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase()
}

function toneOf(name: string) {
  let total = 0
  for (const character of name) total += character.charCodeAt(0)
  return total % 5
}

export function Avatar({ name, small }: { name: string; small?: boolean }) {
  return (
    <span className={`avatar avatar--${toneOf(name)}${small ? ' avatar--sm' : ''}`} aria-hidden="true">
      {initialsOf(name)}
    </span>
  )
}
