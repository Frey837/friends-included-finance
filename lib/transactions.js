import { ALLOCATIONS, EXPENSE_CATEGORIES, PROJECTS, euroToCents, validateReference, validateSplit } from './domain.js'
import { requireText } from './http.js'
import { getSupabaseAdmin, rpc } from './supabase-admin.js'
import { syncExpense, syncSale } from './google-sheets.js'
import {
  expenseDecisionMessage,
  expenseSubmissionMessage,
  saleDecisionMessage,
  saleSubmissionMessage,
  sendTelegram
} from './telegram.js'

async function mark(table, reference, values) {
  const { error } = await getSupabaseAdmin().from(table).update(values).eq('reference', reference)
  if (error) throw error
}

async function syncRecord(kind, record) {
  const table = kind === 'sale' ? 'sales' : 'expenses'
  try {
    if (kind === 'sale') await syncSale(record)
    else await syncExpense(record)
    await mark(table, record.reference, { sync_status: 'synced', sync_error: null })
    return { ...record, sync_status: 'synced', sync_error: null }
  } catch (error) {
    await mark(table, record.reference, { sync_status: 'failed', sync_error: String(error.message || error) })
    return { ...record, sync_status: 'failed', sync_error: String(error.message || error) }
  }
}

async function notifyRecord(kind, record, message) {
  const table = kind === 'sale' ? 'sales' : 'expenses'
  const chatId = record.origin_chat_id || record.notification_chat_id || record.employee_telegram_chat_id
  if (!chatId) {
    await mark(table, record.reference, { notification_status: 'no_recipient', notification_error: 'No Telegram recipient linked' })
    return { ...record, notification_status: 'no_recipient' }
  }
  try {
    await sendTelegram(chatId, message)
    await mark(table, record.reference, { notification_status: 'sent', notification_error: null })
    return { ...record, notification_status: 'sent', notification_error: null }
  } catch (error) {
    await mark(table, record.reference, { notification_status: 'failed', notification_error: String(error.message || error) })
    return { ...record, notification_status: 'failed', notification_error: String(error.message || error) }
  }
}

async function confirmSubmission(kind, record) {
  const table = kind === 'sale' ? 'sales' : 'expenses'
  const message = kind === 'sale' ? saleSubmissionMessage(record) : expenseSubmissionMessage(record)
  await mark(table, record.reference, { confirmation_status: 'pending', confirmation_error: null })
  try {
    await sendTelegram(record.origin_chat_id, message)
    await mark(table, record.reference, { confirmation_status: 'sent', confirmation_error: null })
    return { ...record, confirmation_status: 'sent', confirmation_error: null }
  } catch (error) {
    await mark(table, record.reference, { confirmation_status: 'failed', confirmation_error: String(error.message || error) })
    return { ...record, confirmation_status: 'failed', confirmation_error: String(error.message || error) }
  }
}

export async function submitSale(actorSlug, payload, origin = 'website', originChatId = null) {
  const split = validateSplit(payload.split)
  const record = await rpc('fi_submit_sale', {
    p_actor_slug: actorSlug,
    p_reference: validateReference(payload.reference, 'sale'),
    p_customer: requireText(payload.customer, 'Customer'),
    p_project: PROJECTS.includes(payload.project) ? payload.project : null,
    p_description: requireText(payload.description, 'Description', 500),
    p_amount_cents: euroToCents(payload.amount),
    p_richard_pct: split.richard,
    p_anastasia_pct: split.anastasia,
    p_jean_claude_pct: split['jean-claude'],
    p_origin: origin,
    p_origin_chat_id: originChatId,
    p_record_group: payload.recordGroup === 'instructor_test' ? 'instructor_test' : 'homework'
  })
  const synced = await syncRecord('sale', record)
  return origin === 'telegram' ? confirmSubmission('sale', synced) : synced
}

export async function submitExpense(actorSlug, payload, origin = 'website', originChatId = null) {
  const record = await rpc('fi_submit_expense', {
    p_actor_slug: actorSlug,
    p_reference: validateReference(payload.reference, 'expense'),
    p_description: requireText(payload.description, 'Description', 500),
    p_category: EXPENSE_CATEGORIES.includes(payload.category) ? payload.category : null,
    p_amount_cents: euroToCents(payload.amount),
    p_proposed_allocation: ALLOCATIONS.includes(payload.proposedAllocation) ? payload.proposedAllocation : null,
    p_origin: origin,
    p_origin_chat_id: originChatId,
    p_record_group: payload.recordGroup === 'instructor_test' ? 'instructor_test' : 'homework'
  })
  const synced = await syncRecord('expense', record)
  return origin === 'telegram' ? confirmSubmission('expense', synced) : synced
}

export async function approveSale(actorSlug, payload) {
  const split = validateSplit(payload.split)
  let record = await rpc('fi_approve_sale', {
    p_actor_slug: actorSlug,
    p_reference: validateReference(payload.reference, 'sale'),
    p_richard_pct: split.richard,
    p_anastasia_pct: split.anastasia,
    p_jean_claude_pct: split['jean-claude']
  })
  record = await syncRecord('sale', record)
  return notifyRecord('sale', record, saleDecisionMessage(record))
}

export async function allocateExpense(actorSlug, payload) {
  let record = await rpc('fi_allocate_expense', {
    p_actor_slug: actorSlug,
    p_reference: validateReference(payload.reference, 'expense'),
    p_final_allocation: ALLOCATIONS.includes(payload.finalAllocation) ? payload.finalAllocation : null
  })
  record = await syncRecord('expense', record)
  return notifyRecord('expense', record, expenseDecisionMessage(record))
}

export async function retrySync(kind, reference) {
  const table = kind === 'sale' ? 'sales' : 'expenses'
  const { data, error } = await getSupabaseAdmin().from(table).select('*').eq('reference', reference).single()
  if (error) throw error
  return syncRecord(kind, data)
}

export async function retryNotification(kind, reference) {
  const table = kind === 'sale' ? 'sales' : 'expenses'
  const { data, error } = await getSupabaseAdmin().from(table).select('*').eq('reference', reference).single()
  if (error) throw error
  const message = kind === 'sale' ? saleDecisionMessage(data) : expenseDecisionMessage(data)
  return notifyRecord(kind, data, message)
}

export async function retryConfirmation(kind, reference) {
  const table = kind === 'sale' ? 'sales' : 'expenses'
  const { data, error } = await getSupabaseAdmin().from(table).select('*').eq('reference', reference).single()
  if (error) throw error
  if (data.origin !== 'telegram' || !data.origin_chat_id) throw new Error('This record has no Telegram submission chat.')
  return confirmSubmission(kind, data)
}
