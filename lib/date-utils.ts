export function formatDateForAPI(date: Date): string {
  return date.toISOString().split("T")[0]
}

export function formatDateForDisplay(date: Date): string {
  return date.toISOString().split("T")[0]
}

export function getQuickRangeDate(months: number): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - months)

  return { start, end }
}

export function formatDateForFilename(date: Date): string {
  return date.toISOString().split("T")[0]
}
