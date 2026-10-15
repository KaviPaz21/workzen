export type Level = 'entry' | 'junior' | 'mid' | 'senior' | 'executive'
export type VacancyStatus = 'draft' | 'open' | 'on_hold' | 'closed'
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship'
export type CandidateStatus = 'new' | 'shortlisted' | 'rejected'
export type Recommendation = 'strong_match' | 'potential_match' | 'not_a_match'

export type BucketKey =
  | 'technical_skills'
  | 'soft_skills'
  | 'experience'
  | 'responsibilities'
  | 'education'
  | 'certifications'
  | 'job_requirements'
  | 'extra_curricular'

export type Buckets = Record<BucketKey, string[]>
export type Weights = Record<BucketKey, number>

export interface JobDescription {
  id: string
  name: string
  role: string
  sector: string
  level: Level
  raw_text: string
  buckets: Buckets
  weights: Weights
  approval_id?: string | null
  deleted: boolean
  created_at: string
  updated_at: string
}

export interface JdDecomposition {
  role: string
  sector: string
  level: Level
  buckets: Buckets
}

export interface Person {
  id: string
  name: string
  role: string
  department: string
}

export interface PipelineStage {
  id: string
  name: string
  max_candidates: number
  interviewer_ids: string[]
  scheduled_date: string | null
}

export interface Pipeline {
  name: string
  description: string
  stages: PipelineStage[]
}

export interface Vacancy {
  id: string
  title: string
  jd_id: string
  approval_id?: string | null
  department: string
  location: string
  employment_type: EmploymentType
  openings: number
  candidate_count: number
  evaluated_count: number
  shortlisted_count: number
  closing_date: string | null
  status: VacancyStatus
  share_token: string | null
  pipeline: Pipeline | null
  collection_closed_at: string | null
  created_at: string
}

export interface Batch {
  id: string
  vacancy_id: string
  name: string
  created_at: string
}

export interface BenchmarkScore {
  key: BucketKey
  label: string
  score: number
  weight: number
  applicable: boolean
  reasoning: string
}

export interface CvScore {
  overall_score: number
  recommendation: Recommendation
  summary: string
  benchmarks: BenchmarkScore[]
}

export type ScoreStatus = 'pending' | 'scoring' | 'scored' | 'failed'

export interface Candidate {
  id: string
  full_name: string
  email: string
  current_title: string
  skills: string[]
  file_name: string
  status: CandidateStatus
  created_at: string
  vacancy_ids: string[]
  source: 'upload' | 'application'
  batch_id: string | null
  selected: boolean
  has_file: boolean
  score_status: ScoreStatus
  score_error?: string
  score: CvScore | null
  phone?: string
  application?: Record<string, string>
}

export type InterviewOutcome = 'active' | 'rejected' | 'selected'

export interface CandidateProgress {
  stage_index: number
  outcome: InterviewOutcome
}

export interface Interview {
  id: string
  vacancy_id: string
  created_at: string
  candidate_ids: string[]
  progress: Record<string, CandidateProgress>
}

export interface Criterion {
  id: string
  name: string
  max_score: number
}

export interface Scorecard {
  id: string
  interview_id: string
  stage_id: string
  interviewer_id: string | null
  created_by: string
  criteria: Criterion[]
}

export interface InterviewScore {
  id: string
  interview_id: string
  stage_id: string
  interviewer_id: string
  scorecard_id: string
  candidate_id: string
  values: Record<string, number>
  notes: string
  updated_at: string
}

export type ApprovalStepKey = 'department_head' | 'finance' | 'hr' | 'management'
export type StepDecision = 'pending' | 'approved' | 'rejected'
export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export interface ApprovalStep {
  key: ApprovalStepKey
  department: string
  approver_id: string | null
  decision: StepDecision
  decided_by: string | null
  decided_at: string | null
  comment: string
}

export interface HiringApproval {
  id: string
  position_name: string
  recruiter_name: string
  level: Level
  department: string
  jd_details: string
  reason: string
  position_value: string
  steps: ApprovalStep[]
  status: ApprovalStatus
  created_by: string
  submitted_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface QualityScores {
  relevance: number
  coherence: number
  groundedness: number
}

export interface EvaluationResult {
  id: string
  candidate_id: string
  candidate_name: string
  vacancy_id: string
  vacancy_title: string
  overall_score: number
  skills_score: number
  experience_score: number
  education_score: number
  recommendation: Recommendation
  strengths: string[]
  gaps: string[]
  summary: string
  quality: QualityScores
  created_at: string
}

export interface DashboardSummary {
  open_vacancies: number
  active_jds: number
  candidates_in_pool: number
  evaluations_completed: number
  average_match_score: number
  quality_averages: QualityScores
  recommendation_breakdown: Record<Recommendation, number>
}

export interface ActivityItem {
  id: string
  message: string
  detail: string
  created_at: string
}
