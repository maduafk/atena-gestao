import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
})

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
      <body className={`${jakarta.className} app-shell`}>
        {children}
      </body>
    </html>
  )
}
