import FinanceApp from '@/components/FinanceApp.js'

export default function Page() {
  const links = {
    telegram: process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || '',
    sheets: process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL || '',
    github: process.env.NEXT_PUBLIC_GITHUB_URL || ''
  }
  return (
    <main>
      <header className="hero shell">
        <div>
          <p className="eyebrow">Friends Included Ltd</p>
          <h1>Wedding guest finance desk</h1>
          <p className="lede">Sales, expenses, approvals, commissions and project results in one auditable system.</p>
        </div>
        <div className="identity">
          <span>Prepared by</span>
          <strong>{process.env.NEXT_PUBLIC_STUDENT_NAME || 'Your name'}</strong>
        </div>
      </header>
      <FinanceApp links={links} />
    </main>
  )
}
