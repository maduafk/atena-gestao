import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Card from '@/components/ui/Card'
import { getYearReport } from '@/lib/actions/reports'
import { getSession } from '@/lib/auth'
import { formatCurrency, formatMonthDisplay, parseStatementMonth } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface ReportsPageProps {
  searchParams: Promise<{ year?: string }>
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams
  const session = await getSession()
  const year = Number(params.year) || new Date().getFullYear()
  const rows = await getYearReport(year)

  return (
    <div className="min-h-screen">
      <Navbar isAdmin={session?.isAdmin} />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100">Ano {year}</h1>
            <p className="text-sm text-stone-500 dark:text-stone-400">Receitas, débito e faturas já lançadas, mês a mês.</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/reports?year=${year - 1}`} className="px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 text-sm">
              {year - 1}
            </Link>
            <Link href={`/reports?year=${year + 1}`} className="px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 text-sm">
              {year + 1}
            </Link>
          </div>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-stone-500 dark:text-stone-400 border-b border-stone-100 dark:border-neutral-800">
                  <th className="py-2 font-medium">Mês</th>
                  <th className="py-2 font-medium text-right">Receitas</th>
                  <th className="py-2 font-medium text-right">Débito</th>
                  <th className="py-2 font-medium text-right">Cartão</th>
                  <th className="py-2 font-medium text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.month} className="border-b border-stone-100 dark:border-neutral-800">
                    <td className="py-3 capitalize text-stone-800 dark:text-stone-100">{formatMonthDisplay(parseStatementMonth(row.month))}</td>
                    <td className="py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(row.income)}</td>
                    <td className="py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">{formatCurrency(row.debit)}</td>
                    <td className="py-3 text-right tabular-nums text-stone-800 dark:text-stone-100">{formatCurrency(row.card)}</td>
                    <td className={`py-3 text-right tabular-nums font-medium ${Number(row.balance) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  )
}
