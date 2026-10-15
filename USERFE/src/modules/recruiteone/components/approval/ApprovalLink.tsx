import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { approvalReference } from '../../services/approvalMath'
import { useStore } from '../../state/RecruiteOneStore'
import { ApprovalDetailModal } from './ApprovalDetailModal'

interface ApprovalLinkProps {
  approvalId: string | null | undefined
  size?: 'md' | 'sm'
}

export function ApprovalLink({ approvalId, size = 'md' }: ApprovalLinkProps) {
  const { approvals } = useStore()
  const [open, setOpen] = useState(false)
  const approval = approvals.find((item) => item.id === approvalId)

  if (!approval) {
    return (
      <Button variant="secondary" size={size} icon={<ShieldCheck />} disabled>
        No approval linked
      </Button>
    )
  }

  return (
    <>
      <Button variant="secondary" size={size} icon={<ShieldCheck />} onClick={() => setOpen(true)}>
        Approval {approvalReference(approval)}
      </Button>
      {open && <ApprovalDetailModal approvalId={approval.id} onClose={() => setOpen(false)} />}
    </>
  )
}
