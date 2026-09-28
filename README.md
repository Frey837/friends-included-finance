# Friends Included Finance

A Vercel-ready Next.js application for the Day 4 “Wedding Guests for Hire” homework. Supabase is the source of truth; Telegram and the website use the same transaction functions; Google Sheets receives an updatable copy of every record.

## What is included

- Five demonstration roles with server-side permission checks.
- Sales and expense entry through the website and Telegram.
- Manager approval of sales and commission splits.
- Manager allocation of project expenses.
- Automatic 10% commission calculation and deterministic cent rounding.
- Project and company results that exclude pending sales but include every paid expense.
- Telegram decision notifications sent to the original submission chat.
- Google Sheets upserts by reference, including later approvals and retries.
- Original homework and instructor test transactions remain labelled separately while sharing the same business rules.
- Visible synchronization and notification failures with retry controls.
- Separate delivery states for the initial Telegram confirmation and the later manager-decision message, preventing a delivered confirmation from remaining labelled “Sending.”
- Database uniqueness and row locking to prevent duplicate or repeated decisions.
- Automated checks for the supplied Test 1 and Test 2 totals.

## 1. Install and test

```bash
pnpm install
pnpm test
```

The automated tests verify amount validation, commission splits, rounding, and both homework control totals.

## 2. Create the Supabase database

1. Create a Supabase project.
2. Open the SQL Editor.
3. Run [`supabase/migrations/001_friends_included.sql`](supabase/migrations/001_friends_included.sql).
4. Copy the project URL and the service-role key into `.env.local` using `.env.example` as the template.

The service-role key must remain server-side. Never expose it through a `NEXT_PUBLIC_` variable or commit `.env.local`.

## 3. Create the Google Sheet

1. Create a spreadsheet with tabs named exactly `Sales` and `Expenses`.
2. In Google Cloud, enable the Google Sheets API and create a service account.
3. Share the spreadsheet with the service account email as Editor.
4. Put the spreadsheet ID and the complete service-account JSON in `.env.local`.
5. Set `NEXT_PUBLIC_GOOGLE_SHEET_URL` to the viewer link used by the instructor.

The application writes the header row automatically. It finds a transaction by reference and updates the same row after approval or retry.

## 4. Create the Telegram bot

1. Create a bot with BotFather and place the token in `TELEGRAM_BOT_TOKEN`.
2. Create a long random `TELEGRAM_WEBHOOK_SECRET`.
3. After deployment, set `APP_URL` in your terminal and run:

```bash
node scripts/set-telegram-webhook.mjs
```

Employees send `/whoami` to the bot. Svetlana then links the returned Telegram user ID and chat ID in the manager setup panel.

Supported commands:

```text
/sale S01 | Olivia Rose | A | One proud uncle | 1000 | 50/30/20
/expense E01 | Materials | 120 | A | Rented suit and fake pearl necklace
```

Use `overhead` in the allocation field for Company overhead.
For later instructor checks, use `/testsale` or `/testexpense`. These records affect the current live totals but the dashboard also preserves the original homework-only results, including the required €3,930 company result.

## 5. Run locally

```bash
copy .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`. Until Supabase variables are valid, the page intentionally shows a configuration error instead of using fake stored data.

## 6. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Import that repository into Vercel.
3. Add every value from `.env.example` to the Vercel project environment.
4. Deploy, then set the Telegram webhook using the deployed HTTPS URL.
5. Set the public Telegram, Google Sheets and GitHub links so they appear on the page.

The production build is `pnpm build`. All API routes require the Node.js runtime and must not be exported as a static site.

Google Sheets stores both proposed and approved percentages as consistently formatted percentage values, keeps individual earned commissions in separate columns, and labels each row as Original homework or Instructor test.

## 7. Complete the homework tests

Follow [`HOMEWORK-CHECKLIST.md`](HOMEWORK-CHECKLIST.md). After Test 2, verify the control totals with:

```bash
APP_URL=https://your-project.vercel.app node scripts/verify-test-2.mjs
```

## Security scope

The public role selector is intentionally provided for fictional demonstration data, as required by the homework. Do not enter real customer, employee, or financial data. Database writes still pass through server-side stored procedures that enforce the selected role.
