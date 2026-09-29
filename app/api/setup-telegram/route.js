export async function POST() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  const appUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://friends-included-finance-mu.vercel.app'

  if (!token || !secret) {
    return Response.json({ ok: false, error: 'Telegram is not configured.' }, { status: 503 })
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: `${appUrl}/api/telegram`,
      secret_token: secret,
      drop_pending_updates: true
    })
  })
  const result = await response.json()

  return Response.json({ ok: Boolean(result.ok), description: result.description || null }, {
    status: result.ok ? 200 : 502
  })
}
