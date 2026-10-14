import test from 'node:test'
import assert from 'node:assert/strict'
import { directDatabaseUrl, unwrapDatabaseUrl } from './database-url'

const inner = 'postgresql://user:secret@ep-nome.sa-east-1.aws.neon.tech/neondb?sslmode=require'

test('aceita a URL postgres como está', () => {
  assert.equal(unwrapDatabaseUrl(inner), inner)
})

test('tira o comando psql colado em volta da URL', () => {
  assert.equal(unwrapDatabaseUrl(`psql '${inner}'`), inner)
  assert.equal(unwrapDatabaseUrl(`psql "${inner}"`), inner)
})

test('migration usa o host direto da Neon e não o pooler', () => {
  const pooled =
    'postgresql://user:secret@ep-nome-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
  const direct = directDatabaseUrl(pooled)
  assert.ok(direct)
  assert.match(direct, /@ep-nome\.sa-east-1\.aws\.neon\.tech\//)
  assert.doesNotMatch(direct, /-pooler/)
  assert.doesNotMatch(direct, /channel_binding/)
  assert.match(direct, /connect_timeout=30/)
  assert.match(direct, /sslmode=require/)
  assert.match(direct, /user:secret@/)
})
