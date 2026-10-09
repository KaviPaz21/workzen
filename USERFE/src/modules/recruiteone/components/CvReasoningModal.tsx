import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useStore } from '../state/RecruiteOneStore'
import type { Candidate } from '../types'
import { CvDetailView } from './CvDetailView'

interface CvReasoningModalProps {
  candidateId: string
  onClose: () => void
  onViewCv: (candidate: Candidate) => void
}

export function CvReasoningModal({ candidateId, onClose, onViewCv }: CvReasoningModalProps) {
  const { candidates, scoreCandidates } = useStore()
  const candidate = candidates.find((item) => item.id === candidateId)
  if (!candidate) return null

  return (
    <Modal open onClose={onClose} title="AI reasoning" description={`${candidate.full_name} · score per benchmark`} closeOnBackdrop={false} footer={<Button onClick={onClose}>Close</Button>}>
      <CvDetailView candidate={candidate} onViewCv={onViewCv} onRetry={(item) => scoreCandidates([item.id])} />
    </Modal>
  )
}
