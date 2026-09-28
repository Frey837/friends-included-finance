import { fail, ok } from '@/lib/http.js'
import { submitExpense, submitSale } from '@/lib/transactions.js'

export async function POST(request) {
  try {
    const body = await request.json()
    const record = body.kind === 'sale'
      ? await submitSale(body.actorSlug, body)
      : body.kind === 'expense'
        ? await submitExpense(body.actorSlug, body)
        : null
    if (!record) return ok({ error: 'Transaction kind must be sale or expense.' }, 400)
    return ok({ record }, 201)
  } catch (error) {
    return fail(error)
  }
}
