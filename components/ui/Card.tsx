import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  title?: string
  subtitle?: string
  action?: ReactNode
  accentColor?: string
}

export default function Card({ children, className = '', title, subtitle, action, accentColor }: CardProps) {
  return (
    <div className={`bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-2xl shadow-soft border border-stone-200/40 dark:border-neutral-800/80 overflow-hidden ${className}`}>
      {accentColor && (
        <div className="h-1.5" style={{ backgroundColor: accentColor }} />
      )}
      {(title || subtitle || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-neutral-800">
          <div>
            {title && <h3 className="font-semibold text-stone-800 dark:text-stone-100">{title}</h3>}
            {subtitle && <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

interface CardStatProps {
  label: string
  value: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

export function CardStat({ label, value, variant = 'default' }: CardStatProps) {
  const variants = {
    default: 'text-stone-800 dark:text-stone-100',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-rose-600 dark:text-rose-400',
  }

  return (
    <div className="animate-fade-in">
      <p className="text-sm font-medium text-stone-500 dark:text-stone-400 mb-1">{label}</p>
      <p className={`text-2xl font-semibold tracking-tight tabular-nums ${variants[variant]}`}>{value}</p>
    </div>
  )
}
