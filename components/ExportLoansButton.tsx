'use client'

import { useState } from 'react'
import { exportLoansByBorrower } from '@/lib/actions/dashboard'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ExportLoansButtonProps {
  month: string
  borrowerName: string
}

// Função para formatar valor em reais
function formatCurrency(value: string): string {
  return `R$ ${parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ExportLoansButton({ month, borrowerName }: ExportLoansButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const data = await exportLoansByBorrower(borrowerName, month)
      
      // Criar PDF em landscape
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      // Cores do tema
      const primaryColor: [number, number, number] = [79, 70, 229] // Indigo-600
      const grayColor: [number, number, number] = [107, 114, 128]
      const darkColor: [number, number, number] = [31, 41, 55]

      // Header com fundo colorido
      doc.setFillColor(...primaryColor)
      doc.rect(0, 0, pageWidth, 35, 'F')

      // Título
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      doc.text('Relatório de Empréstimos', 15, 18)

      // Subtítulo
      doc.setFontSize(14)
      doc.setFont('helvetica', 'normal')
      doc.text(data.borrowerName.toUpperCase(), 15, 28)

      // Info no canto direito do header
      doc.setFontSize(10)
      doc.text(`Referência: ${data.statementMonth}`, pageWidth - 15, 18, { align: 'right' })
      doc.text(`Gerado em: ${data.generatedAt}`, pageWidth - 15, 25, { align: 'right' })

      // Tabela de dados
      const tableData = data.rows.map(row => [
        row.descricao,
        row.cartao,
        formatCurrency(row.valorTotal),
        formatCurrency(row.valorRestante),
        `${row.parcelaAtual}/${row.totalParcelas}`,
        row.valorParcela !== '-' ? formatCurrency(row.valorParcela) : '-',
        row.status
      ])

      autoTable(doc, {
        startY: 45,
        head: [[
          'Descrição',
          'Cartão',
          'Valor Total',
          'Valor Restante',
          'Parcela',
          'Valor Parcela',
          'Status'
        ]],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 10
        },
        bodyStyles: {
          textColor: darkColor,
          fontSize: 9,
          cellPadding: 4
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251]
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 35, halign: 'center' },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 35, halign: 'right' },
          4: { cellWidth: 25, halign: 'center' },
          5: { cellWidth: 35, halign: 'right' },
          6: { cellWidth: 30, halign: 'center' }
        },
        margin: { left: 15, right: 15 }
      })

      // Pegar posição Y após a tabela
      const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

      // Box de resumo
      const boxWidth = 100
      const boxX = pageWidth - boxWidth - 15
      
      doc.setFillColor(249, 250, 251)
      doc.setDrawColor(...primaryColor)
      doc.setLineWidth(0.5)
      doc.roundedRect(boxX, finalY, boxWidth, 45, 3, 3, 'FD')

      // Título do resumo
      doc.setFillColor(...primaryColor)
      doc.roundedRect(boxX, finalY, boxWidth, 10, 3, 3, 'F')
      doc.rect(boxX, finalY + 7, boxWidth, 3, 'F') // Cobrir cantos inferiores
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('RESUMO', boxX + boxWidth / 2, finalY + 7, { align: 'center' })

      // Valores do resumo
      doc.setTextColor(...darkColor)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      
      const resumeStartY = finalY + 18
      doc.text('Total Emprestado:', boxX + 5, resumeStartY)
      doc.setFont('helvetica', 'bold')
      doc.text(formatCurrency(data.totals.totalGeral), boxX + boxWidth - 5, resumeStartY, { align: 'right' })
      
      doc.setFont('helvetica', 'normal')
      doc.text('A Receber:', boxX + 5, resumeStartY + 10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(16, 185, 129) // Verde
      doc.text(formatCurrency(data.totals.totalRestante), boxX + boxWidth - 5, resumeStartY + 10, { align: 'right' })
      
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...darkColor)
      doc.text('Valor Este Mês:', boxX + 5, resumeStartY + 20)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...primaryColor)
      doc.text(formatCurrency(data.totals.totalMes), boxX + boxWidth - 5, resumeStartY + 20, { align: 'right' })

      // Footer
      doc.setTextColor(...grayColor)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('Atena Gestão - Sistema de Controle Financeiro', pageWidth / 2, pageHeight - 10, { align: 'center' })

      // Salvar PDF
      const fileName = `emprestimos_${borrowerName.toLowerCase().replace(/\s+/g, '_')}_${month}.pdf`
      doc.save(fileName)
      
    } catch (error) {
      console.error('Erro ao exportar:', error)
      alert('Erro ao exportar relatório')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="p-1.5 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
      title={`Baixar PDF de ${borrowerName}`}
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
  )
}
