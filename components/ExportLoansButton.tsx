'use client'

import { useState } from 'react'
import { exportLoansByBorrower } from '@/lib/actions/dashboard'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ExportLoansButtonProps {
  month: string
  borrowerName: string
}

function formatCurrency(value: string): string {
  return `R$ ${parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ExportLoansButton({ month, borrowerName }: ExportLoansButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await exportLoansByBorrower(borrowerName, month)

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const darkGray: [number, number, number] = [51, 51, 51]
      const mediumGray: [number, number, number] = [128, 128, 128]

      doc.setTextColor(...darkGray)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('Cobrança do mês', 15, 20)

      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(15, 25, pageWidth - 15, 25)

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...mediumGray)
      doc.text(data.borrowerName, 15, 33)
      doc.setFontSize(10)
      doc.text(`Referência: ${data.statementMonth}  •  Gerado em ${data.generatedAt}`, pageWidth - 15, 33, { align: 'right' })

      const tableData = data.rows.length > 0
        ? data.rows.map(row => [
            row.description,
            row.origin,
            row.installment,
            formatCurrency(row.amount),
            row.note,
          ])
        : [['Nada a cobrar neste mês', '-', '-', formatCurrency('0'), '-']]

      autoTable(doc, {
        startY: 42,
        head: [['Descrição', 'Origem', 'Parcela', 'Valor', 'Situação']],
        body: tableData,
        theme: 'plain',
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: darkGray,
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: 3,
          lineWidth: 0.1,
          lineColor: [200, 200, 200],
        },
        bodyStyles: {
          textColor: [80, 80, 80],
          fontSize: 9,
          cellPadding: 3,
          lineWidth: 0.1,
          lineColor: [230, 230, 230],
        },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 32 },
          2: { cellWidth: 22, halign: 'center' },
          3: { cellWidth: 32, halign: 'right' },
          4: { cellWidth: 39 },
        },
        margin: { left: 15, right: 15 },
      })

      const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...darkGray)
      doc.text('Total do mês', 15, finalY)
      doc.setTextColor(61, 133, 133)
      doc.text(formatCurrency(data.totalMes), pageWidth - 15, finalY, { align: 'right' })

      doc.setTextColor(...mediumGray)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('Atena Gestão', pageWidth / 2, pageHeight - 10, { align: 'center' })

      const fileName = `cobranca_${borrowerName.toLowerCase().replace(/\s+/g, '_')}_${month}.pdf`
      doc.save(fileName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar relatório')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={handleExport}
        disabled={loading}
        className="p-1.5 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        title={`Baixar cobrança de ${borrowerName}`}
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </button>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400 max-w-[10rem] text-right">{error}</p>}
    </div>
  )
}
