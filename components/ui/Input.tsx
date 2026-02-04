import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`
            block w-full rounded-xl border border-stone-200 dark:border-neutral-700 px-4 py-2.5 
            text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500
            bg-white dark:bg-neutral-800
            focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20
            disabled:bg-stone-50 dark:disabled:bg-neutral-900 disabled:cursor-not-allowed
            transition-all
            ${error ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
