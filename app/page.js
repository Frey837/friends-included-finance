import FinanceApp from '@/components/FinanceApp.js'

export default function Page() {
  const links = {
    telegram: 'https://t.me/friends_included_frey837_bot',
    sheets: 'https://docs.google.com/spreadsheets/d/13uPTAIpm_AssbvYC1prpxAKWEqX8Lwkss23cLHDu2t4/edit',
    github: 'https://github.com/Frey837/friends-included-finance'
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
