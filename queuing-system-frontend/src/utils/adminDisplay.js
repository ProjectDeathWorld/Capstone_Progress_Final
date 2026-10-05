// Presentation only: preserve real values without modifying API data.
export const isMissingValue = value => value == null
  || (typeof value === 'string' && (value.trim() === '' || value.trim().toUpperCase() === 'N/A'))
  || (typeof value === 'number' && !Number.isFinite(value))

export const displayValue = value => isMissingValue(value) ? 0 : value
