import { EMPLOYEES, summarize } from '@/lib/domain.js'
import { fail, ok } from '@/lib/http.js'
import { getSupabaseAdmin } from '@/lib/supabase-admin.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const actorSlug = new URL(request.url).searchParams.get('role')
    const actor = EMPLOYEES.find((employee) => employee.slug === actorSlug)
    if (!actor) return ok({ error: 'Choose a demonstration role.' }, 400)

    const db = getSupabaseAdmin()
    const [salesResult, expensesResult, employeesResult] = await Promise.all([
      db.from('sales').select('*').order('submitted_at', { ascending: false }),
      db.from('expenses').select('*').order('submitted_at', { ascending: false }),
      db.from('employees').select('slug,display_name,role,telegram_user_id,telegram_chat_id').order('display_name')
    ])
    if (salesResult.error) throw salesResult.error
    if (expensesResult.error) throw expensesResult.error
    if (employeesResult.error) throw employeesResult.error

    const allSales = salesResult.data || []
    const allExpenses = expensesResult.data || []
    const manager = actor.role === 'manager'
    const sales = manager ? allSales : allSales.filter((sale) => sale.salesperson_slug === actor.slug)
    const expenses = manager ? allExpenses : allExpenses.filter((expense) => expense.reporter_slug === actor.slug)
    return ok({
      actor,
      sales,
      expenses,
      employees: manager ? employeesResult.data : [],
      summary: manager ? summarize(allSales, allExpenses) : null,
      homeworkSummary: manager ? summarize(
        allSales.filter((sale) => sale.record_group !== 'instructor_test'),
        allExpenses.filter((expense) => expense.record_group !== 'instructor_test')
      ) : null
    })
  } catch (error) {
    return fail(error)
  }
}
