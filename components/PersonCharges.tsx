'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MonthCharge, toggleUnpaidCharge } from '@/lib/actions/charges'
import { formatCurrency } from '@/lib/utils'

interface PersonChargesProps {
  charges: MonthCharge[]
}

export default function PersonCharges({ charges }: PersonChargesProps) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggle = async (charge: MonthCharge) => {
    setPendingId(charge.sourceId)
    setError(null)
    try {
      await toggleUnpaidCharge({
        sourceType: charge.sourceType,
        sourceId: charge.sourceId,
        statementMonth: charge.originMonth,
      })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a parcela')
    } finally {
      setPendingId(null)
    }
  }

  if (charges.length === 0) return null

  return (
    <div className="mt-3 pt-3 border-t border-stone-200 dark:border-neutral-800 space-y-2">
      {charges.map(charge => (
        <div
          key={`${charge.sourceType}:${charge.sourceId}`}
          className="flex items-center justify-between gap-3 text-sm bg-white dark:bg-neutral-800/50 p-2 rounded"
        >
          <div className="min-w-0">
            <p className="font-medium text-stone-800 dark:text-stone-100 truncate">{charge.description}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {charge.origin} · Parcela {charge.installmentLabel}
              {charge.carried ? ` · Não pago de ${charge.originLabel}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-medium text-orange-600 dark:text-orange-400 tabular-nums">
              {formatCurrency(charge.amount)}
            </span>
            <button
              type="button"
              onClick={() => toggle(charge)}
              disabled={pendingId === charge.sourceId}
              className={`text-xs px-2 py-1 rounded-lg ${
                charge.markedUnpaid
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                  : 'bg-stone-100 text-stone-600 dark:bg-neutral-700 dark:text-stone-300'
              }`}
            >
              {charge.markedUnpaid ? 'Considerar pago' : 'Não pagou'}
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  )
}
