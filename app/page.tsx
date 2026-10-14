import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import MonthSelector from '@/components/MonthSelector'
import MonthSpreadsheet from '@/components/MonthSpreadsheet'
import Card, { CardStat } from '@/components/ui/Card'
import ActivityList from '@/components/ActivityList'
import ExportLoansButton from '@/components/ExportLoansButton'
import { getDashboardData, getRecommendedStatementMonth } from '@/lib/actions/dashboard'
import { getReceivablesSummaryByPerson } from '@/lib/actions/receivables'
import { getMonthCharges } from '@/lib/actions/charges'
import { getCategoryTotals } from '@/lib/actions/reports'
import { getMonthlyBudget } from '@/lib/actions/budget'
import PersonCharges from '@/components/PersonCharges'
import BudgetCard from '@/components/BudgetCard'
import { formatCurrency, formatDateDisplay } from '@/lib/utils'
import { getSession } from '@/lib/auth'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface DashboardPageProps {
  searchParams: Promise<{ month?: string }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const session = await getSession()
  // Use recommended month based on card closing days, not just calendar month
  const recommendedMonth = await getRecommendedStatementMonth()
  const currentMonth = params.month || recommendedMonth

  return (
    <div className="min-h-screen">
      <Navbar isAdmin={session?.isAdmin} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100">Dashboard</h1>
            <Link href="/reports" className="text-sm text-primary-600 dark:text-primary-400 font-medium">Ver o ano</Link>
          </div>
          <Suspense fallback={<div className="h-10 w-48 bg-gray-200 dark:bg-neutral-800 rounded-lg animate-pulse" />}>
            <MonthSelector currentMonth={currentMonth} />
          </Suspense>
        </div>

        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent month={currentMonth} />
        </Suspense>
      </main>
    </div>
  )
}

async function DashboardContent({ month }: { month: string }) {
  const [data, receivablesSummary, monthCharges, categories, budget] = await Promise.all([
    getDashboardData(month),
    getReceivablesSummaryByPerson(),
    getMonthCharges(month),
    getCategoryTotals(month),
    getMonthlyBudget(month),
  ])
  
  return (
    <div className="space-y-6">
      {/* Summary Cards - Only show full summary for current/future months */}
      <Card>
        <p className="text-sm font-medium text-stone-500 dark:text-stone-400">Saldo do mês</p>
        <p className={`mt-1 text-4xl font-semibold tracking-tight tabular-nums ${Number(data.balance) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {formatCurrency(data.balance)}
        </p>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          Saldo total{' '}
          <span className={`font-semibold tabular-nums ${Number(data.accumulatedBalance) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(data.accumulatedBalance)}
          </span>
        </p>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card><CardStat label="Receitas" value={formatCurrency(data.totalIncome)} variant="success" /></Card>
        <Card><CardStat label="Gastos Cartão" value={formatCurrency(data.totalCreditSpending)} variant="danger" /></Card>
        <Card><CardStat label="Gastos Débito" value={formatCurrency(data.totalDebitSpending)} variant="danger" /></Card>
        <Card><CardStat label="Pago Cartões" value={formatCurrency(data.totalPaidTowardsCards)} variant="success" /></Card>
        <Card className="col-span-2 md:col-span-1"><CardStat label="Em Aberto" value={formatCurrency(data.totalOpenOnCards)} variant="warning" /></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <BudgetCard
          month={month}
          budget={budget}
          spent={Number(data.totalCreditSpending) + Number(data.totalDebitSpending)}
        />
        <Card title="Por categoria" subtitle="Cartão e débito deste mês">
          {categories.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">Nenhum gasto neste mês.</p>
          ) : (
            <div className="space-y-2">
              {categories.map(item => (
                <div key={item.category} className="flex items-center justify-between text-sm">
                  <span className="text-stone-700 dark:text-stone-200">{item.category}</span>
                  <span className="tabular-nums font-medium text-stone-800 dark:text-stone-100">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Cards Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100">Cartões de Crédito</h2>
          <Link 
            href="/cards" 
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
          >
            Ver todos →
          </Link>
        </div>

        {data.cards.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-stone-500 dark:text-stone-400 mb-4">Nenhum cartão cadastrado</p>
              <Link
                href="/cards"
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
              >
                Adicionar cartão
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.cards.map((card) => (
              <Link key={card.id} href={`/cards/${card.id}?month=${month}`}>
                <Card accentColor={card.color} className="hover:shadow-soft-lg cursor-pointer h-full">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-stone-800 dark:text-stone-100">{card.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      Number(card.openTotal) > 0 
                        ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300' 
                        : 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
                    }`}>
                      {Number(card.openTotal) > 0 ? 'Pendente' : 'Quitado'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-stone-500 dark:text-stone-400">Fatura</p>
                      <p className="font-medium text-stone-800 dark:text-stone-100 tabular-nums">{formatCurrency(card.statementTotal)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500 dark:text-stone-400">Pago</p>
                      <p className="font-medium text-green-600 dark:text-green-400 tabular-nums">{formatCurrency(card.paidTotal)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500 dark:text-stone-400">Aberto</p>
                      <p className="font-medium text-yellow-600 dark:text-yellow-400 tabular-nums">{formatCurrency(card.openTotal)}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-stone-100 dark:border-neutral-800 dark:border-neutral-800 text-xs text-stone-500 dark:text-stone-400">
                    Vencimento: {formatDateDisplay(card.dueDate)}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* A Receber Section - Combines Loans + Receivables */}
      {(() => {
        // Combine loans and receivables by person
        const loansMap = new Map(data.loansSummary?.map(l => [l.borrowerName.toLowerCase(), l]) || [])
        const receivablesMap = new Map(receivablesSummary.map(r => [r.personName.toLowerCase(), r]))
        
        // Get all unique person names
        const chargesByPerson = new Map<string, typeof monthCharges>()
        for (const charge of monthCharges) {
          const key = charge.personName.toLowerCase()
          const list = chargesByPerson.get(key) || []
          list.push(charge)
          chargesByPerson.set(key, list)
        }

        const allPersons = new Set([
          ...(data.loansSummary?.map(l => l.borrowerName) || []),
          ...receivablesSummary.map(r => r.personName),
        ])
        const knownPersons = new Set(Array.from(allPersons).map(name => name.toLowerCase()))
        for (const charge of monthCharges) {
          if (!knownPersons.has(charge.personName.toLowerCase())) {
            allPersons.add(charge.personName)
            knownPersons.add(charge.personName.toLowerCase())
          }
        }
        
        // Calculate combined totals
        const totalReceivablesAmount = receivablesSummary.reduce((sum, r) => sum + Number(r.pendingAmount), 0)
        const totalLoansOwed = Number(data.totalLoansOwed || 0)
        const totalAReceber = totalLoansOwed + totalReceivablesAmount
        
        if (allPersons.size === 0) return null
        
        return (
          <Card 
            title="A Receber" 
            subtitle={`${allPersons.size} pessoa(s)`}
          >
            <div className="space-y-4">
              {/* Summary */}
              <div className={`grid grid-cols-2 ${data.loansEnabled ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg`}>
                {data.loansEnabled && (
                  <div>
                    <p className="text-sm text-stone-500 dark:text-stone-400">Total Empréstimos</p>
                    <p className="text-lg font-bold text-stone-800 dark:text-stone-100 tabular-nums">{formatCurrency(data.totalLoansOwed || '0')}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{data.loansEnabled ? 'Total Outros' : 'A Receber'}</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">{formatCurrency(totalReceivablesAmount.toString())}</p>
                </div>
                {data.loansEnabled && (
                  <div>
                    <p className="text-sm text-stone-500 dark:text-stone-400">Empréstimos Este Mês</p>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums">{formatCurrency(data.totalLoansThisMonth || '0')}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-stone-500 dark:text-stone-400">Total Geral</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">{formatCurrency(totalAReceber.toString())}</p>
                </div>
              </div>

              {/* People List */}
              <div className="space-y-3">
                {Array.from(allPersons).map((personName) => {
                  const loan = loansMap.get(personName.toLowerCase())
                  const receivable = receivablesMap.get(personName.toLowerCase())
                  const personCharges = chargesByPerson.get(personName.toLowerCase()) || []
                  const totalPerson = Number(loan?.totalOwed || 0) + Number(receivable?.pendingAmount || 0)
                  const monthAmount = personCharges.reduce((sum, charge) => sum + Number(charge.amount), 0)
                  
                  return (
                    <div 
                      key={personName} 
                      className="p-3 bg-gray-50 dark:bg-neutral-900 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 flex items-center justify-center font-bold">
                            {personName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-stone-800 dark:text-stone-100">{personName}</p>
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                              {loan && <span>{loan.loanCount} empréstimo(s)</span>}
                              {loan && receivable && <span> • </span>}
                              {receivable && <span>{receivable.receivableCount} a receber</span>}
                              {totalPerson > 0 && <span> • Saldo total: {formatCurrency(totalPerson.toString())}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            {monthAmount > 0 ? (
                              <>
                                <p className="font-bold text-orange-600 dark:text-orange-400">
                                  {formatCurrency(monthAmount.toString())}
                                </p>
                                <p className="text-xs text-stone-500 dark:text-stone-400">a cobrar neste mês</p>
                              </>
                            ) : (
                              <p className="text-sm text-stone-400 dark:text-stone-500">
                                Sem parcela este mês
                              </p>
                            )}
                          </div>
                          {/* Botão de download individual */}
                          <ExportLoansButton month={month} borrowerName={personName} />
                        </div>
                      </div>
                      
                      <PersonCharges charges={personCharges} />
                    </div>
                  )
                })}
              </div>
              
              {/* Link para gerenciar receivables */}
              <Link 
                href="/receivables"
                className="block text-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium py-2"
              >
                Gerenciar A Receber →
              </Link>
            </div>
          </Card>
        )
      })()}

      <Card title="Atividade Recente" subtitle="Últimas 10 transações">
        <ActivityList activities={data.recentActivity} />
      </Card>

      <MonthSpreadsheet month={month} />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-neutral-900 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-20 mb-2" />
            <div className="h-6 bg-gray-200 dark:bg-neutral-800 rounded w-24" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-neutral-800 rounded w-40 mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-neutral-800 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}
