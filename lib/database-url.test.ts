import test from 'node:test'
import assert from 'node:assert/strict'
import { directDatabaseUrl, runtimeDatabaseUrl, unwrapDatabaseUrl } from './database-url'

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
  assert.match(direct, /sslmode=require/)
  assert.match(direct, /user:secret@/)
})

test('o aplicativo continua no pooler e sem channel_binding', () => {
  const pooled =
    "psql 'postgresql://user:secret@ep-nome-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'"
  const runtime = runtimeDatabaseUrl(pooled)
  assert.ok(runtime)
  assert.match(runtime, /-pooler\./)
  assert.doesNotMatch(runtime, /channel_binding/)
  assert.match(runtime, /sslmode=require/)
})
