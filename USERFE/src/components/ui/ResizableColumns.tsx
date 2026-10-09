import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

interface ResizableColumnsProps {
  left: ReactNode
  center: ReactNode
  right: ReactNode
  storageKey: string
  leftLabel: string
  rightLabel: string
}

interface Widths {
  left: number
  right: number
}

const limits = { left: [170, 440], right: [280, 620] } as const
const minCenter = 260
const handleWidth = 8
const defaults: Widths = { left: 240, right: 360 }

function loadWidths(storageKey: string): Widths {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null')
    if (parsed && typeof parsed.left === 'number' && typeof parsed.right === 'number') return parsed
  } catch {
    return defaults
  }
  return defaults
}

function clamp(value: number, [min, max]: readonly [number, number]) {
  return Math.max(min, Math.min(max, value))
}

export function ResizableColumns({ left, center, right, storageKey, leftLabel, rightLabel }: ResizableColumnsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [widths, setWidths] = useState<Widths>(() => loadWidths(storageKey))
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null)
  const drag = useRef({ startX: 0, startWidth: 0 })

  const persist = useCallback(
    (next: Widths) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        return
      }
    },
    [storageKey],
  )

  const resize = useCallback((side: 'left' | 'right', width: number) => {
    const total = containerRef.current?.clientWidth ?? 1200
    setWidths((current) => {
      const other = side === 'left' ? current.right : current.left
      const room = total - other - minCenter - handleWidth * 2
      const next = clamp(Math.min(width, room), limits[side])
      return { ...current, [side]: next }
    })
  }, [])

  function onPointerDown(side: 'left' | 'right') {
    return (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = { startX: event.clientX, startWidth: widths[side] }
      setDragging(side)
    }
  }

  function onPointerMove(side: 'left' | 'right') {
    return (event: PointerEvent<HTMLDivElement>) => {
      if (dragging !== side) return
      const delta = event.clientX - drag.current.startX
      resize(side, side === 'left' ? drag.current.startWidth + delta : drag.current.startWidth - delta)
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setDragging(null)
    persist(widths)
  }

  function onKeyDown(side: 'left' | 'right') {
    return (event: KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 48 : 16
      let change = 0
      if (event.key === 'ArrowLeft') change = side === 'left' ? -step : step
      if (event.key === 'ArrowRight') change = side === 'left' ? step : -step
      if (change === 0) return
      event.preventDefault()
      const next = clamp(widths[side] + change, limits[side])
      resize(side, next)
      persist({ ...widths, [side]: next })
    }
  }

  const handle = (side: 'left' | 'right', label: string) => (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={widths[side]}
      aria-valuemin={limits[side][0]}
      aria-valuemax={limits[side][1]}
      tabIndex={0}
      className={`resizable__handle${dragging === side ? ' resizable__handle--active' : ''}`}
      onPointerDown={onPointerDown(side)}
      onPointerMove={onPointerMove(side)}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown(side)}
    />
  )

  return (
    <div
      ref={containerRef}
      className="resizable"
      style={{ '--left-width': `${widths.left}px`, '--right-width': `${widths.right}px` } as React.CSSProperties}
    >
      <div className="resizable__pane">{left}</div>
      {handle('left', leftLabel)}
      <div className="resizable__pane">{center}</div>
      {handle('right', rightLabel)}
      <div className="resizable__pane">{right}</div>
    </div>
  )
}
