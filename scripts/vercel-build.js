const { spawnSync } = require('child_process')
const { directDatabaseUrl, unwrapDatabaseUrl } = require('../lib/database-url')

const OLD_MIGRATIONS = [
  '20260129005304_init',
  '20260129023412_add_card_loans',
  '20260129023806_add_user_settings',
  '20260129154310_add_admin_auth',
  '20260203120000_add_receivables',
]

function redact(text) {
  return String(text || '').replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://[oculto]')
}

function run(args, options = {}) {
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  return spawnSync(executable, args, {
    encoding: 'utf8',
    env: process.env,
    input: options.input,
    stdio: options.capture ? ['pipe', 'pipe', 'pipe'] : 'inherit',
    shell: process.platform === 'win32',
  })
}

function outputOf(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function finish(result, message) {
  if (result.error) {
    console.error(message)
    console.error(result.error.message)
    process.exit(1)
  }
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(redact(result.stdout))
    if (result.stderr) process.stderr.write(redact(result.stderr))
    console.error(message)
    process.exit(result.status || 1)
  }
}

function pendingMigrations(statusText) {
  const lines = statusText.split(/\r?\n/)
  const start = lines.findIndex((line) => /have not yet been applied/i.test(line))
  if (start === -1) return []

  const names = []
  for (const line of lines.slice(start + 1)) {
    const match = line.trim().match(/^-?\s*(\d{14}_[a-z0-9_]+)$/i)
    if (!match) {
      if (names.length > 0) break
      continue
    }
    names.push(match[1])
  }
  return names
}

const runtimeUrl = unwrapDatabaseUrl(process.env.DATABASE_URL)
if (!runtimeUrl || !/^postgres(ql)?:\/\//i.test(runtimeUrl)) {
  console.error('DATABASE_URL não é uma URL de Postgres. O banco não foi alterado.')
  process.exit(1)
}

process.env.DATABASE_URL = runtimeUrl
finish(run(['prisma', 'generate']), 'prisma generate falhou. O banco não foi alterado.')

process.env.DATABASE_URL = directDatabaseUrl(runtimeUrl)
let statusText = ''
for (let attempt = 1; attempt <= 5; attempt += 1) {
  const status = run(['prisma', 'migrate', 'status'], { capture: true })
  statusText = outputOf(status)
  console.log(redact(statusText))
  if (!/P1001|Can't reach database server/i.test(statusText)) break
  if (attempt === 5) {
    console.error('Não conectei no banco para migrar. Nada foi alterado.')
    process.exit(1)
  }
  console.log(`O banco não respondeu. Nova tentativa ${attempt + 1} de 5.`)
  sleep(5000)
}

if (/P1012|P1000|Authentication failed/i.test(statusText)) {
  console.error('Não conectei no banco para migrar. Nada foi alterado.')
  process.exit(1)
}

if (/P3009|failed migrations/i.test(statusText)) {
  console.error('Existe uma migration marcada como falha. Parei sem apagar dados.')
  process.exit(1)
}

const pending = pendingMigrations(statusText)
const oldPending = OLD_MIGRATIONS.filter((name) => pending.includes(name))
const schemaAlreadyExists = /P3005|database schema is not empty|not managed by Prisma Migrate/i.test(
  statusText
)
const toResolve = oldPending.length > 0 ? oldPending : schemaAlreadyExists ? OLD_MIGRATIONS : []

if (toResolve.length > 0) {
  const check = run(['prisma', 'db', 'execute', '--stdin'], {
    capture: true,
    input: 'SELECT 1 FROM "users" LIMIT 1;',
  })
  const checkText = outputOf(check)

  if (/P1001|P1012|Can't reach database server/i.test(checkText)) {
    console.error('Não conectei no banco para conferir os dados. Nada foi alterado.')
    process.exit(1)
  }

  const usersExist = check.status === 0
  const usersMissing = /does not exist|42P01/i.test(checkText)

  if (!usersExist && !usersMissing) {
    console.error(redact(checkText))
    console.error('Não deu para saber se o banco já tem dados. Nada foi alterado.')
    process.exit(1)
  }

  if (usersExist) {
    console.log('O banco já tem os dados. Vou registrar as migrations antigas sem recriar tabelas.')
    for (const name of toResolve) {
      finish(
        run(['prisma', 'migrate', 'resolve', '--applied', name]),
        `Não consegui registrar a migration ${name}. Os dados foram mantidos.`
      )
    }
  }
}

finish(
  run(['prisma', 'migrate', 'deploy']),
  'A migration não foi aplicada. Os dados existentes foram mantidos.'
)

process.env.DATABASE_URL = runtimeUrl
finish(run(['next', 'build']), 'O next build falhou depois da migration.')
