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
    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2 transition-colors">
      <button
        onClick={goToPreviousMonth}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        aria-label="Mês anterior"
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      <button
        onClick={goToCurrentMonth}
        className="px-3 py-1 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors min-w-[140px]"
      >
        {formatMonthDisplay(currentDate)}
      </button>
      
      <button
        onClick={goToNextMonth}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        aria-label="Próximo mês"
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
