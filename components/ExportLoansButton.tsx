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
      
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      // Cores simples
      const darkGray: [number, number, number] = [51, 51, 51]
      const mediumGray: [number, number, number] = [128, 128, 128]

      // Título simples
      doc.setTextColor(...darkGray)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('Relatório Financeiro', 15, 20)

      // Linha separadora
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(15, 25, pageWidth - 15, 25)

      // Info
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...mediumGray)
      doc.text(data.borrowerName, 15, 33)
      doc.setFontSize(10)
      doc.text(`Referência: ${data.statementMonth}  •  Gerado em ${data.generatedAt}`, pageWidth - 15, 33, { align: 'right' })

      let currentY = 42

      // === SEÇÃO DE EMPRÉSTIMOS ===
      if (data.rows.length > 0) {
        // Subtítulo empréstimos
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...darkGray)
        doc.text('Empréstimos (Cartão)', 15, currentY)
        currentY += 8

        // Tabela de empréstimos
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
          startY: currentY,
          head: [[
            'Descrição',
            'Cartão',
            'Valor Total',
            'A Receber',
            'Parcela',
            'Valor Parcela',
            'Status'
          ]],
          body: tableData,
          theme: 'plain',
          headStyles: {
            fillColor: [255, 255, 255],
            textColor: darkGray,
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 4,
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
          },
          bodyStyles: {
            textColor: [80, 80, 80],
            fontSize: 9,
            cellPadding: 3,
            lineWidth: 0.1,
            lineColor: [230, 230, 230]
          },
          columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 35, halign: 'center' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 22, halign: 'center' },
            5: { cellWidth: 30, halign: 'right' },
            6: { cellWidth: 25, halign: 'center' }
          },
          margin: { left: 15, right: 15 }
        })

        currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

        // Subtotal empréstimos
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...mediumGray)
        doc.text(`Empréstimos: ${formatCurrency(data.totals.totalRestante)} a receber  •  Este mês: ${formatCurrency(data.totals.totalMes)}`, 15, currentY)
        currentY += 15
      }

      // === SEÇÃO DE OUTROS A RECEBER ===
      if (data.receivables.rows.length > 0) {
        // Verificar se precisa de nova página
        if (currentY > pageHeight - 60) {
          doc.addPage()
          currentY = 20
        }

        // Subtítulo outros a receber
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...darkGray)
        doc.text('Outros A Receber', 15, currentY)
        currentY += 8

        // Tabela de receivables
        const receivableTableData = data.receivables.rows.map(row => [
          row.descricao,
          row.categoria,
          formatCurrency(row.valorTotal),
          formatCurrency(row.valorPago),
          formatCurrency(row.valorRestante),
          row.dataVencimento,
          row.status
        ])

        autoTable(doc, {
          startY: currentY,
          head: [[
            'Descrição',
            'Categoria',
            'Valor Total',
            'Pago',
            'A Receber',
            'Vencimento',
            'Status'
          ]],
          body: receivableTableData,
          theme: 'plain',
          headStyles: {
            fillColor: [255, 255, 255],
            textColor: darkGray,
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 4,
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
          },
          bodyStyles: {
            textColor: [80, 80, 80],
            fontSize: 9,
            cellPadding: 3,
            lineWidth: 0.1,
            lineColor: [230, 230, 230]
          },
          columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 35, halign: 'center' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 30, halign: 'right' },
            5: { cellWidth: 28, halign: 'center' },
            6: { cellWidth: 25, halign: 'center' }
          },
          margin: { left: 15, right: 15 }
        })

        currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

        // Subtotal outros a receber
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...mediumGray)
        doc.text(`Outros a receber: ${formatCurrency(data.receivables.totalPendente)}`, 15, currentY)
        currentY += 15
      }

      // === RESUMO TOTAL ===
      // Calcular total geral
      const totalEmprestimos = parseFloat(data.totals.totalRestante) || 0
      const totalOutros = parseFloat(data.receivables.totalPendente) || 0
      const totalGeral = totalEmprestimos + totalOutros
      const totalEsteMes = parseFloat(data.totals.totalMes) || 0

      // Verificar se precisa de nova página
      if (currentY > pageHeight - 30) {
        doc.addPage()
        currentY = 20
      }

      // Linha separadora antes do total
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.line(15, currentY, pageWidth - 15, currentY)
      currentY += 8

      // Total geral e Este Mês lado a lado
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...darkGray)
      doc.text('TOTAL A RECEBER:', 15, currentY)
      doc.setTextColor(34, 139, 34)
      doc.text(formatCurrency(totalGeral.toFixed(2)), 70, currentY)

      // Este mês destacado
      doc.setTextColor(...darkGray)
      doc.text('ESTE MÊS:', 130, currentY)
      doc.setTextColor(255, 140, 0) // Laranja
      doc.text(formatCurrency(totalEsteMes.toFixed(2)), 170, currentY)

      // Footer discreto
      doc.setTextColor(...mediumGray)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('Atena Gestão', pageWidth / 2, pageHeight - 10, { align: 'center' })

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
