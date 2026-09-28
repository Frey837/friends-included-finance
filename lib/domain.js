export const EMPLOYEES = [
  { slug: 'svetlana', name: 'Svetlana de Monte Carlo', role: 'manager' },
  { slug: 'richard', name: 'Richard Darling', role: 'salesperson' },
  { slug: 'anastasia', name: 'Anastasia Ferrari', role: 'salesperson' },
  { slug: 'jean-claude', name: 'Jean-Claude Bērziņš', role: 'salesperson' },
  { slug: 'kevin', name: 'Kevin von Whatever', role: 'expense_reporter' }
]

export const SALESPEOPLE = ['richard', 'anastasia', 'jean-claude']
export const PROJECTS = ['A', 'B']
export const ALLOCATIONS = ['A', 'B', 'Company overhead']
export const EXPENSE_CATEGORIES = ['Materials', 'Travel', 'Other']

export class DomainError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'DomainError'
    this.status = status
  }
}

export function euroToCents(value) {
  const text = String(value ?? '').trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new DomainError('Amount must be a positive euro value with no more than two decimals.')
  }
  const cents = Math.round(Number(text) * 100)
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new DomainError('Amount must be greater than zero.')
  }
  return cents
}

export function validateReference(value, kind) {
  const ref = String(value ?? '').trim().toUpperCase()
  const prefix = kind === 'sale' ? 'S' : 'E'
  if (!new RegExp(`^${prefix}[0-9]{2,}$`).test(ref)) {
    throw new DomainError(`${kind === 'sale' ? 'Sale' : 'Expense'} reference must look like ${prefix}01.`)
  }
  return ref
}

export function validateSplit(split) {
  const values = SALESPEOPLE.map((name) => Number(split?.[name]))
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 100)) {
    throw new DomainError('Each commission share must be a whole percentage from 0 to 100.')
  }
  if (values.reduce((sum, value) => sum + value, 0) !== 100) {
    throw new DomainError('Commission shares must total 100%.')
  }
  return Object.fromEntries(SALESPEOPLE.map((name, index) => [name, values[index]]))
}

export function calculateCommission(amountCents, split) {
  const checked = validateSplit(split)
  const pool = Math.round(amountCents * 0.1)
  const raw = Object.fromEntries(
    SALESPEOPLE.map((name) => [name, Math.floor((pool * checked[name]) / 100)])
  )
  const remainder = pool - SALESPEOPLE.reduce((sum, name) => sum + raw[name], 0)
  const priority = [...SALESPEOPLE].sort((left, right) => {
    const difference = checked[right] - checked[left]
    return difference || SALESPEOPLE.indexOf(left) - SALESPEOPLE.indexOf(right)
  })
  raw[priority[0]] += remainder
  return { poolCents: pool, commissions: raw }
}

export function summarize(sales = [], expenses = []) {
  const approvedSales = sales.filter((sale) => sale.status === 'approved')
  const allocatedExpenses = expenses.filter((expense) => expense.status === 'allocated')
  const result = {
    projects: {
      A: { incomeCents: 0, commissionCents: 0, expensesCents: 0, resultCents: 0 },
      B: { incomeCents: 0, commissionCents: 0, expensesCents: 0, resultCents: 0 }
    },
    company: {
      incomeCents: 0,
      commissionCents: 0,
      expensesCents: expenses.reduce((sum, expense) => sum + expense.amount_cents, 0),
      overheadCents: 0,
      awaitingCents: 0,
      resultCents: 0
    },
    commissions: { richard: 0, anastasia: 0, 'jean-claude': 0 },
    pendingSalesCents: sales
      .filter((sale) => sale.status === 'pending')
      .reduce((sum, sale) => sum + sale.amount_cents, 0)
  }

  for (const sale of approvedSales) {
    const project = result.projects[sale.project]
    project.incomeCents += sale.amount_cents
    project.commissionCents += sale.commission_pool_cents
    result.company.incomeCents += sale.amount_cents
    result.company.commissionCents += sale.commission_pool_cents
    result.commissions.richard += sale.richard_commission_cents
    result.commissions.anastasia += sale.anastasia_commission_cents
    result.commissions['jean-claude'] += sale.jean_claude_commission_cents
  }

  for (const expense of allocatedExpenses) {
    if (expense.final_allocation === 'Company overhead') {
      result.company.overheadCents += expense.amount_cents
    } else {
      result.projects[expense.final_allocation].expensesCents += expense.amount_cents
    }
  }
  result.company.awaitingCents = expenses
    .filter((expense) => expense.status === 'awaiting_allocation')
    .reduce((sum, expense) => sum + expense.amount_cents, 0)

  for (const project of PROJECTS) {
    const row = result.projects[project]
    row.resultCents = row.incomeCents - row.commissionCents - row.expensesCents
  }
  result.company.resultCents =
    result.company.incomeCents - result.company.commissionCents - result.company.expensesCents
  return result
}

export function formatEuro(cents) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}
