'use client'

import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { getMonthDetailData, MonthDetailData } from '@/lib/actions/dashboard'
import { formatCurrency } from '@/lib/utils'

interface MonthSpreadsheetProps {
  month: string
}

export default function MonthSpreadsheet({ month }: MonthSpreadsheetProps) {
  const [data, setData] = useState<MonthDetailData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const result = await getMonthDetailData(month)
        setData(result)
      } catch (error) {
        console.error('Error loading spreadsheet data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [month])

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}`
  }

  const downloadExcel = () => {
    if (!data) return

    // Calculate totals
    const totalEntradas = data.summary.totalIncome + data.summary.totalPayments
    const totalSaidas = data.summary.totalDebit + data.summary.totalCredit

    // Prepare data rows with separate columns for entrada/saída
    const rows = data.rows.map(row => ({
      'Data': formatDate(row.date),
      'Descrição': row.description,
      'Categoria': row.category,
      'Entrada': row.amount > 0 ? row.amount : '',
      'Saída': row.amount < 0 ? Math.abs(row.amount) : '',
    }))

    // Add empty rows and summary
    const summaryRows = [
      {},
      { 'Data': '', 'Descrição': 'RESUMO DO MÊS', 'Categoria': '', 'Entrada': '', 'Saída': '' },
      { 'Data': '', 'Descrição': 'Total Entradas', 'Categoria': '', 'Entrada': totalEntradas, 'Saída': '' },
      { 'Data': '', 'Descrição': 'Total Saídas', 'Categoria': '', 'Entrada': '', 'Saída': totalSaidas },
      {},
      { 'Data': '', 'Descrição': 'Saldo Este Mês', 'Categoria': '', 'Entrada': data.summary.balance >= 0 ? data.summary.balance : '', 'Saída': data.summary.balance < 0 ? Math.abs(data.summary.balance) : '' },
      { 'Data': '', 'Descrição': 'Saldo Meses Anteriores', 'Categoria': '', 'Entrada': data.summary.previousBalance >= 0 ? data.summary.previousBalance : '', 'Saída': data.summary.previousBalance < 0 ? Math.abs(data.summary.previousBalance) : '' },
      { 'Data': '', 'Descrição': 'SALDO TOTAL', 'Categoria': '', 'Entrada': data.summary.accumulatedBalance >= 0 ? data.summary.accumulatedBalance : '', 'Saída': data.summary.accumulatedBalance < 0 ? Math.abs(data.summary.accumulatedBalance) : '' },
    ]

    const allData = [...rows, ...summaryRows]

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(allData)
    const workbook = XLSX.utils.book_new()
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 10 },  // Data
      { wch: 45 },  // Descrição
      { wch: 15 },  // Categoria
      { wch: 15 },  // Entrada
      { wch: 15 },  // Saída
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Extrato')

    // Generate and download
    XLSX.writeFile(workbook, `extrato-${month}.xlsx`)
  }

  const downloadPDF = () => {
    if (!data) return

    // Calculate totals
    const totalEntradas = data.summary.totalIncome + data.summary.totalPayments
    const totalSaidas = data.summary.totalDebit + data.summary.totalCredit

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

    // Formatação do mês
    const [ano, mes] = month.split('-')
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    const mesFormatado = `${meses[parseInt(mes) - 1]} de ${ano}`

    // Título simples
    doc.setTextColor(...darkGray)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('Extrato Financeiro', 15, 20)

    // Linha separadora
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.line(15, 25, pageWidth - 15, 25)

    // Subtítulo
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mediumGray)
    doc.text(mesFormatado, 15, 33)
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 15, 33, { align: 'right' })

    // Resumo em linha simples
    doc.setFontSize(10)
    doc.setTextColor(...darkGray)
    const resumoY = 45
    
    doc.setFont('helvetica', 'normal')
    doc.text('Entradas:', 15, resumoY)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(34, 139, 34)
    doc.text(`+ ${formatCurrency(totalEntradas.toString())}`, 40, resumoY)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...darkGray)
    doc.text('Saídas:', 85, resumoY)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(178, 34, 34)
    doc.text(`- ${formatCurrency(totalSaidas.toString())}`, 105, resumoY)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...darkGray)
    doc.text('Saldo Total:', 155, resumoY)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(data.summary.accumulatedBalance >= 0 ? 34 : 178, data.summary.accumulatedBalance >= 0 ? 139 : 34, data.summary.accumulatedBalance >= 0 ? 34 : 34)
    doc.text(`${data.summary.accumulatedBalance >= 0 ? '+' : '-'} ${formatCurrency(Math.abs(data.summary.accumulatedBalance).toString())}`, 185, resumoY)

    // Tabela de transações - estilo clean
    const tableData = data.rows.map(row => [
      formatDate(row.date),
      row.description,
      row.category,
      row.amount > 0 ? formatCurrency(row.amount.toString()) : '',
      row.amount < 0 ? formatCurrency(Math.abs(row.amount).toString()) : ''
    ])

    autoTable(doc, {
      startY: 55,
      head: [['Data', 'Descrição', 'Categoria', 'Entrada', 'Saída']],
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
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 110 },
        2: { cellWidth: 35, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: 15, right: 15 },
      didParseCell: function(data) {
        if (data.section === 'body') {
          if (data.column.index === 3 && data.cell.raw) {
            data.cell.styles.textColor = [34, 139, 34]
          }
          if (data.column.index === 4 && data.cell.raw) {
            data.cell.styles.textColor = [178, 34, 34]
          }
        }
      }
    })

    // Footer discreto
    doc.setTextColor(...mediumGray)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Atena Gestão', pageWidth / 2, pageHeight - 10, { align: 'center' })

    doc.save(`extrato-${month}.pdf`)
  }

  if (loading) {
    return (
      <Card>
        <div className="animate-pulse space-y-3">
          <div className="flex justify-between items-center mb-4">
            <div className="h-6 bg-gray-200 rounded w-48" />
            <div className="h-9 bg-gray-200 rounded w-32" />
          </div>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded" />
          ))}
        </div>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <div className="text-center py-8 text-gray-500">
          Erro ao carregar dados
        </div>
      </Card>
    )
  }

  // Calculate totals for entrada/saída view
  const totalEntradas = data.summary.totalIncome + data.summary.totalPayments
  const totalSaidas = data.summary.totalDebit + data.summary.totalCredit

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Extrato do Mês</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{data.rows.length} transações</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={downloadExcel}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Excel
          </Button>
          <Button variant="primary" onClick={downloadPDF}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PDF
          </Button>
        </div>
      </div>

      {/* Visual Summary - Entradas vs Saídas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Entradas */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            </div>
            <span className="font-medium text-green-800">Entradas</span>
          </div>
          <p className="text-2xl font-bold text-green-600 mb-2">
            +{formatCurrency(totalEntradas.toString())}
          </p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-green-700">
              <span>Receitas</span>
              <span>+{formatCurrency(data.summary.totalIncome.toString())}</span>
            </div>
            {data.summary.totalPayments > 0 && (
              <div className="flex justify-between text-green-600 opacity-75">
                <span>Pagto. Cartão</span>
                <span>+{formatCurrency(data.summary.totalPayments.toString())}</span>
              </div>
            )}
          </div>
        </div>

        {/* Saídas */}
        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4 border border-red-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            </div>
            <span className="font-medium text-red-800">Saídas</span>
          </div>
          <p className="text-2xl font-bold text-red-600 mb-2">
            -{formatCurrency(totalSaidas.toString())}
          </p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-red-700">
              <span>Cartão de Crédito</span>
              <span>-{formatCurrency(data.summary.totalCredit.toString())}</span>
            </div>
            <div className="flex justify-between text-orange-600">
              <span>Débito</span>
              <span>-{formatCurrency(data.summary.totalDebit.toString())}</span>
            </div>
          </div>
        </div>

        {/* Saldo */}
        <div className={`rounded-xl p-4 border ${
          data.summary.accumulatedBalance >= 0 
            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100' 
            : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`p-2 rounded-lg ${data.summary.accumulatedBalance >= 0 ? 'bg-blue-100' : 'bg-gray-200'}`}>
              <svg className={`w-5 h-5 ${data.summary.accumulatedBalance >= 0 ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span className={`font-medium ${data.summary.accumulatedBalance >= 0 ? 'text-blue-800' : 'text-gray-700'}`}>Saldo</span>
          </div>
          <p className={`text-2xl font-bold mb-2 ${data.summary.accumulatedBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {data.summary.accumulatedBalance >= 0 ? '+' : ''}{formatCurrency(data.summary.accumulatedBalance.toString())}
          </p>
          <div className="space-y-1 text-sm">
            {data.summary.previousBalance !== 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Meses anteriores</span>
                <span className={data.summary.previousBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {data.summary.previousBalance >= 0 ? '+' : ''}{formatCurrency(data.summary.previousBalance.toString())}
                </span>
              </div>
            )}
            <div className="flex justify-between text-gray-500">
              <span>Este mês</span>
              <span className={data.summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                {data.summary.balance >= 0 ? '+' : ''}{formatCurrency(data.summary.balance.toString())}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Flow Bar - Visual representation */}
      {(totalEntradas > 0 || totalSaidas > 0) && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700">Fluxo do Mês</span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
            <div 
              className="bg-gradient-to-r from-green-400 to-green-500 h-full transition-all duration-500"
              style={{ width: `${(totalEntradas / (totalEntradas + totalSaidas)) * 100}%` }}
            />
            <div 
              className="bg-gradient-to-r from-red-400 to-red-500 h-full transition-all duration-500"
              style={{ width: `${(totalSaidas / (totalEntradas + totalSaidas)) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>Entradas: {((totalEntradas / (totalEntradas + totalSaidas)) * 100).toFixed(0)}%</span>
            <span>Saídas: {((totalSaidas / (totalEntradas + totalSaidas)) * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Table */}
      {data.rows.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>Nenhuma transação neste mês</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-2 font-semibold text-gray-700">Data</th>
                <th className="text-left py-3 px-2 font-semibold text-gray-700">Descrição</th>
                <th className="text-left py-3 px-2 font-semibold text-gray-700">Categoria</th>
                <th className="text-right py-3 px-2 font-semibold text-green-700 bg-green-50 rounded-tl-lg">
                  <div className="flex items-center justify-end gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                    Entrada
                  </div>
                </th>
                <th className="text-right py-3 px-2 font-semibold text-red-700 bg-red-50 rounded-tr-lg">
                  <div className="flex items-center justify-end gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                    </svg>
                    Saída
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, index) => (
                <tr key={index} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-2 text-gray-600 font-medium">
                    {formatDate(row.date)}
                  </td>
                  <td className="py-3 px-2 text-gray-900">
                    <div className="max-w-xs">
                      <p className="truncate">{row.description}</p>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      row.type === 'Receita' ? 'bg-green-100 text-green-700' :
                      row.type === 'Débito' ? 'bg-orange-100 text-orange-700' :
                      row.type === 'Cartão de Crédito' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {row.category}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right bg-green-50/50">
                    {row.amount > 0 && (
                      <span className="font-semibold text-green-600">
                        +{formatCurrency(row.amount.toString())}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right bg-red-50/50">
                    {row.amount < 0 && (
                      <span className="font-semibold text-red-600">
                        {formatCurrency(row.amount.toString())}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td colSpan={3} className="py-3 px-2 text-gray-700">
                  TOTAL
                </td>
                <td className="py-3 px-2 text-right text-green-600 bg-green-100/50">
                  +{formatCurrency(totalEntradas.toString())}
                </td>
                <td className="py-3 px-2 text-right text-red-600 bg-red-100/50">
                  -{formatCurrency(totalSaidas.toString())}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  )
}
