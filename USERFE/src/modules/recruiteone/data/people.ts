import type { Person } from '../types'

export const hrDepartment = 'Human Resources'

export const people: Person[] = [
  { id: 'p-001', name: 'Nadeesha Wijesinghe', role: 'HR Manager', department: hrDepartment },
  { id: 'p-002', name: 'Ruwan Perera', role: 'Talent Acquisition Lead', department: hrDepartment },
  { id: 'p-003', name: 'Ishara Fernando', role: 'HR Business Partner', department: hrDepartment },
  { id: 'p-004', name: 'HR Admin', role: 'HR Administrator', department: hrDepartment },
  { id: 'p-005', name: 'Kasun Silva', role: 'Engineering Manager', department: 'Engineering' },
  { id: 'p-006', name: 'Priyanka Das', role: 'Design Lead', department: 'Design' },
  { id: 'p-007', name: 'Tom Becker', role: 'Finance Manager', department: 'Finance' },
  { id: 'p-008', name: 'Amara Joseph', role: 'Head of Analytics', department: 'Analytics' },
  { id: 'p-009', name: 'Dilan Rajapaksa', role: 'Customer Success Director', department: 'Customer Success' },
]

export function isHrPerson(person: Person | undefined) {
  return person?.department === hrDepartment
}

export const defaultInterviewerIds = people.filter((person) => person.department === hrDepartment).map((person) => person.id)

export function personById(id: string) {
  return people.find((person) => person.id === id)
}
