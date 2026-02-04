'use client'

import { ReactNode, useEffect, useRef } from 'react'
import Button from './Button'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export default function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-scale-in border border-stone-200/50 dark:border-neutral-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-neutral-800">
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-stone-100 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-950 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
