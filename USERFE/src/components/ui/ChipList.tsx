export function ChipList({ items, limit = 3 }: { items: string[]; limit?: number }) {
  const visible = items.slice(0, limit)
  const hidden = items.length - visible.length
  return (
    <div className="chip-list">
      {visible.map((item) => (
        <span key={item} className="chip" title={item}>
          {item}
        </span>
      ))}
      {hidden > 0 && <span className="chip">+{hidden}</span>}
    </div>
  )
}
