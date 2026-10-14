import { SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string | number; label: string }[]
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, id, options, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={`
            block w-full rounded-xl border border-stone-200 dark:border-neutral-700 px-3 py-2 
            text-stone-800 dark:text-stone-100 bg-white dark:bg-neutral-800
            focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500
            disabled:bg-gray-100 dark:disabled:bg-neutral-900 disabled:cursor-not-allowed
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
