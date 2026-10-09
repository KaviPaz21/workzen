import type { CSSProperties } from 'react'

export function stagger(index: number) {
  return { '--i': index } as CSSProperties
}
