import { useStore } from './recruiteone/state/RecruiteOneStore'

export function useToolHighlights(toolId: string): string[] {
  const { vacancies, candidates } = useStore()
  if (toolId !== 'recruiteone') return []
  const open = vacancies.filter((vacancy) => vacancy.status === 'open').length
  return [`${open} open vacancies`, `${candidates.length} CVs in pool`]
}
