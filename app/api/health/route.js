import { ok } from '@/lib/http.js'

export function GET() {
  return ok({
    ok: true,
    configured: {
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET),
      googleSheets: Boolean(process.env.GOOGLE_SPREADSHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    }
  })
}
