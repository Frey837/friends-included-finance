import { fail, ok } from '@/lib/http.js'
import { retryConfirmation, retryNotification, retrySync } from '@/lib/transactions.js'

export async function POST(request) {
  try {
    const body = await request.json()
    const record = body.operation === 'sync'
      ? await retrySync(body.kind, body.reference)
      : body.operation === 'notification'
        ? await retryNotification(body.kind, body.reference)
        : body.operation === 'confirmation'
          ? await retryConfirmation(body.kind, body.reference)
          : null
    if (!record) return ok({ error: 'Choose sync, confirmation, or notification retry.' }, 400)
    return ok({ record })
  } catch (error) {
    return fail(error)
  }
}
