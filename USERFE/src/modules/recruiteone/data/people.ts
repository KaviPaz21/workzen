import type { Person } from '../types'

export const hrDepartment = 'Human Resources'
export const financeDepartment = 'Finance'
export const managementDepartment = 'Management'

export const people: Person[] = [
  { id: 'p-001', name: 'Nadeesha Wijesinghe', role: 'HR Manager', department: hrDepartment },
  { id: 'p-002', name: 'Ruwan Perera', role: 'Talent Acquisition Lead', department: hrDepartment },
  { id: 'p-003', name: 'Ishara Fernando', role: 'HR Business Partner', department: hrDepartment },
  { id: 'p-004', name: 'HR Admin', role: 'HR Administrator', department: hrDepartment },
  { id: 'p-005', name: 'Kasun Silva', role: 'Engineering Manager', department: 'Engineering' },
  { id: 'p-006', name: 'Priyanka Das', role: 'Design Lead', department: 'Design' },
  { id: 'p-007', name: 'Tom Becker', role: 'Finance Manager', department: financeDepartment },
  { id: 'p-008', name: 'Amara Joseph', role: 'Head of Analytics', department: 'Analytics' },
  { id: 'p-009', name: 'Dilan Rajapaksa', role: 'Customer Success Director', department: 'Customer Success' },
  { id: 'p-010', name: 'Chamari Gunasekara', role: 'Finance Controller', department: financeDepartment },
  { id: 'p-011', name: 'Sanjaya Abeywardena', role: 'Chief Executive Officer', department: managementDepartment },
  { id: 'p-012', name: 'Malini Jayasuriya', role: 'Chief Operating Officer', department: managementDepartment },
]

export function isHrPerson(person: Person | undefined) {
  return person?.department === hrDepartment
}

export const defaultInterviewerIds = people.filter((person) => person.department === hrDepartment).map((person) => person.id)

export const departmentNames = Array.from(new Set(people.map((person) => person.department)))

export function personById(id: string) {
  return people.find((person) => person.id === id)
}

export function peopleIn(department: string) {
  return people.filter((person) => person.department === department)
}

export function defaultHeadOf(department: string) {
  const members = peopleIn(department)
  return members.find((person) => /head|manager|lead|director|chief/i.test(person.role)) ?? members[0]
}
