const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const baseUrl = process.env.APP_URL

if (!token || !secret || !baseUrl) {
  console.error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and APP_URL first.')
  process.exit(1)
}

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url: `${baseUrl.replace(/\/$/, '')}/api/telegram`,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: true
  })
})
const body = await response.json()
console.log(JSON.stringify(body, null, 2))
if (!response.ok || !body.ok) process.exit(1)
