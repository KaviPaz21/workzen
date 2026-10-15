const hourFormatter = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' })

export function greetingFor(date: Date = new Date()) {
  const hour = Number(hourFormatter.format(date))
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  if (hour >= 17 && hour < 21) return 'Good evening'
  return 'Hello'
}

export function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}
