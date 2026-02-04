import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import MonthSelector from '@/components/MonthSelector'
import MonthSpreadsheet from '@/components/MonthSpreadsheet'
import Card, { CardStat } from '@/components/ui/Card'
import ActivityList from '@/components/ActivityList'
import ExportLoansButton from '@/components/ExportLoansButton'
import { getDashboardData, getRecommendedStatementMonth } from '@/lib/actions/dashboard'
import { formatCurrency, formatStatementMonth, formatDateDisplay, parseStatementMonth } from '@/lib/utils'
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar isAdmin={session?.isAdmin} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <Suspense fallback={<div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />}>
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
  const data = await getDashboardData(month)
  
  // Check if this is a past month (before current month)
  const monthDate = parseStatementMonth(month)
  const now = new Date()
  const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 1)
  const isPastMonth = monthDate < currentMonthDate

  return (
    <div className="space-y-6">
      {/* Summary Cards - Only show full summary for current/future months */}
      {isPastMonth ? (
        // Simplified view for past months - only card spending
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="col-span-1">
            <CardStat label="Gastos Cartão" value={formatCurrency(data.totalCreditSpending)} variant="danger" />
          </Card>
          <Card className="col-span-1">
            <CardStat label="Pago Cartões" value={formatCurrency(data.totalPaidTowardsCards)} variant="success" />
          </Card>
          <Card className="col-span-1">
            <CardStat label="Em Aberto" value={formatCurrency(data.totalOpenOnCards)} variant="warning" />
          </Card>
        </div>
      ) : (
        // Full summary for current/future months
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="col-span-1">
            <CardStat label="Gastos Cartão" value={formatCurrency(data.totalCreditSpending)} variant="danger" />
          </Card>
          <Card className="col-span-1">
            <CardStat label="Pago Cartões" value={formatCurrency(data.totalPaidTowardsCards)} variant="success" />
          </Card>
          <Card className="col-span-1">
            <CardStat label="Em Aberto" value={formatCurrency(data.totalOpenOnCards)} variant="warning" />
          </Card>
          <Card className="col-span-1">
            <CardStat label="Gastos Débito" value={formatCurrency(data.totalDebitSpending)} variant="danger" />
          </Card>
          <Card className="col-span-1">
            <CardStat label="Receitas" value={formatCurrency(data.totalIncome)} variant="success" />
          </Card>
          <Card className="col-span-1">
            <CardStat 
              label="Saldo Mês" 
              value={formatCurrency(data.balance)} 
              variant={Number(data.balance) >= 0 ? 'success' : 'danger'} 
            />
          </Card>
          <Card className="col-span-1">
            <CardStat 
              label="Saldo Total" 
              value={formatCurrency(data.accumulatedBalance)} 
              variant={Number(data.accumulatedBalance) >= 0 ? 'success' : 'danger'} 
            />
          </Card>
        </div>
      )}

      {/* Cards Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cartões de Crédito</h2>
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
              <p className="text-gray-500 dark:text-gray-400 mb-4">Nenhum cartão cadastrado</p>
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
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{card.name}</h3>
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
                      <p className="text-gray-500 dark:text-gray-400">Fatura</p>
                      <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(card.statementTotal)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Pago</p>
                      <p className="font-medium text-green-600 dark:text-green-400">{formatCurrency(card.paidTotal)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Aberto</p>
                      <p className="font-medium text-yellow-600 dark:text-yellow-400">{formatCurrency(card.openTotal)}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                    Vencimento: {formatDateDisplay(card.dueDate)}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Loans Section (only if enabled) */}
      {data.loansEnabled && data.loansSummary && data.loansSummary.length > 0 && (
        <Card 
          title="Empréstimos Pendentes" 
          subtitle={`${data.loansSummary.length} pessoa(s) devendo`}
        >
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Emprestado</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(data.totalLoaned || '0')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Já Recebido</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(data.totalLoansPaid || '0')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">A Receber Este Mês</p>
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrency(data.totalLoansThisMonth || '0')}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Total: {formatCurrency(data.totalLoansOwed || '0')}</p>
              </div>
            </div>

            {/* Borrowers List with Card Details */}
            <div className="space-y-3">
              {data.loansSummary.map((borrower) => (
                <div 
                  key={borrower.borrowerName} 
                  className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 flex items-center justify-center font-bold">
                        {borrower.borrowerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{borrower.borrowerName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {borrower.loanCount} empréstimo(s) • Total a receber: {formatCurrency(borrower.totalOwed)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {Number(borrower.monthAmount) > 0 ? (
                          <>
                            <p className="font-bold text-orange-600 dark:text-orange-400">
                              {formatCurrency(borrower.monthAmount)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">neste mês</p>
                          </>
                        ) : (
                          <p className="text-sm text-gray-400 dark:text-gray-500">
                            Sem parcela este mês
                          </p>
                        )}
                      </div>
                      {/* Botão de download individual */}
                      <ExportLoansButton month={month} borrowerName={borrower.borrowerName} />
                    </div>
                  </div>
                  
                  {/* Card Details */}
                  {borrower.cardDetails && borrower.cardDetails.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                      {borrower.cardDetails.map((detail, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between text-sm bg-white dark:bg-gray-700/50 p-2 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                              {detail.cardName}
                            </span>
                            <span className="text-gray-600 dark:text-gray-300 truncate max-w-[150px]">
                              {detail.loanDescription || 'Empréstimo'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-500 dark:text-gray-400">
                              Parcela {detail.currentInstallment}/{detail.totalInstallments}
                            </span>
                            <span className="font-medium text-orange-600 dark:text-orange-400">
                              {formatCurrency(detail.monthAmount)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Recent Activity - Only for current/future months */}
      {!isPastMonth && (
        <Card title="Atividade Recente" subtitle="Últimas 10 transações">
          <ActivityList activities={data.recentActivity} />
        </Card>
      )}

      {/* Month Spreadsheet - Only for current/future months */}
      {!isPastMonth && (
        <MonthSpreadsheet month={month} />
      )}

      {/* Past month notice */}
      {isPastMonth && (
        <Card>
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium">Mês passado</p>
            <p className="text-sm mt-1">Apenas gastos de cartão são exibidos para meses anteriores.</p>
          </div>
        </Card>
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2" />
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}
