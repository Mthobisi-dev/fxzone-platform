const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 86_400;

/** Validates standard RFC 7065 TURN and TURNS URI forms. */
function isValidTurnUri(value) {
  const match = /^(turns?):(?:\/\/)?(.+)$/i.exec(value);
  if (!match) return false;

  const parts = match[2].split('?');
  if (parts.length > 2 || !parts[0]) return false;
  if (parts[1] && !/^transport=(udp|tcp)$/i.test(parts[1])) return false;

  const authority = parts[0];
  let port;
  if (authority.startsWith('[')) {
    const ipv6 = /^\[([0-9a-f:.]+)\](?::(\d{1,5}))?$/i.exec(authority);
    if (!ipv6 || !ipv6[1].includes(':')) return false;
    port = ipv6[2];
  } else {
    const host = /^([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::(\d{1,5}))?$/i.exec(authority);
    if (!host || host[1].includes('..')) return false;
    port = host[2];
  }

  return !port || (Number(port) >= 1 && Number(port) <= 65_535);
}

/** Returns null when a configured URI is blank or malformed. */
function parseTurnUrls(value) {
  if (!value || !value.trim()) return null;
  const urls = value.split(',').map((url) => url.trim());
  return urls.length && urls.every(isValidTurnUri) ? urls : null;
}

function credentialTtlSeconds(value) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return 3_600;
  return Math.min(Math.max(parsed, MIN_TTL_SECONDS), MAX_TTL_SECONDS);
}

module.exports = { MIN_TTL_SECONDS, MAX_TTL_SECONDS, isValidTurnUri, parseTurnUrls, credentialTtlSeconds };
