import { useEffect, useState } from 'react'
import { loadCvFile } from '@/lib/cvFiles'
import type { Candidate } from '@/modules/recruiteone/types'

export type CvView =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'pdf'; url: string }
  | { kind: 'text'; text: string; url: string }
  | { kind: 'other'; url: string }

export function useCvFile(candidate: Candidate): CvView {
  const [view, setView] = useState<CvView>({ kind: 'loading' })

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    setView({ kind: 'loading' })
    async function load() {
      const stored = candidate.has_file ? await loadCvFile(candidate.id).catch(() => undefined) : undefined
      if (cancelled) return
      if (!stored) {
        setView({ kind: 'missing' })
        return
      }
      const lower = candidate.file_name.toLowerCase()
      const blob = lower.endsWith('.pdf') ? new Blob([stored], { type: 'application/pdf' }) : stored
      objectUrl = URL.createObjectURL(blob)
      if (lower.endsWith('.pdf')) setView({ kind: 'pdf', url: objectUrl })
      else if (lower.endsWith('.txt')) setView({ kind: 'text', text: await stored.text(), url: objectUrl })
      else setView({ kind: 'other', url: objectUrl })
    }
    void load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [candidate.id, candidate.has_file])

  return view
}
