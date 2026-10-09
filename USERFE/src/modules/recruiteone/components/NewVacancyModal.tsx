import { Modal } from '@/components/ui/Modal'
import { useStore } from '../state/RecruiteOneStore'
import type { Vacancy } from '../types'
import { VacancyWizardBody } from './VacancyWizardBody'

interface NewVacancyModalProps {
  onClose: () => void
  onUploadNow: (vacancy: Vacancy) => void
}

export function NewVacancyModal({ onClose, onUploadNow }: NewVacancyModalProps) {
  const { jds, addVacancy } = useStore()
  const activeJds = jds.filter((jd) => !jd.deleted)

  return (
    <Modal open onClose={onClose} title="New vacancy" description="Name the vacancy, pick its job description and choose how to run it." closeOnBackdrop={false}>
      <VacancyWizardBody jds={activeJds} onCreate={addVacancy} onUploadNow={onUploadNow} onDone={onClose} onCancel={onClose} />
    </Modal>
  )
}
