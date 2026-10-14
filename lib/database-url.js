function unwrapDatabaseUrl(value) {
  if (!value) return undefined
  const trimmed = String(value).trim()
  const single = trimmed.match(/^psql\s+'([^']+)'\s*$/)
  if (single) return single[1]
  const double = trimmed.match(/^psql\s+"([^"]+)"\s*$/)
  if (double) return double[1]
  return trimmed
}

function stripChannelBinding(url) {
  let next = url.replace(/([?&])channel_binding=[^&]*/g, '$1')
  next = next.replace(/\?&/g, '?').replace(/&&/g, '&').replace(/[?&]$/, '')
  return next
}

function runtimeDatabaseUrl(value) {
  const url = unwrapDatabaseUrl(value)
  if (!url) return url
  return stripChannelBinding(url)
}

function directDatabaseUrl(value) {
  const url = unwrapDatabaseUrl(value)
  if (!url) return url

  const match = url.match(/^(postgres(?:ql)?:\/\/)([^@/]*@)?([^/?]+)(.*)$/i)
  if (!match) return stripChannelBinding(url)

  const host = match[3].replace(/-pooler(?=\.)/i, '')
  const rest = stripChannelBinding(match[4] || '')
  return `${match[1]}${match[2] || ''}${host}${rest}`
}

module.exports = { unwrapDatabaseUrl, runtimeDatabaseUrl, directDatabaseUrl }
