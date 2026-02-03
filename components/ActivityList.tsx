import { ActivityItem } from '@/lib/actions/dashboard'
import { formatCurrency, formatDateDisplay } from '@/lib/utils'

interface ActivityListProps {
  activities: ActivityItem[]
}

export default function ActivityList({ activities }: ActivityListProps) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nenhuma atividade recente
      </div>
    )
  }

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'purchase':
        return { icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z', color: 'text-blue-600 bg-blue-100' }
      case 'payment':
        return { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-green-600 bg-green-100' }
      case 'debit':
        return { icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z', color: 'text-orange-600 bg-orange-100' }
      case 'income':
        return { icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1', color: 'text-emerald-600 bg-emerald-100' }
    }
  }

  const getTypeLabel = (type: ActivityItem['type']) => {
    switch (type) {
      case 'purchase': return 'Compra'
      case 'payment': return 'Pagamento'
      case 'debit': return 'Débito'
      case 'income': return 'Receita'
    }
  }

  return (
    <div className="divide-y divide-gray-100">
      {activities.map((activity) => {
        const { icon, color } = getActivityIcon(activity.type)
        const isNegative = activity.type !== 'income' && activity.type !== 'payment'
        
        return (
          <div key={`${activity.type}-${activity.id}`} className="flex items-center gap-3 py-3">
            <div className={`p-2 rounded-lg ${color}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {activity.description}
              </p>
              <p className="text-xs text-gray-500">
                {getTypeLabel(activity.type)}
                {activity.cardName && ` • ${activity.cardName}`}
                {' • '}
                {formatDateDisplay(activity.date)}
              </p>
            </div>
            <p className={`text-sm font-medium ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
              {isNegative ? '-' : '+'}{formatCurrency(activity.amount)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
