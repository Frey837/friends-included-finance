import { formatEuro } from './domain.js'

export async function sendTelegram(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('Telegram is not configured.')
  if (!chatId) throw new Error('No Telegram recipient linked.')
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  })
  const body = await response.json()
  if (!response.ok || !body.ok) throw new Error(body.description || 'Telegram delivery failed.')
  return body.result
}

export function saleSubmissionMessage(sale) {
  return `Sale ${sale.reference} recorded. ${formatEuro(sale.amount_cents)} for project ${sale.project}. Status: Pending approval.`
}

export function expenseSubmissionMessage(expense) {
  const status = expense.status === 'allocated' ? 'Allocated automatically' : 'Awaiting allocation'
  return `Expense ${expense.reference} recorded. ${formatEuro(expense.amount_cents)}. Proposed allocation: ${expense.proposed_allocation}. Status: ${status}.`
}

export function saleDecisionMessage(sale) {
  const changed = [
    sale.proposed_richard_pct !== sale.approved_richard_pct,
    sale.proposed_anastasia_pct !== sale.approved_anastasia_pct,
    sale.proposed_jean_claude_pct !== sale.approved_jean_claude_pct
  ].some(Boolean)
  return [
    `Sale ${sale.reference} approved${changed ? ' — commission split changed' : ''}.`,
    `Sale ${formatEuro(sale.amount_cents)}; total commission ${formatEuro(sale.commission_pool_cents)}.`,
    `Richard: ${sale.proposed_richard_pct}% → ${sale.approved_richard_pct}% (${formatEuro(sale.richard_commission_cents)}).`,
    `Anastasia: ${sale.proposed_anastasia_pct}% → ${sale.approved_anastasia_pct}% (${formatEuro(sale.anastasia_commission_cents)}).`,
    `Jean-Claude: ${sale.proposed_jean_claude_pct}% → ${sale.approved_jean_claude_pct}% (${formatEuro(sale.jean_claude_commission_cents)}).`
  ].join('\n')
}

export function expenseDecisionMessage(expense) {
  const changed = expense.proposed_allocation !== expense.final_allocation
  return [
    `Expense ${expense.reference}${changed ? ' — allocation changed' : ' allocated'}.`,
    `${formatEuro(expense.amount_cents)}: ${expense.description}.`,
    `Proposed: ${expense.proposed_allocation}. Approved: ${expense.final_allocation}.`
  ].join('\n')
}
