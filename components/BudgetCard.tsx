'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { saveMonthlyBudget } from '@/lib/actions/budget'
import { formatCurrency } from '@/lib/utils'

interface BudgetCardProps {
  month: string
  budget: string | null
  spent: number
}

export default function BudgetCard({ month, budget, spent }: BudgetCardProps) {
  const router = useRouter()
  const [amount, setAmount] = useState(budget || '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const cap = Number(budget || 0)
  const ratio = cap > 0 ? Math.min(spent / cap, 1) : 0

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveMonthlyBudget(month, amount)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o teto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Teto do mês" subtitle="Cartão mais débito">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <label className="flex-1 text-sm text-stone-600 dark:text-stone-300">
          Valor
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-stone-200 dark:border-neutral-700 px-4 py-2.5 bg-white dark:bg-neutral-800 text-stone-800 dark:text-stone-100"
          />
        </label>
        <Button onClick={save} loading={saving}>Salvar teto</Button>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {cap > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-stone-500 dark:text-stone-400 mb-2">
            <span className="tabular-nums">Gasto {formatCurrency(spent.toString())}</span>
            <span className="tabular-nums">Teto {formatCurrency(cap.toString())}</span>
          </div>
          <div className="h-2 rounded-full bg-stone-100 dark:bg-neutral-800 overflow-hidden">
            <div
              className={`h-full ${spent > cap ? 'bg-rose-500' : 'bg-primary-500'}`}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  )
}
