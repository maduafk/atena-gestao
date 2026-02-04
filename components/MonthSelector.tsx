'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { formatMonthDisplay } from '@/lib/utils'

interface MonthSelectorProps {
  currentMonth: string // YYYY-MM format
}

export default function MonthSelector({ currentMonth }: MonthSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Parse YYYY-MM safely without timezone issues
  const [year, month] = currentMonth.split('-').map(Number)
  const currentDate = new Date(year, month - 1, 1)
  
  const goToMonth = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const newMonth = `${y}-${m}`
    
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', newMonth)
    router.push(`${pathname}?${params.toString()}`)
  }

  const goToPreviousMonth = () => {
    const prevMonth = new Date(year, month - 2, 1)
    goToMonth(prevMonth)
  }

  const goToNextMonth = () => {
    const nextMonth = new Date(year, month, 1)
    goToMonth(nextMonth)
  }

  const goToCurrentMonth = () => {
    const now = new Date()
    goToMonth(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  return (
    <div className="flex items-center gap-1 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg rounded-2xl border border-stone-200/50 dark:border-neutral-800/50 p-1.5 shadow-soft">
      <button
        onClick={goToPreviousMonth}
        className="p-2 hover:bg-stone-100 dark:hover:bg-neutral-800 rounded-xl transition-all active:scale-95"
        aria-label="Mês anterior"
      >
        <svg className="w-5 h-5 text-stone-500 dark:text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      <button
        onClick={goToCurrentMonth}
        className="px-4 py-2 text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-neutral-800 rounded-xl transition-all min-w-[140px]"
      >
        {formatMonthDisplay(currentDate)}
      </button>
      
      <button
        onClick={goToNextMonth}
        className="p-2 hover:bg-stone-100 dark:hover:bg-neutral-800 rounded-xl transition-all active:scale-95"
        aria-label="Próximo mês"
      >
        <svg className="w-5 h-5 text-stone-500 dark:text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
