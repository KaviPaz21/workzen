const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function formatDate(value: string | null) {
  if (!value) return '—'
  return dateFormatter.format(new Date(value))
}

export function formatDateRange(dates: (string | null)[]) {
  const sorted = dates.filter((date): date is string => date !== null).sort()
  if (sorted.length === 0) return 'Not scheduled'
  if (sorted.length === 1 || sorted[0] === sorted[sorted.length - 1]) return formatDate(sorted[0])
  return `${formatDate(sorted[0])} – ${formatDate(sorted[sorted.length - 1])}`
}

function dayNumber(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number)
  return Math.round(Date.UTC(year, month - 1, day) / 86400000)
}

export function daysFromToday(isoDate: string) {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return dayNumber(isoDate) - dayNumber(today)
}

export function relativeDay(isoDate: string) {
  const days = daysFromToday(isoDate)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  return days > 0 ? `in ${days} days` : `${-days} days ago`
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function formatDateTime(value: string | null) {
  if (!value) return '—'
  return dateTimeFormatter.format(new Date(value))
}

export function titleCase(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
