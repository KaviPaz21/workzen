import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { hrDepartment, people } from '@/modules/recruiteone/data/people'
import { useCurrentUser } from '@/modules/recruiteone/state/CurrentUser'

export function UserMenu() {
  const { user, isHr, switchUser } = useCurrentUser()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const groups = [
    { label: 'HR team (see everything)', members: people.filter((person) => person.department === hrDepartment) },
    { label: 'Other departments (interviewers and approvers)', members: people.filter((person) => person.department !== hrDepartment) },
  ]

  return (
    <div className="user-menu" ref={rootRef}>
      <button type="button" className="user-chip" aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${user.name}`} onClick={() => setOpen((value) => !value)}>
        <Avatar name={user.name} small />
        <span className="user-chip__text">
          <span className="user-chip__name">{user.name}</span>
          <span className="user-chip__role">{isHr ? 'HR' : user.role}</span>
        </span>
        <ChevronDown aria-hidden="true" width={16} height={16} />
      </button>

      {open && (
        <div className="user-menu__panel" role="menu" aria-label="Switch user">
          <p className="user-menu__note">Demo sign-in. Pick who you are viewing the app as. Real sign-in comes later.</p>
          {groups.map((group) => (
            <div key={group.label} className="user-menu__group">
              <p className="mini-heading">{group.label}</p>
              {group.members.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={person.id === user.id}
                  className="user-menu__item"
                  onClick={() => {
                    switchUser(person.id)
                    setOpen(false)
                  }}
                >
                  <Avatar name={person.name} small />
                  <span className="user-menu__who">
                    <span className="cell-primary">{person.name}</span>
                    <span className="cell-secondary">{person.role}</span>
                  </span>
                  {person.id === user.id && <Check aria-hidden="true" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
