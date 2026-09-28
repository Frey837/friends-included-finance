import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateCommission, euroToCents, summarize, validateSplit } from '../lib/domain.js'

function sale(reference, amountCents, project, split, status = 'approved') {
  const calculated = status === 'approved' ? calculateCommission(amountCents, split) : { poolCents: 0, commissions: { richard: 0, anastasia: 0, 'jean-claude': 0 } }
  return {
    reference, amount_cents: amountCents, project, status,
    commission_pool_cents: calculated.poolCents,
    richard_commission_cents: calculated.commissions.richard,
    anastasia_commission_cents: calculated.commissions.anastasia,
    jean_claude_commission_cents: calculated.commissions['jean-claude']
  }
}

function expense(reference, amountCents, finalAllocation, status = 'allocated') {
  return { reference, amount_cents: amountCents, final_allocation: finalAllocation, status }
}

test('money accepts cents and rejects zero', () => {
  assert.equal(euroToCents('1000'), 100000)
  assert.equal(euroToCents('12.34'), 1234)
  assert.throws(() => euroToCents('0'), /greater than zero/)
  assert.throws(() => euroToCents('1.234'), /positive euro value/)
})

test('commission split must total 100', () => {
  assert.deepEqual(validateSplit({ richard: 50, anastasia: 30, 'jean-claude': 20 }), { richard: 50, anastasia: 30, 'jean-claude': 20 })
  assert.throws(() => validateSplit({ richard: 60, anastasia: 30, 'jean-claude': 20 }), /total 100/)
})

test('rounding difference goes to the largest percentage with stated tie priority', () => {
  assert.deepEqual(calculateCommission(101, { richard: 34, anastasia: 33, 'jean-claude': 33 }), {
    poolCents: 10,
    commissions: { richard: 4, anastasia: 3, 'jean-claude': 3 }
  })
  assert.deepEqual(calculateCommission(101, { richard: 25, anastasia: 50, 'jean-claude': 25 }).commissions, {
    richard: 2, anastasia: 6, 'jean-claude': 2
  })
})

test('Test 1 produces the required results', () => {
  const sales = [
    sale('S01', 100000, 'A', { richard: 50, anastasia: 30, 'jean-claude': 20 }),
    sale('S02', 200000, 'B', { richard: 20, anastasia: 40, 'jean-claude': 40 })
  ]
  const expenses = [
    expense('E01', 12000, 'A'), expense('E02', 8000, 'A'), expense('E03', 10000, 'Company overhead')
  ]
  const totals = summarize(sales, expenses)
  assert.equal(totals.projects.A.resultCents, 70000)
  assert.equal(totals.projects.B.resultCents, 180000)
  assert.equal(totals.company.resultCents, 240000)
  assert.deepEqual(totals.commissions, { richard: 9000, anastasia: 11000, 'jean-claude': 10000 })
})

test('Test 2 cumulative results match the homework control totals', () => {
  const sales = [
    sale('S01', 100000, 'A', { richard: 50, anastasia: 30, 'jean-claude': 20 }),
    sale('S02', 200000, 'B', { richard: 20, anastasia: 40, 'jean-claude': 40 }),
    sale('S03', 150000, 'A', { richard: 20, anastasia: 30, 'jean-claude': 50 }),
    sale('S04', 80000, 'B', { richard: 25, anastasia: 25, 'jean-claude': 50 }),
    sale('S05', 60000, 'B', { richard: 100, anastasia: 0, 'jean-claude': 0 }, 'pending')
  ]
  const expenses = [
    expense('E01', 12000, 'A'), expense('E02', 8000, 'A'), expense('E03', 10000, 'Company overhead'),
    expense('E04', 25000, 'B'), expense('E05', 9000, 'B'), expense('E06', 6000, 'Company overhead'),
    expense('E07', 14000, null, 'awaiting_allocation')
  ]
  const totals = summarize(sales, expenses)
  assert.equal(totals.projects.A.incomeCents, 250000)
  assert.equal(totals.projects.A.resultCents, 205000)
  assert.equal(totals.projects.B.incomeCents, 280000)
  assert.equal(totals.projects.B.resultCents, 218000)
  assert.equal(totals.company.overheadCents, 16000)
  assert.equal(totals.company.awaitingCents, 14000)
  assert.equal(totals.company.resultCents, 393000)
  assert.equal(totals.pendingSalesCents, 60000)
  assert.deepEqual(totals.commissions, { richard: 14000, anastasia: 17500, 'jean-claude': 21500 })
})

test('instructor transactions can change live totals without changing the homework baseline', () => {
  const homeworkSale = { ...sale('S01', 100000, 'A', { richard: 50, anastasia: 30, 'jean-claude': 20 }), record_group: 'homework' }
  const instructorSale = { ...sale('S90001', 10000, 'B', { richard: 20, anastasia: 30, 'jean-claude': 50 }), record_group: 'instructor_test' }
  const all = summarize([homeworkSale, instructorSale], [])
  const homework = summarize([homeworkSale, instructorSale].filter((item) => item.record_group === 'homework'), [])
  assert.equal(all.company.resultCents, 99000)
  assert.equal(homework.company.resultCents, 90000)
  assert.equal(homework.commissions['jean-claude'], 2000)
})
