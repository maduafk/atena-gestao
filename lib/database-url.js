function unwrapDatabaseUrl(value) {
  if (!value) return undefined
  const trimmed = String(value).trim()
  const single = trimmed.match(/^psql\s+'([^']+)'\s*$/)
  if (single) return single[1]
  const double = trimmed.match(/^psql\s+"([^"]+)"\s*$/)
  if (double) return double[1]
  return trimmed
}

function directDatabaseUrl(value) {
  const url = unwrapDatabaseUrl(value)
  if (!url) return url

  const match = url.match(/^(postgres(?:ql)?:\/\/)([^@/]*@)?([^/?]+)(.*)$/i)
  if (!match) return url

  const host = match[3].replace(/-pooler(?=\.)/i, '')
  let rest = match[4] || ''
  rest = rest.replace(/([?&])channel_binding=[^&]*/g, '$1')
  rest = rest.replace(/\?&/g, '?').replace(/&&/g, '&').replace(/[?&]$/, '')

  let next = `${match[1]}${match[2] || ''}${host}${rest}`
  if (!/[?&]connect_timeout=/.test(next)) {
    next += (next.includes('?') ? '&' : '?') + 'connect_timeout=30'
  }
  return next
}

module.exports = { unwrapDatabaseUrl, directDatabaseUrl }
