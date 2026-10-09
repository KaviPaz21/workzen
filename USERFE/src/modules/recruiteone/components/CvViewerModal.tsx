import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useCvFile } from '@/lib/useCvFile'
import type { Candidate } from '../types'
import { CvPreview } from './CvPreview'

export function CvViewerModal({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const view = useCvFile(candidate)
  const downloadUrl = view.kind === 'pdf' || view.kind === 'text' || view.kind === 'other' ? view.url : null

  return (
    <Modal
      open
      onClose={onClose}
      title={candidate.full_name}
      description={candidate.file_name}
      closeOnBackdrop={false}
      footer={
        <>
          {downloadUrl && (
            <a className="btn btn--secondary btn--md" href={downloadUrl} download={candidate.file_name}>
              <Download aria-hidden="true" />
              Download
            </a>
          )}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <CvPreview candidate={candidate} />
    </Modal>
  )
}
