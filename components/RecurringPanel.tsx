'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import {
  createRecurringTransaction,
  deleteRecurringTransaction,
  getRecurringTransactions,
  RecurringData,
} from '@/lib/actions/recurring'
import { formatCurrency } from '@/lib/utils'

interface RecurringPanelProps {
  kind: 'debit' | 'income'
  categories: readonly string[]
}

export default function RecurringPanel({ kind, categories }: RecurringPanelProps) {
  const router = useRouter()
  const [rows, setRows] = useState<RecurringData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      setRows(await getRecurringTransactions(kind))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar recorrências')
    }
  }

  useEffect(() => {
    load()
  }, [kind])

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const form = new FormData(e.currentTarget)
    try {
      await createRecurringTransaction({
        kind,
        description: String(form.get('description') || ''),
        amount: String(form.get('amount') || ''),
        category: String(form.get('category') || 'Outros'),
        dayOfMonth: Number(form.get('dayOfMonth') || 1),
      })
      e.currentTarget.reset()
      await load()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar recorrência')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setError(null)
    try {
      await deleteRecurringTransaction(id)
      await load()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover recorrência')
    }
  }

  return (
    <Card className="mt-6" title="Recorrentes" subtitle="Entram sozinhos quando o mês abre">
      <form onSubmit={submit} className="grid sm:grid-cols-5 gap-3 mb-4">
        <Input name="description" label="Descrição" required />
        <Input name="amount" label="Valor" type="number" step="0.01" min="0.01" required />
        <Select
          name="category"
          label="Categoria"
          options={categories.map(category => ({ value: category, label: category }))}
          defaultValue={categories[categories.length - 1]}
        />
        <Input name="dayOfMonth" label="Dia" type="number" min="1" max="28" defaultValue="1" required />
        <div className="flex items-end">
          <Button type="submit" loading={saving} className="w-full">Adicionar</Button>
        </div>
      </form>
      {error && <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{error}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">Nenhum lançamento recorrente.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div key={row.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 dark:bg-neutral-900">
              <div>
                <p className="font-medium text-stone-800 dark:text-stone-100">{row.description}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {row.category} · todo dia {row.dayOfMonth}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums font-medium text-stone-800 dark:text-stone-100">{formatCurrency(row.amount)}</span>
                <button type="button" onClick={() => remove(row.id)} className="text-xs text-rose-600 dark:text-rose-400">
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
