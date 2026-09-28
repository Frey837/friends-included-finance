const baseUrl = process.env.APP_URL
if (!baseUrl) {
  console.error('Set APP_URL to the deployed site URL.')
  process.exit(1)
}
const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/snapshot?role=svetlana`)
const body = await response.json()
if (!response.ok || body.error) throw new Error(body.error || `HTTP ${response.status}`)
const expected = {
  projectA: 205000,
  projectB: 218000,
  company: 393000,
  richard: 14000,
  anastasia: 17500,
  jeanClaude: 21500,
  pendingSales: 60000,
  awaitingExpenses: 14000
}
const actual = {
  projectA: body.homeworkSummary.projects.A.resultCents,
  projectB: body.homeworkSummary.projects.B.resultCents,
  company: body.homeworkSummary.company.resultCents,
  richard: body.homeworkSummary.commissions.richard,
  anastasia: body.homeworkSummary.commissions.anastasia,
  jeanClaude: body.homeworkSummary.commissions['jean-claude'],
  pendingSales: body.homeworkSummary.pendingSalesCents,
  awaitingExpenses: body.homeworkSummary.company.awaitingCents
}
console.table({ expected, actual })
const mismatches = Object.keys(expected).filter((key) => expected[key] !== actual[key])
if (mismatches.length) {
  console.error(`Mismatched control totals: ${mismatches.join(', ')}`)
  process.exit(1)
}
console.log('Test 2 control totals match.')
