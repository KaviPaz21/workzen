import { Search } from 'lucide-react'

interface SearchFieldProps {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

export function SearchField({ label, placeholder, value, onChange }: SearchFieldProps) {
  return (
    <label className="search-field">
      <span className="sr-only">{label}</span>
      <Search aria-hidden="true" />
      <input type="search" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
