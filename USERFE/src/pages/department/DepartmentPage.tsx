import { ToolCard } from '@/components/ui/ToolCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { usePageTitle } from '@/lib/usePageTitle'
import { departments } from '@/modules/registry'
import { NotFoundPage } from '@/pages/NotFoundPage'

export function DepartmentPage({ departmentId }: { departmentId: string }) {
  const department = departments.find((item) => item.id === departmentId)
  usePageTitle(department?.name ?? 'Department')

  if (!department) return <NotFoundPage />

  return (
    <>
      <PageHeader title={department.name} description={department.description} />
      <section aria-labelledby="department-tools">
        <h2 id="department-tools" className="section__title">
          Tools
        </h2>
        <div className="tool-grid">
          {department.tools.map((tool, index) => (
            <ToolCard key={tool.id} tool={tool} index={index} />
          ))}
        </div>
      </section>
    </>
  )
}
