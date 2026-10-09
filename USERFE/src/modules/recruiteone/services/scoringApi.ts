import { apiPost } from '@/lib/api'
import type { CvScore, JobDescription } from '../types'

export function scoreStoredCv(candidateId: string, jd: JobDescription) {
  return apiPost<CvScore>(`/recruiteone/scoring/candidates/${candidateId}`, {
    name: jd.name,
    role: jd.role,
    sector: jd.sector,
    level: jd.level,
    buckets: jd.buckets,
    weights: jd.weights,
  })
}
