import { BriefcaseBusiness, CalendarCheck, FileText, LayoutDashboard, UsersRound, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  description: string
  icon: LucideIcon
}

export const recruiteOneNav: NavItem[] = [
  { to: '/hr/recruiteone/dashboard', label: 'Dashboard', description: 'Hiring metrics and activity', icon: LayoutDashboard },
  { to: '/hr/recruiteone/jds', label: 'JDs', description: 'Job descriptions', icon: FileText },
  { to: '/hr/recruiteone/vacancies', label: 'Vacancies', description: 'Open and planned roles', icon: BriefcaseBusiness },
  { to: '/hr/recruiteone/cv-pool', label: 'CV Pool', description: 'CVs by vacancy and batch', icon: UsersRound },
  { to: '/hr/recruiteone/interviews', label: 'Interviews', description: 'Interview stages and scorecards', icon: CalendarCheck },
]
