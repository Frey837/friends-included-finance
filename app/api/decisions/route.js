import { fail, ok } from '@/lib/http.js'
import { allocateExpense, approveSale } from '@/lib/transactions.js'

export async function POST(request) {
  try {
    const body = await request.json()
    const record = body.kind === 'sale'
      ? await approveSale(body.actorSlug, body)
      : body.kind === 'expense'
        ? await allocateExpense(body.actorSlug, body)
        : null
    if (!record) return ok({ error: 'Decision kind must be sale or expense.' }, 400)
    return ok({ record })
  } catch (error) {
    return fail(error)
  }
}
