'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import MonthSelector from '@/components/MonthSelector'
import Card, { CardStat } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Select from '@/components/ui/Select'
import RecurringPanel from '@/components/RecurringPanel'
import { INCOME_CATEGORIES } from '@/lib/categories'
import { 
  getIncomeTransactions, 
  createIncomeTransaction,
  updateIncomeTransaction,
  deleteIncomeTransaction,
  getIncomeTotal,
  IncomeTransactionData 
} from '@/lib/actions/income'
import { getCurrentSession } from '@/lib/actions/auth'
import { formatCurrency, formatDateDisplay, formatStatementMonth } from '@/lib/utils'

function IncomeContent({ isAdmin }: { isAdmin: boolean }) {
  const searchParams = useSearchParams()
  const now = new Date()
  const currentMonth = searchParams.get('month') || formatStatementMonth(now)

  const [transactions, setTransactions] = useState<IncomeTransactionData[]>([])
  const [total, setTotal] = useState('0')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<IncomeTransactionData | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<IncomeTransactionData | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    try {
      const [transactionsData, totalData] = await Promise.all([
        getIncomeTransactions(currentMonth),
        getIncomeTotal(currentMonth),
      ])
      setTransactions(transactionsData)
      setTotal(totalData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadData()
  }, [currentMonth])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      description: formData.get('description') as string,
      amount: formData.get('amount') as string,
      date: formData.get('date') as string,
      category: formData.get('category') as string,
    }

    try {
      if (editing) {
        await updateIncomeTransaction(editing.id, data)
      } else {
        await createIncomeTransaction(data)
      }
      setModalOpen(false)
      setEditing(null)
      loadData()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao registrar receita')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (transaction: IncomeTransactionData) => {
    setTransactionToDelete(transaction)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!transactionToDelete) return
    setDeleting(true)
    try {
      await deleteIncomeTransaction(transactionToDelete.id)
      setDeleteModalOpen(false)
      setTransactionToDelete(null)
      loadData()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao excluir receita')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100">Receitas</h1>
        <MonthSelector currentMonth={currentMonth} />
      </div>

      {/* Summary */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <CardStat label="Total do Mês" value={formatCurrency(total)} variant="success" />
          <Button onClick={() => { setEditing(null); setFormError(null); setModalOpen(true) }}>
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Receita
          </Button>
        </div>
      </Card>

      {/* Transactions List */}
      <Card title="Receitas" subtitle={`${transactions.length} registros`}>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 dark:text-neutral-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-stone-800 dark:text-stone-100 mb-2">Nenhuma receita</h3>
            <p className="text-stone-500 dark:text-stone-400 mb-4">Adicione sua primeira receita do mês.</p>
            <Button onClick={() => setModalOpen(true)}>Adicionar Receita</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <div 
                key={transaction.id} 
                className="flex items-center justify-between gap-3 p-4 bg-stone-50 dark:bg-neutral-900 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-stone-800 dark:text-stone-100">{transaction.description}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">{transaction.category} · {formatDateDisplay(transaction.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-green-600 dark:text-green-400 tabular-nums">
                    +{formatCurrency(transaction.amount)}
                  </span>
                  <button
                    onClick={() => { setEditing(transaction); setFormError(null); setModalOpen(true) }}
                    className="p-1.5 hover:bg-stone-200 dark:hover:bg-neutral-700 rounded-md text-stone-500 dark:text-stone-300"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(transaction)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md"
                    title="Excluir"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar receita' : 'Nova Receita'}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditing(null) }}>
              Cancelar
            </Button>
            <Button type="submit" form="income-form" loading={submitting}>
              {editing ? 'Salvar' : 'Registrar'}
            </Button>
          </>
        }
      >
        <form id="income-form" key={editing?.id || 'new'} onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="description"
            name="description"
            label="Descrição"
            placeholder="Ex: Salário, Freelance..."
            defaultValue={editing?.description || ''}
            required
          />

          <Select
            id="category"
            name="category"
            label="Categoria"
            defaultValue={editing?.category || 'Outros'}
            options={INCOME_CATEGORIES.map(category => ({ value: category, label: category }))}
          />

          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            label="Valor"
            placeholder="0.00"
            defaultValue={editing?.amount || ''}
            required
          />

          <Input
            id="date"
            name="date"
            type="date"
            label="Data"
            defaultValue={editing ? new Date(editing.date).toISOString().slice(0, 10) : new Date().toISOString().split('T')[0]}
            required
          />

          {formError && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
              {formError}
            </div>
          )}
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setTransactionToDelete(null)
        }}
        onConfirm={confirmDelete}
        title="Excluir Receita"
        message={transactionToDelete 
          ? `Tem certeza que deseja excluir "${transactionToDelete.description}"?`
          : ''
        }
        confirmText="Excluir"
        variant="danger"
        loading={deleting}
      />
      <RecurringPanel kind="income" categories={INCOME_CATEGORIES} />
    </>
  )
}

export default function IncomePage() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    getCurrentSession().then(session => setIsAdmin(session?.isAdmin ?? false))
  }, [])

  return (
    <div className="min-h-screen">
      <Navbar isAdmin={isAdmin} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Suspense fallback={
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-neutral-800 rounded w-48" />
            <div className="h-24 bg-gray-200 dark:bg-neutral-800 rounded" />
            <div className="h-64 bg-gray-200 dark:bg-neutral-800 rounded" />
          </div>
        }>
          <IncomeContent isAdmin={isAdmin} />
        </Suspense>
      </main>
    </div>
  )
}
