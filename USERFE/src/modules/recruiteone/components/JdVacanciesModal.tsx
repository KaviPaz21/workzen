import { BriefcaseBusiness, Plus } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { formatDate } from '@/lib/format'
import { vacancyStage } from '../data/stage'
import { useStore } from '../state/RecruiteOneStore'
import type { JobDescription, Vacancy } from '../types'
import { VacancyStatusBadge } from './StatusBadges'
import { VacancyWizardBody } from './VacancyWizardBody'

type Tab = 'existing' | 'new'

interface JdVacanciesModalProps {
  jd: JobDescription
  onClose: () => void
  onOpenVacancy: (vacancy: Vacancy) => void
  onUploadNow: (vacancy: Vacancy) => void
}

export function JdVacanciesModal({ jd, onClose, onOpenVacancy, onUploadNow }: JdVacanciesModalProps) {
  const { vacancies, addVacancy } = useStore()
  const linked = vacancies.filter((vacancy) => vacancy.jd_id === jd.id)
  const [tab, setTab] = useState<Tab>(linked.length > 0 ? 'existing' : 'new')

  return (
    <Modal open onClose={onClose} title={jd.name} description="Vacancies for this job description" closeOnBackdrop={false}>
      <Tabs
        label="Vacancy sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'existing', label: `Vacancies (${linked.length})` },
          { value: 'new', label: 'New vacancy' },
        ]}
      >
        {tab === 'existing' ? (
          linked.length === 0 ? (
            <EmptyState
              icon={<BriefcaseBusiness />}
              title="No vacancies yet"
              description="This job description has not been used for a vacancy."
              action={
                <Button icon={<Plus />} onClick={() => setTab('new')}>
                  Create vacancy
                </Button>
              }
            />
          ) : (
            <div className="table-wrap table-wrap--plain">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th scope="col">Vacancy</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Status</th>
                    <th scope="col">Closing date</th>
                    <th scope="col">CVs</th>
                  </tr>
                </thead>
                <tbody>
                  {linked.map((vacancy) => {
                    const stage = vacancyStage(vacancy)
                    return (
                      <tr key={vacancy.id} className="row-clickable" onClick={() => onOpenVacancy(vacancy)}>
                        <td>
                          <button type="button" className="link-button" onClick={() => onOpenVacancy(vacancy)}>
                            {vacancy.title}
                          </button>
                        </td>
                        <td>
                          <Badge tone={stage.tone}>{stage.label}</Badge>
                        </td>
                        <td>
                          <VacancyStatusBadge status={vacancy.status} />
                        </td>
                        <td className="cell-secondary">{formatDate(vacancy.closing_date)}</td>
                        <td>{vacancy.candidate_count}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <VacancyWizardBody
            jds={[jd]}
            lockedJd={jd}
            onCreate={addVacancy}
            onUploadNow={onUploadNow}
            onDone={() => setTab('existing')}
            onCancel={onClose}
          />
        )}
      </Tabs>
    </Modal>
  )
}
