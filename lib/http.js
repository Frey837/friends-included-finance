import { DomainError } from './domain.js'

export function ok(data, status = 200) {
  return Response.json(data, { status })
}

export function fail(error) {
  console.error(error)
  if (error instanceof DomainError) return ok({ error: error.message }, error.status)
  const message = String(error?.message || error)
  const safe = message.includes('duplicate key')
    ? 'This reference already exists.'
    : message.includes('not configured')
      ? message
      : message.includes('permission') || message.includes('Only') || message.includes('must')
        ? message
        : 'The request could not be completed.'
  return ok({ error: safe }, message.includes('not configured') ? 503 : 400)
}

export function requireText(value, label, max = 240) {
  const text = String(value ?? '').trim()
  if (!text) throw new DomainError(`${label} is required.`)
  if (text.length > max) throw new DomainError(`${label} is too long.`)
  return text
}
