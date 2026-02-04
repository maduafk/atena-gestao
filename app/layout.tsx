import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Atena - Gestão Financeira',
  description: 'Gerencie suas finanças pessoais com facilidade',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.className} bg-stone-50 dark:bg-neutral-950 transition-colors`}>
        {children}
      </body>
    </html>
  )
}
