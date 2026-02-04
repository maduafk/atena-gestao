'use server'

import { prisma } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { Decimal } from '@prisma/client/runtime/library'

export interface CardData {
  id: string
  name: string
  creditLimit: string
  closingDay: number
  dueDay: number
  color: string
  createdAt: Date
}

export async function getCards(): Promise<CardData[]> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const cards = await prisma.card.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  })

  return cards.map(card => ({
    ...card,
    creditLimit: card.creditLimit.toString(),
  }))
}

export async function getCard(id: string): Promise<CardData | null> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const card = await prisma.card.findFirst({
    where: { id, userId: session.userId },
  })

  if (!card) return null

  return {
    ...card,
    creditLimit: card.creditLimit.toString(),
  }
}

export interface CreateCardInput {
  name: string
  creditLimit: string
  closingDay: number
  dueDay: number
  color?: string
}

export async function createCard(data: CreateCardInput) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  if (!data.name || !data.creditLimit) {
    throw new Error('Nome e limite são obrigatórios')
  }

  if (data.closingDay < 1 || data.closingDay > 28) {
    throw new Error('Dia de fechamento deve ser entre 1 e 28')
  }

  if (data.dueDay < 1 || data.dueDay > 28) {
    throw new Error('Dia de vencimento deve ser entre 1 e 28')
  }

  const card = await prisma.card.create({
    data: {
      userId: session.userId,
      name: data.name,
      creditLimit: new Decimal(data.creditLimit),
      closingDay: data.closingDay,
      dueDay: data.dueDay,
      color: data.color || '#3d8585',
    },
  })

  revalidatePath('/cards')
  return card
}

export async function updateCard(id: string, data: CreateCardInput) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const card = await prisma.card.findFirst({
    where: { id, userId: session.userId },
  })

  if (!card) throw new Error('Cartão não encontrado')

  await prisma.card.update({
    where: { id },
    data: {
      name: data.name,
      creditLimit: new Decimal(data.creditLimit),
      closingDay: data.closingDay,
      dueDay: data.dueDay,
      color: data.color || '#3d8585',
    },
  })

  revalidatePath('/cards')
  revalidatePath(`/cards/${id}`)
}

export async function deleteCard(id: string) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const card = await prisma.card.findFirst({
    where: { id, userId: session.userId },
  })

  if (!card) throw new Error('Cartão não encontrado')

  await prisma.card.delete({ where: { id } })

  revalidatePath('/cards')
}
