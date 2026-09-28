import { DomainError } from '@/lib/domain.js'
import { fail, ok } from '@/lib/http.js'
import { rpc } from '@/lib/supabase-admin.js'

export async function POST(request) {
  try {
    const body = await request.json()
    const userId = Number(body.telegramUserId)
    const chatId = Number(body.telegramChatId || body.telegramUserId)
    if (!Number.isSafeInteger(userId) || !Number.isSafeInteger(chatId)) {
      throw new DomainError('Telegram user ID and chat ID must be whole numbers.')
    }
    const employee = await rpc('fi_link_telegram', {
      p_actor_slug: body.actorSlug,
      p_employee_slug: body.employeeSlug,
      p_telegram_user_id: userId,
      p_telegram_chat_id: chatId
    })
    return ok({ employee })
  } catch (error) {
    return fail(error)
  }
}
