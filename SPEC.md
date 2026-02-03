You are a senior full-stack engineer. Build the MVP web app "Atena" (personal finance manager).

GOAL
A web-first, mobile-friendly app to manage:
- Credit cards with statement logic (closing day, due day)
- Card purchases (with installments auto-generated into future months)
- Statement payments (partial/early) that reduce open totals
- Debit spending
- Monthly income tracking
This MVP is private for me at first.

STACK (MANDATORY)
- Next.js 14+ App Router
- TypeScript
- TailwindCSS
- PostgreSQL in Docker (local)
- Prisma ORM (migrations + seed)
- Use server actions OR route handlers consistently (pick one and stick to it)
- UI can use shadcn/ui OR simple Tailwind components, but keep consistent

DATABASE
Postgres connection:
- DB name: "atena-db"
- DB user: postgres
- DB password: postgres
- host: localhost:5432

DELIVERABLES
1) docker-compose.yml for Postgres
2) prisma/schema.prisma modeling all tables + relations + indexes
3) Prisma migrations
4) prisma/seed.ts that creates default admin user:
   - email = "admin"
   - password = "admin" (stored as bcrypt hash)
   - seed must be idempotent (safe to run multiple times)
5) Next.js pages + components + server logic to make the app usable end-to-end
6) README with setup/run instructions

AUTH
- Implement email/password login.
- For MVP: only login screen, no signup page.
- Seed creates the admin user ("admin"/"admin").
- Protect all app routes; if not authenticated, redirect to /login.
- Use secure session strategy (Next.js compatible). You may implement auth using:
  Option A: NextAuth Credentials provider + Prisma adapter
  Option B: custom JWT cookie sessions + bcrypt password compare
Choose one and implement fully. Keep it simple and secure.

DATA MODEL (MANDATORY TABLES)
Users
- id uuid
- email unique
- passwordHash
- createdAt

Cards
- id uuid
- userId fk
- name string
- creditLimit decimal(12,2)
- closingDay int (1..28)
- dueDay int (1..28)
- createdAt

CardPurchases (purchase header)
- id uuid
- userId fk
- cardId fk
- description string
- amountTotal decimal(12,2)
- purchaseDate date
- installments int >= 1
- createdAt

CardInstallments (generated)
- id uuid
- userId fk
- cardId fk
- purchaseId fk
- installmentNumber int 1..N
- amount decimal(12,2)
- statementMonth date (store as first day of month: YYYY-MM-01)
- status enum ('open','paid') default 'open'
- createdAt
- unique(purchaseId, installmentNumber)

CardPayments (partial/early payments)
- id uuid
- userId fk
- cardId fk
- statementMonth date
- paymentDate date default today
- amount decimal(12,2)
- method string default 'other'
- note optional
- createdAt

CardPaymentAllocations (optional but include)
- id uuid
- userId fk
- paymentId fk -> CardPayments
- installmentId fk -> CardInstallments
- amount decimal(12,2)
- createdAt
- unique(paymentId, installmentId)

DebitTransactions
- id uuid
- userId fk
- description string
- amount decimal(12,2)
- date date default today
- createdAt

IncomeTransactions
- id uuid
- userId fk
- description string
- amount decimal(12,2)
- date date default today
- createdAt

BUSINESS LOGIC (CRITICAL)
We select a month (year+month) across the app; represent it as statementMonth = first day of month (YYYY-MM-01).

1) Determine base statementMonth for a purchase, using bank-like closing day:
- Statement month M covers period:
  from (closingDay + 1) of previous month
  through closingDay of month M (inclusive).
- Given purchaseDate, compute which statement month M it belongs to.
- closingDay is 1..28, assume.

2) Installments generation:
- When creating a CardPurchase:
  - Create N CardInstallments.
  - installment 1 uses base statementMonth.
  - installment k uses base statementMonth + (k-1 months).
  - Split amountTotal into N decimal amounts safely:
    Use cents integer math to avoid floating errors.
    Ensure sum(installments) == amountTotal exactly.

3) Statement totals for a card/month:
- statementTotal = SUM(CardInstallments.amount WHERE cardId AND statementMonth)
- paidTotal = SUM(CardPayments.amount WHERE cardId AND statementMonth)
- openTotal = statementTotal - paidTotal
- UI must prevent overpayment (payment amount <= openTotal, unless openTotal is 0).

4) Allocate payments to installments (oldest first):
- When a payment is recorded for cardId+statementMonth:
  - Allocate across open installments of that month in order (installmentNumber asc, createdAt asc).
  - Create CardPaymentAllocation rows.
  - Optionally set installment status to 'paid' if fully covered.
  - This must not break if multiple payments happen.

5) Due date display for statementMonth M:
- closingDate = date(closingDay in month M)
- if dueDay > closingDay: dueDate = date(dueDay in month M)
- else dueDate = date(dueDay in month M+1)

FEATURES / PAGES (MVP)
Routes (all protected except /login):
- /login
- / (Dashboard)
- /cards (list cards, add/edit)
- /cards/[id] (statement view by month, add purchase, list installments, register payment)
- /debit (list/add debit transactions by month)
- /income (list/add income transactions by month)
- /logout

UI REQUIREMENTS
- Mobile-friendly layout
- Month selector (default current month) used in Dashboard and Card statement pages
- Simple components: Button, Input, Select, Card, Modal
- Show helpful errors and loading states

DASHBOARD REQUIREMENTS (for selected month)
- Total credit card spending (sum of all cards statementTotal for month)
- Total paid towards cards (sum of payments for month)
- Total open on cards (sum of openTotal for month)
- Per-card card tiles showing statementTotal, paidTotal, openTotal, dueDate
- Total debit spending for month
- Total income for month
- Balance = income - (debit + credit card spending) (or show both separately)
- Last 10 activity list combining:
  - card purchases (createdAt)
  - payments
  - debit
  - income
(You can build this list by querying each table and merging on server)

CARDS PAGE
- List cards
- Add card form: name, limit, closingDay, dueDay
- Edit card

CARD DETAIL PAGE
- Month selector
- Summary: statementTotal, paidTotal, openTotal, closingDate, dueDate
- Installments table (installmentNumber, description (from purchase), amount)
- Add purchase form:
  - description
  - amountTotal
  - purchaseDate
  - installments
- Register payment modal:
  - amount
  - paymentDate
  - method
  - note
  - on submit: creates payment + allocations and updates UI

DEBIT PAGE
- Month selector
- Add debit transaction: description, amount, date
- List by date desc
- Monthly total

INCOME PAGE
- Month selector
- Add income: description, amount, date
- List by date desc
- Monthly total

PROJECT STRUCTURE
- /app routes
- /components reusable UI
- /lib db/auth helpers
- /prisma schema, seed
- include .env.example

SCRIPTS
package.json scripts:
- dev (start Next)
- db:up (docker compose up -d)
- db:down (docker compose down)
- db:migrate (prisma migrate deploy)
- db:seed (prisma db seed)
- dev:setup (db:up + migrate + seed + dev) OR provide a single shell script

OUTPUT FORMAT
First print a file tree of everything you will create.
Then provide each file with full contents (no placeholders).

Start now.
