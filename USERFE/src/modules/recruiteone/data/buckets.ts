import type { BucketKey, Buckets, Level, Weights } from '../types'

export interface BucketDefinition {
  key: BucketKey
  label: string
  hint: string
}

export const bucketDefinitions: BucketDefinition[] = [
  { key: 'technical_skills', label: 'Technical skills', hint: 'Tools, languages and methods' },
  { key: 'soft_skills', label: 'Soft skills', hint: 'Communication, leadership, teamwork' },
  { key: 'experience', label: 'Experience', hint: 'Years and type of experience' },
  { key: 'responsibilities', label: 'Responsibilities', hint: 'What the person will do' },
  { key: 'education', label: 'Education', hint: 'Degrees and fields of study' },
  { key: 'certifications', label: 'Certifications', hint: 'Licences and professional certificates' },
  { key: 'job_requirements', label: 'Job requirements', hint: 'Location, travel, availability, other conditions' },
  { key: 'extra_curricular', label: 'Extra-curricular', hint: 'Volunteering, communities, side projects' },
]

export const levelOptions: { value: Level; label: string }[] = [
  { value: 'entry', label: 'Entry' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'executive', label: 'Executive' },
]

export const defaultWeight = 50

export function emptyBuckets(): Buckets {
  return {
    technical_skills: [],
    soft_skills: [],
    experience: [],
    responsibilities: [],
    education: [],
    certifications: [],
    job_requirements: [],
    extra_curricular: [],
  }
}

export function defaultWeights(): Weights {
  return {
    technical_skills: defaultWeight,
    soft_skills: defaultWeight,
    experience: defaultWeight,
    responsibilities: defaultWeight,
    education: defaultWeight,
    certifications: defaultWeight,
    job_requirements: defaultWeight,
    extra_curricular: defaultWeight,
  }
}

export function cleanBuckets(buckets: Buckets): Buckets {
  const cleaned = emptyBuckets()
  for (const { key } of bucketDefinitions) {
    cleaned[key] = buckets[key].map((item) => item.trim()).filter((item) => item.length > 0)
  }
  return cleaned
}
