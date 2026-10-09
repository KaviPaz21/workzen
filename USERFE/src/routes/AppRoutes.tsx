import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { PageLayout } from '@/layouts/PageLayout'
import { CvPoolPage } from '@/modules/recruiteone/pages/CvPoolPage'
import { DashboardPage } from '@/modules/recruiteone/pages/DashboardPage'
import { InterviewPage } from '@/modules/recruiteone/pages/InterviewPage'
import { InterviewsPage } from '@/modules/recruiteone/pages/InterviewsPage'
import { JdsPage } from '@/modules/recruiteone/pages/JdsPage'
import { VacanciesPage } from '@/modules/recruiteone/pages/VacanciesPage'
import { ApplyPage } from '@/pages/apply/ApplyPage'
import { ComingSoonPage } from '@/pages/ComingSoonPage'
import { DepartmentPage } from '@/pages/department/DepartmentPage'
import { WorkZenHomePage } from '@/pages/home/WorkZenHomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function VacancyRedirect() {
  const { vacancyId = '' } = useParams()
  return <Navigate to={`/hr/recruiteone/vacancies?open=${vacancyId}`} replace />
}

export function AppRoutes() {
  return (
    <Routes>
      
      <Route path="apply/:token" element={<ApplyPage />} />

      <Route element={<AppShell />}>
        <Route element={<PageLayout />}>
          <Route index element={<WorkZenHomePage />} />
          <Route path="hr" element={<DepartmentPage departmentId="hr" />} />
          <Route path="soon/:id" element={<ComingSoonPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="hr/recruiteone">
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route element={<PageLayout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="vacancies/:vacancyId" element={<VacancyRedirect />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route element={<PageLayout fill />}>
            <Route path="jds" element={<JdsPage />} />
            <Route path="vacancies" element={<VacanciesPage />} />
            <Route path="cv-pool" element={<CvPoolPage />} />
            <Route path="interviews" element={<InterviewsPage />} />
            <Route path="interviews/:interviewId" element={<InterviewPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
