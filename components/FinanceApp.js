'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { EMPLOYEES, formatEuro } from '@/lib/domain.js'

async function api(path, options) {
  const response = await fetch(path, options)
  const body = await response.json()
  if (!response.ok || body.error) throw new Error(body.error || 'Request failed.')
  return body
}

function Status({ value }) {
  return <span className={`status status-${String(value).replaceAll('_', '-')}`}>{String(value).replaceAll('_', ' ')}</span>
}

function Metric({ label, value, tone = '' }) {
  return <div className={`metric ${tone}`}><span>{label}</span><strong>{formatEuro(value || 0)}</strong></div>
}

function SplitFields({ split, setSplit }) {
  return (
    <div className="split-grid">
      {[
        ['richard', 'Richard %'], ['anastasia', 'Anastasia %'], ['jean-claude', 'Jean-Claude %']
      ].map(([key, label]) => (
        <label key={key}>{label}<input type="number" min="0" max="100" required value={split[key]}
          onChange={(event) => setSplit({ ...split, [key]: event.target.value })} /></label>
      ))}
    </div>
  )
}

function SaleForm({ actorSlug, onDone }) {
  const [split, setSplit] = useState({ richard: 50, anastasia: 30, 'jean-claude': 20 })
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true)
    const data = Object.fromEntries(new FormData(event.currentTarget))
    try {
      await api('/api/transactions', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...data, actorSlug, kind: 'sale', split }) })
      event.currentTarget.reset(); onDone('Sale saved. Google Sheets synchronization was attempted.')
    } catch (error) { onDone(error.message, true) } finally { setBusy(false) }
  }
  return (
    <form className="panel form" onSubmit={submit}>
      <div className="section-heading"><div><p className="eyebrow">New transaction</p><h2>Submit a sale</h2></div><span>Pending approval</span></div>
      <div className="field-grid">
        <label>Reference<input name="reference" placeholder="S01" required /></label>
        <label>Record group<select name="recordGroup"><option value="homework">Original homework</option><option value="instructor_test">Instructor test</option></select></label>
        <label>Customer<input name="customer" placeholder="Olivia Rose" required /></label>
        <label>Project<select name="project"><option>A</option><option>B</option></select></label>
        <label>Amount EUR<input name="amount" type="number" min="0.01" step="0.01" placeholder="1000.00" required /></label>
      </div>
      <label>Description<textarea name="description" rows="3" required /></label>
      <fieldset><legend>Proposed share of the 10% commission pool</legend><SplitFields split={split} setSplit={setSplit} /></fieldset>
      <button disabled={busy}>{busy ? 'Saving…' : 'Save sale'}</button>
    </form>
  )
}

function ExpenseForm({ actorSlug, onDone }) {
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true)
    const data = Object.fromEntries(new FormData(event.currentTarget))
    try {
      await api('/api/transactions', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...data, actorSlug, kind: 'expense' }) })
      event.currentTarget.reset(); onDone('Expense saved. Company result now includes it.')
    } catch (error) { onDone(error.message, true) } finally { setBusy(false) }
  }
  return (
    <form className="panel form" onSubmit={submit}>
      <div className="section-heading"><div><p className="eyebrow">New transaction</p><h2>Submit an expense</h2></div><span>Paid expense</span></div>
      <div className="field-grid">
        <label>Reference<input name="reference" placeholder="E01" required /></label>
        <label>Record group<select name="recordGroup"><option value="homework">Original homework</option><option value="instructor_test">Instructor test</option></select></label>
        <label>Category<select name="category"><option>Materials</option><option>Travel</option><option>Other</option></select></label>
        <label>Amount EUR<input name="amount" type="number" min="0.01" step="0.01" required /></label>
        <label>Proposed allocation<select name="proposedAllocation"><option>A</option><option>B</option><option>Company overhead</option></select></label>
      </div>
      <label>Description<textarea name="description" rows="3" required /></label>
      <button disabled={busy}>{busy ? 'Saving…' : 'Save expense'}</button>
    </form>
  )
}

function SaleDecision({ sale, actorSlug, onDone }) {
  const [split, setSplit] = useState({
    richard: sale.proposed_richard_pct,
    anastasia: sale.proposed_anastasia_pct,
    'jean-claude': sale.proposed_jean_claude_pct
  })
  const [busy, setBusy] = useState(false)
  async function approve() {
    setBusy(true)
    try {
      await api('/api/decisions', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'sale', actorSlug, reference: sale.reference, split }) })
      onDone(`${sale.reference} approved and notification attempted.`)
    } catch (error) { onDone(error.message, true) } finally { setBusy(false) }
  }
  return (
    <article className="decision-card">
      <div className="decision-title"><div><strong>{sale.reference}</strong><span>{sale.customer} · Project {sale.project}</span></div><strong>{formatEuro(sale.amount_cents)}</strong></div>
      <p>{sale.description}</p>
      <SplitFields split={split} setSplit={setSplit} />
      <button onClick={approve} disabled={busy}>{busy ? 'Approving…' : 'Approve sale'}</button>
    </article>
  )
}

function ExpenseDecision({ expense, actorSlug, onDone }) {
  const [allocation, setAllocation] = useState(expense.proposed_allocation)
  const [busy, setBusy] = useState(false)
  async function approve() {
    setBusy(true)
    try {
      await api('/api/decisions', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'expense', actorSlug, reference: expense.reference, finalAllocation: allocation }) })
      onDone(`${expense.reference} allocated and notification attempted.`)
    } catch (error) { onDone(error.message, true) } finally { setBusy(false) }
  }
  return (
    <article className="decision-card">
      <div className="decision-title"><div><strong>{expense.reference}</strong><span>{expense.category} · proposed {expense.proposed_allocation}</span></div><strong>{formatEuro(expense.amount_cents)}</strong></div>
      <p>{expense.description}</p>
      <label>Final allocation<select value={allocation} onChange={(event) => setAllocation(event.target.value)}><option>A</option><option>B</option><option>Company overhead</option></select></label>
      <button onClick={approve} disabled={busy}>{busy ? 'Saving…' : 'Confirm allocation'}</button>
    </article>
  )
}

function Dashboard({ summary, homeworkSummary }) {
  const hasInstructorActivity = summary.company.incomeCents !== homeworkSummary.company.incomeCents ||
    summary.company.expensesCents !== homeworkSummary.company.expensesCents ||
    summary.pendingSalesCents !== homeworkSummary.pendingSalesCents
  return (
    <section className="panel">
      <div className="section-heading"><div><p className="eyebrow">Approved activity</p><h2>Financial results</h2></div><span>Live from Supabase</span></div>
      <div className="project-grid">
        {['A', 'B'].map((project) => <div className="project" key={project}><h3>Project {project}</h3>
          <Metric label="Income" value={summary.projects[project].incomeCents} />
          <Metric label="Commissions" value={summary.projects[project].commissionCents} />
          <Metric label="Allocated expenses" value={summary.projects[project].expensesCents} />
          <Metric label="Result" value={summary.projects[project].resultCents} tone="result" />
        </div>)}
        <div className="project company"><h3>Company</h3>
          <Metric label="Income" value={summary.company.incomeCents} />
          <Metric label="Commissions" value={summary.company.commissionCents} />
          <Metric label="All recorded expenses" value={summary.company.expensesCents} />
          <Metric label="Overhead" value={summary.company.overheadCents} />
          <Metric label="Awaiting allocation" value={summary.company.awaitingCents} />
          <Metric label="Result" value={summary.company.resultCents} tone="result" />
        </div>
      </div>
      <div className="commission-row">
        <Metric label="Richard earned" value={summary.commissions.richard} />
        <Metric label="Anastasia earned" value={summary.commissions.anastasia} />
        <Metric label="Jean-Claude earned" value={summary.commissions['jean-claude']} />
        <Metric label="Pending sales" value={summary.pendingSalesCents} />
      </div>
      {hasInstructorActivity && <div className="baseline">
        <div><p className="eyebrow">Original homework only</p><strong>{formatEuro(homeworkSummary.company.resultCents)}</strong><span>Company result</span></div>
        <div><strong>{formatEuro(homeworkSummary.projects.A.resultCents)}</strong><span>Project A</span></div>
        <div><strong>{formatEuro(homeworkSummary.projects.B.resultCents)}</strong><span>Project B</span></div>
        <p>Instructor transactions are included in the current totals above and remain labelled separately in the records and Google Sheets.</p>
      </div>}
    </section>
  )
}

function Records({ sales, expenses, manager, onRetry }) {
  const splitText = (row, prefix) => `${row[`${prefix}_richard_pct`]} / ${row[`${prefix}_anastasia_pct`]} / ${row[`${prefix}_jean_claude_pct`]}%`
  return (
    <section className="panel records">
      <div className="section-heading"><div><p className="eyebrow">Audit trail</p><h2>Transaction records</h2></div><span>{sales.length + expenses.length} records</span></div>
      <h3>Sales</h3>
      <div className="table-wrap"><table><thead><tr><th>Ref</th><th>Group</th><th>Salesperson</th><th>Project</th><th>Amount</th><th>Proposed → approved split</th><th>Status</th><th>Sheets</th><th>Confirmation</th><th>Decision</th><th></th></tr></thead>
        <tbody>{sales.length ? sales.map((sale) => <tr key={sale.reference}><td>{sale.reference}</td><td>{sale.record_group === 'instructor_test' ? 'Instructor test' : 'Homework'}</td><td>{sale.salesperson_name}</td><td>{sale.project}</td><td>{formatEuro(sale.amount_cents)}</td><td>{splitText(sale, 'proposed')} → {sale.approved_richard_pct == null ? 'pending' : splitText(sale, 'approved')}</td><td><Status value={sale.status} /></td><td><Status value={sale.sync_status} /></td><td><Status value={sale.confirmation_status || 'not_required'} /></td><td><Status value={sale.notification_status} /></td><td>{manager && <RetryButtons row={sale} kind="sale" onRetry={onRetry} />}</td></tr>) : <tr><td colSpan="11">No sales yet.</td></tr>}</tbody>
      </table></div>
      <h3>Expenses</h3>
      <div className="table-wrap"><table><thead><tr><th>Ref</th><th>Group</th><th>Reporter</th><th>Proposed → final allocation</th><th>Amount</th><th>Status</th><th>Sheets</th><th>Confirmation</th><th>Decision</th><th></th></tr></thead>
        <tbody>{expenses.length ? expenses.map((expense) => <tr key={expense.reference}><td>{expense.reference}</td><td>{expense.record_group === 'instructor_test' ? 'Instructor test' : 'Homework'}</td><td>{expense.reporter_name}</td><td>{expense.proposed_allocation} → {expense.final_allocation || 'pending'}</td><td>{formatEuro(expense.amount_cents)}</td><td><Status value={expense.status} /></td><td><Status value={expense.sync_status} /></td><td><Status value={expense.confirmation_status || 'not_required'} /></td><td><Status value={expense.notification_status} /></td><td>{manager && <RetryButtons row={expense} kind="expense" onRetry={onRetry} />}</td></tr>) : <tr><td colSpan="10">No expenses yet.</td></tr>}</tbody>
      </table></div>
    </section>
  )
}

function RetryButtons({ row, kind, onRetry }) {
  const decisionMade = row.status === 'approved' || row.status === 'allocated'
  return <div className="retry">{row.sync_status === 'failed' && <button className="ghost" onClick={() => onRetry(kind, row.reference, 'sync')}>Retry sync</button>}{row.origin === 'telegram' && ['failed', 'pending'].includes(row.confirmation_status) && <button className="ghost" onClick={() => onRetry(kind, row.reference, 'confirmation')}>Retry confirmation</button>}{decisionMade && ['failed', 'pending'].includes(row.notification_status) && <button className="ghost" onClick={() => onRetry(kind, row.reference, 'notification')}>Retry decision</button>}</div>
}

function LinkTelegram({ employees, actorSlug, onDone }) {
  async function submit(event) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    try {
      await api('/api/employees/link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...data, actorSlug }) })
      onDone('Telegram account linked.')
    } catch (error) { onDone(error.message, true) }
  }
  return (
    <form className="panel form compact" onSubmit={submit}>
      <div className="section-heading"><div><p className="eyebrow">Manager setup</p><h2>Link Telegram user</h2></div></div>
      <p>Ask the employee to send <code>/whoami</code> to the bot, then save the returned IDs here.</p>
      <div className="field-grid">
        <label>Employee<select name="employeeSlug">{employees.map((employee) => <option key={employee.slug} value={employee.slug}>{employee.display_name}</option>)}</select></label>
        <label>Telegram user ID<input name="telegramUserId" inputMode="numeric" required /></label>
        <label>Telegram chat ID<input name="telegramChatId" inputMode="numeric" required /></label>
      </div>
      <button>Save link</button>
    </form>
  )
}

export default function FinanceApp({ links }) {
  const [role, setRole] = useState('svetlana')
  const [snapshot, setSnapshot] = useState(null)
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(true)
  const actor = useMemo(() => EMPLOYEES.find((employee) => employee.slug === role), [role])
  const load = useCallback(async () => {
    setLoading(true)
    try { setSnapshot(await api(`/api/snapshot?role=${encodeURIComponent(role)}`)) }
    catch (error) { setNotice({ text: error.message, error: true }); setSnapshot(null) }
    finally { setLoading(false) }
  }, [role])
  useEffect(() => { load() }, [load])

  async function done(text, error = false) { setNotice({ text, error }); if (!error) await load() }
  async function retry(kind, reference, operation) {
    try { await api('/api/retry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, reference, operation }) }); done(`${reference}: retry completed.`) }
    catch (error) { done(error.message, true) }
  }

  return (
    <div className="shell app-shell">
      <nav className="toolbar panel">
        <label>Demonstration role<select value={role} onChange={(event) => setRole(event.target.value)}>{EMPLOYEES.map((employee) => <option key={employee.slug} value={employee.slug}>{employee.name}</option>)}</select></label>
        <div className="role-summary"><span>{actor.role.replace('_', ' ')}</span><strong>{actor.name}</strong></div>
        <button className="ghost" onClick={load}>Refresh</button>
      </nav>
      <div className="resource-links">
        {links.telegram && <a href={links.telegram} target="_blank" rel="noreferrer">Telegram bot ↗</a>}
        {links.sheets && <a href={links.sheets} target="_blank" rel="noreferrer">Google Sheet ↗</a>}
        {links.github && <a href={links.github} target="_blank" rel="noreferrer">GitHub repository ↗</a>}
      </div>
      {notice && <div className={`notice ${notice.error ? 'error' : ''}`}><span>{notice.text}</span><button onClick={() => setNotice(null)}>Dismiss</button></div>}
      {loading && <div className="panel loading">Loading current records…</div>}
      {!loading && snapshot && <>
        {actor.role === 'salesperson' && <SaleForm actorSlug={role} onDone={done} />}
        {actor.role === 'expense_reporter' && <ExpenseForm actorSlug={role} onDone={done} />}
        {actor.role === 'manager' && snapshot.summary && <Dashboard summary={snapshot.summary} homeworkSummary={snapshot.homeworkSummary} />}
        {actor.role === 'manager' && <section className="panel"><div className="section-heading"><div><p className="eyebrow">Manager queue</p><h2>Pending decisions</h2></div></div>
          <div className="decision-grid">
            {snapshot.sales.filter((item) => item.status === 'pending').map((sale) => <SaleDecision key={sale.reference} sale={sale} actorSlug={role} onDone={done} />)}
            {snapshot.expenses.filter((item) => item.status === 'awaiting_allocation').map((expense) => <ExpenseDecision key={expense.reference} expense={expense} actorSlug={role} onDone={done} />)}
            {!snapshot.sales.some((item) => item.status === 'pending') && !snapshot.expenses.some((item) => item.status === 'awaiting_allocation') && <p className="empty">No decisions are waiting.</p>}
          </div>
        </section>}
        {actor.role === 'manager' && <LinkTelegram employees={snapshot.employees} actorSlug={role} onDone={done} />}
        <Records sales={snapshot.sales} expenses={snapshot.expenses} manager={actor.role === 'manager'} onRetry={retry} />
      </>}
      <section className="panel instructions"><div className="section-heading"><div><p className="eyebrow">How to use</p><h2>Submission and approval flow</h2></div></div>
        <ol><li>Select a salesperson to enter a sale, or Kevin to enter an expense.</li><li>Switch to Svetlana to approve commission splits and allocate project expenses.</li><li>Check synchronization and notification statuses in the audit trail. Failed operations retain the saved transaction and can be retried.</li></ol>
        <p>Telegram formats: <code>/sale S01 | Customer | A | Description | 1000 | 50/30/20</code> and <code>/expense E01 | Materials | 120 | A | Description</code>.</p>
      </section>
    </div>
  )
}
