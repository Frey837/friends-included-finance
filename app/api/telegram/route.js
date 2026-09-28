import { EMPLOYEES } from '@/lib/domain.js'
import { getSupabaseAdmin } from '@/lib/supabase-admin.js'
import { sendTelegram } from '@/lib/telegram.js'
import { submitExpense, submitSale } from '@/lib/transactions.js'

function parseSplit(value) {
  const parts = value.split('/').map((item) => Number(item.trim().replace('%', '')))
  if (parts.length !== 3) throw new Error('Use a split like 50/30/20.')
  return { richard: parts[0], anastasia: parts[1], 'jean-claude': parts[2] }
}

function parseMessage(text) {
  const parts = text.split('|').map((part) => part.trim())
  const command = parts[0].split(/\s+/)[0].toLowerCase()
  if (command === '/sale' || command === '/testsale') {
    if (parts.length !== 6) throw new Error('Use: /sale S01 | Customer | A | Description | 1000 | 50/30/20')
    const [head, customer, project, description, amount, split] = parts
    return {
      kind: 'sale', reference: head.split(/\s+/)[1], customer, project: project.toUpperCase(),
      description, amount, split: parseSplit(split), recordGroup: command === '/testsale' ? 'instructor_test' : 'homework'
    }
  }
  if (command === '/expense' || command === '/testexpense') {
    if (parts.length !== 5) throw new Error('Use: /expense E01 | Materials | 120 | A | Description')
    const [head, category, amount, proposedAllocation, description] = parts
    const normalized = proposedAllocation.toLowerCase() === 'overhead' ? 'Company overhead' : proposedAllocation.toUpperCase()
    return { kind: 'expense', reference: head.split(/\s+/)[1], category, amount, proposedAllocation: normalized, description,
      recordGroup: command === '/testexpense' ? 'instructor_test' : 'homework' }
  }
  return { kind: command }
}

export async function POST(request) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 })
  }
  const update = await request.json()
  const message = update.message
  if (!message?.text || !message.chat?.id || !message.from?.id) return Response.json({ ok: true })
  const chatId = message.chat.id
  try {
    const parsed = parseMessage(message.text)
    if (parsed.kind === '/start' || parsed.kind === '/help') {
      await sendTelegram(chatId, [
        'Friends Included finance bot',
        `Your Telegram user ID is ${message.from.id}. Ask Svetlana to link it before submitting.`,
        'Sale: /sale S01 | Customer | A | Description | 1000 | 50/30/20',
        'Expense: /expense E01 | Materials | 120 | A | Description',
        'Instructor checks: use /testsale or /testexpense so original homework totals stay visible.',
        'Use “overhead” for Company overhead.'
      ].join('\n'))
      return Response.json({ ok: true })
    }
    if (parsed.kind === '/whoami') {
      await sendTelegram(chatId, `Telegram user ID: ${message.from.id}\nChat ID: ${chatId}`)
      return Response.json({ ok: true })
    }
    const { data: employee, error } = await getSupabaseAdmin()
      .from('employees')
      .select('slug')
      .eq('telegram_user_id', message.from.id)
      .single()
    if (error || !employee || !EMPLOYEES.some((item) => item.slug === employee.slug)) {
      await sendTelegram(chatId, `This Telegram user is not linked. Your user ID is ${message.from.id}.`)
      return Response.json({ ok: true })
    }
    if (parsed.kind === 'sale') await submitSale(employee.slug, parsed, 'telegram', chatId)
    else if (parsed.kind === 'expense') await submitExpense(employee.slug, parsed, 'telegram', chatId)
    else await sendTelegram(chatId, 'Unknown command. Send /help for examples.')
  } catch (error) {
    try {
      await sendTelegram(chatId, `Not recorded: ${error.message || error}`)
    } catch {
      // Return 200 even when Telegram delivery itself is unavailable. A webhook retry
      // must not create a duplicate transaction after a successful database write.
    }
  }
  return Response.json({ ok: true })
}
