import { Compass } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { usePageTitle } from '@/lib/usePageTitle'

export function NotFoundPage() {
  usePageTitle('Page not found')

  return (
    <div className="centered-page">
      <EmptyState
        icon={<Compass />}
        title="We could not find that page"
        description="The link may be broken or the page may have moved."
        action={<ButtonLink to="/">Back to Home</ButtonLink>}
      />
    </div>
  )
}
