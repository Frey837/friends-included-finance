import crypto from 'node:crypto'

let cachedToken = null

function base64url(value) {
  return Buffer.from(value).toString('base64url')
}

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('Google Sheets is not configured.')
  const parsed = JSON.parse(raw)
  if (!parsed.client_email || !parsed.private_key) throw new Error('Google service account credentials are incomplete.')
  return parsed
}

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value
  const account = credentials()
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: account.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }))
  const unsigned = `${header}.${claims}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), account.private_key).toString('base64url')
  const response = await fetch(account.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`
    })
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`Google authorization failed: ${body.error_description || body.error}`)
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }
  return cachedToken.value
}

function columnName(count) {
  let value = count
  let name = ''
  while (value > 0) {
    value -= 1
    name = String.fromCharCode(65 + (value % 26)) + name
    value = Math.floor(value / 26)
  }
  return name
}

async function sheetsFetch(range, options = {}) {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) throw new Error('Google Sheets is not configured.')
  const token = await accessToken()
  const suffix = options.write ? '?valueInputOption=USER_ENTERED' : ''
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}${suffix}`,
    {
      method: options.write ? 'PUT' : 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: options.write ? JSON.stringify({ range, majorDimension: 'ROWS', values: options.values }) : undefined
    }
  )
  const body = await response.json()
  if (!response.ok) throw new Error(`Google Sheets update failed: ${body.error?.message || response.statusText}`)
  return body
}

async function upsertRow(tab, headers, row) {
  const end = columnName(headers.length)
  const data = await sheetsFetch(`${tab}!A:${end}`)
  const values = data.values || []
  if (!values.length) {
    await sheetsFetch(`${tab}!A1:${end}1`, { write: true, values: [headers] })
  }
  const index = values.findIndex((existing, rowIndex) => rowIndex > 0 && existing[0] === row[0])
  const rowNumber = index >= 0 ? index + 1 : Math.max(values.length + 1, 2)
  await sheetsFetch(`${tab}!A${rowNumber}:${end}${rowNumber}`, { write: true, values: [row] })
}

export async function syncSale(sale) {
  const headers = [
    'Reference', 'Record group', 'Submitted at', 'Salesperson', 'Customer', 'Project', 'Description', 'Amount EUR',
    'Proposed Richard %', 'Proposed Anastasia %', 'Proposed Jean-Claude %',
    'Approved Richard %', 'Approved Anastasia %', 'Approved Jean-Claude %',
    'Richard commission EUR', 'Anastasia commission EUR', 'Jean-Claude commission EUR', 'Status',
    'Submission confirmation', 'Decision notification'
  ]
  const row = [
    sale.reference, sale.record_group === 'instructor_test' ? 'Instructor test' : 'Original homework',
    sale.submitted_at, sale.salesperson_name, sale.customer, sale.project, sale.description,
    sale.amount_cents / 100, `${sale.proposed_richard_pct}%`, `${sale.proposed_anastasia_pct}%`, `${sale.proposed_jean_claude_pct}%`,
    sale.approved_richard_pct == null ? '' : `${sale.approved_richard_pct}%`,
    sale.approved_anastasia_pct == null ? '' : `${sale.approved_anastasia_pct}%`,
    sale.approved_jean_claude_pct == null ? '' : `${sale.approved_jean_claude_pct}%`,
    (sale.richard_commission_cents || 0) / 100, (sale.anastasia_commission_cents || 0) / 100,
    (sale.jean_claude_commission_cents || 0) / 100, sale.status, sale.confirmation_status, sale.notification_status
  ]
  await upsertRow('Sales', headers, row)
}

export async function syncExpense(expense) {
  const headers = [
    'Reference', 'Record group', 'Submitted at', 'Reporter', 'Description', 'Category', 'Amount EUR',
    'Proposed allocation', 'Final allocation', 'Status', 'Submission confirmation', 'Decision notification'
  ]
  const row = [
    expense.reference, expense.record_group === 'instructor_test' ? 'Instructor test' : 'Original homework',
    expense.submitted_at, expense.reporter_name, expense.description, expense.category,
    expense.amount_cents / 100, expense.proposed_allocation, expense.final_allocation || '', expense.status,
    expense.confirmation_status, expense.notification_status
  ]
  await upsertRow('Expenses', headers, row)
}
