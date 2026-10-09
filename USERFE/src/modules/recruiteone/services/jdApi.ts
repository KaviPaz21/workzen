import { apiPost } from '@/lib/api'
import type { JdDecomposition } from '../types'

export function decomposeJd(name: string, text: string) {
  return apiPost<JdDecomposition>('/recruiteone/jds/decompose', { name, text })
}
