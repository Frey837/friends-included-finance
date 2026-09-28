import './styles.css'

export const metadata = {
  title: 'Friends Included Finance',
  description: 'Transaction approvals, commissions and project results for Friends Included Ltd'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
