import {
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  FolderOpen,
  Headset,
  Landmark,
  Sparkles,
  TrendingUp,
  UserRoundCheck,
  UserRoundSearch,
  UsersRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { recruiteOneNav, type NavItem } from './recruiteone/navigation'

export type EntryStatus = 'live' | 'planned'

export interface ToolEntry {
  id: string
  name: string
  description: string
  basePath: string
  path: string
  status: EntryStatus
  icon: LucideIcon
  nav: NavItem[]
}

export interface Department {
  id: string
  name: string
  description: string
  path: string
  status: EntryStatus
  icon: LucideIcon
  tools: ToolEntry[]
}

export interface GeneralTool {
  id: string
  name: string
  description: string
  path: string
  status: EntryStatus
  icon: LucideIcon
}

export function soonPath(id: string) {
  return `/soon/${id}`
}

function plannedTool(id: string, name: string, description: string, icon: LucideIcon): ToolEntry {
  return { id, name, description, basePath: soonPath(id), path: soonPath(id), status: 'planned', icon, nav: [] }
}

function plannedDepartment(id: string, name: string, description: string, icon: LucideIcon): Department {
  return { id, name, description, path: soonPath(id), status: 'planned', icon, tools: [] }
}

export const departments: Department[] = [
  {
    id: 'hr',
    name: 'Human Resources',
    description: 'Hire, onboard and support people with AI doing the repetitive work.',
    path: '/hr',
    status: 'live',
    icon: UsersRound,
    tools: [
      {
        id: 'recruiteone',
        name: 'RecruiteOne',
        description: 'Applicant tracking with AI-powered CV evaluation.',
        basePath: '/hr/recruiteone',
        path: '/hr/recruiteone/dashboard',
        status: 'live',
        icon: UserRoundSearch,
        nav: recruiteOneNav,
      },
      plannedTool('onboarding', 'Onboarding', 'Guide new joiners through their first weeks.', UserRoundCheck),
      plannedTool('leave', 'Leave', 'Leave requests, approvals and balances in one place.', CalendarDays),
    ],
  },
  plannedDepartment('finance', 'Finance', 'Invoices, approvals and reporting.', Landmark),
  plannedDepartment('it', 'IT & Support', 'Tickets, access and assets.', Headset),
  plannedDepartment('operations', 'Operations', 'Workflows and vendor tasks.', Workflow),
  plannedDepartment('sales', 'Sales', 'Pipeline and proposals.', TrendingUp),
]

export const generalTools: GeneralTool[] = [
  {
    id: 'assistant',
    name: 'AI Assistant',
    description: 'Ask WorkZen questions and get answers from across your departments.',
    path: soonPath('assistant'),
    status: 'planned',
    icon: Sparkles,
  },
  {
    id: 'documents',
    name: 'Documents',
    description: 'One shared library for files used by every department.',
    path: soonPath('documents'),
    status: 'planned',
    icon: FolderOpen,
  },
  {
    id: 'approvals',
    name: 'Approvals',
    description: 'Requests waiting for your decision, from any tool.',
    path: soonPath('approvals'),
    status: 'planned',
    icon: ClipboardCheck,
  },
  {
    id: 'reports',
    name: 'Reports',
    description: 'Cross-department numbers and exportable summaries.',
    path: soonPath('reports'),
    status: 'planned',
    icon: ChartColumn,
  },
]

export interface PlannedEntry {
  kind: 'department' | 'tool' | 'general'
  name: string
  description: string
  icon: LucideIcon
  parent?: Department
}

export function findPlannedEntry(id: string): PlannedEntry | undefined {
  for (const department of departments) {
    if (department.id === id && department.status === 'planned') {
      return { kind: 'department', name: department.name, description: department.description, icon: department.icon }
    }
    const tool = department.tools.find((item) => item.id === id && item.status === 'planned')
    if (tool) {
      return { kind: 'tool', name: tool.name, description: tool.description, icon: tool.icon, parent: department }
    }
  }
  const general = generalTools.find((item) => item.id === id)
  if (general) {
    return { kind: 'general', name: general.name, description: general.description, icon: general.icon }
  }
  return undefined
}

export function findTool(id: string) {
  for (const department of departments) {
    const tool = department.tools.find((item) => item.id === id)
    if (tool) return { tool, department }
  }
  return undefined
}

export function isUnder(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`)
}
