import test from 'node:test'
import assert from 'node:assert/strict'
import Decimal from 'decimal.js'
import { getStatementMonthForPurchase, splitIntoInstallments } from './utils'

test('divide o valor em centavos e a sobra fica na primeira parcela', () => {
  const parts = splitIntoInstallments(new Decimal('100'), 3)
  assert.equal(parts[0].toFixed(2), '33.34')
  assert.equal(parts[1].toFixed(2), '33.33')
  assert.equal(parts[2].toFixed(2), '33.33')
  const sum = parts.reduce((total, part) => total.plus(part), new Decimal(0))
  assert.equal(sum.toFixed(2), '100.00')
})

test('uma parcela devolve o valor inteiro', () => {
  const parts = splitIntoInstallments(new Decimal('250.10'), 1)
  assert.equal(parts.length, 1)
  assert.equal(parts[0].toFixed(2), '250.10')
})

test('recusa quantidade de parcelas menor que 1', () => {
  assert.throws(() => splitIntoInstallments(new Decimal('10'), 0))
})

test('compra antes da véspera do fechamento entra na fatura do mês', () => {
  const month = getStatementMonthForPurchase(new Date(2026, 11, 13), 15)
  assert.equal(month.getFullYear(), 2026)
  assert.equal(month.getMonth(), 11)
})

test('compra na véspera ou no dia do fechamento entra na fatura seguinte', () => {
  const eve = getStatementMonthForPurchase(new Date(2026, 11, 14), 15)
  const closing = getStatementMonthForPurchase(new Date(2026, 11, 15), 15)
  assert.equal(eve.getFullYear(), 2027)
  assert.equal(eve.getMonth(), 0)
  assert.equal(closing.getMonth(), 0)
  assert.equal(closing.getDate(), 1)
})
