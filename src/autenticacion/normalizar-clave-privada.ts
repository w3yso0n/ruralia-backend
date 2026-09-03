/**
 * Docker, Coolify y paneles de env suelen entregar FIREBASE_PRIVATE_KEY
 * con comillas pegadas, \n literales, \r de Windows o el PEM en una sola línea.
 * OpenSSL 3 (Node 22) rechaza eso con ERR_OSSL_UNSUPPORTED.
 */
export function normalizarClavePrivadaFirebase(raw: string): string {
  let key = raw.trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  key = key
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  if (key.includes('-----BEGIN') && !key.includes('\n')) {
    key = key
      .replace(/-----BEGIN ([A-Z ]+)-----/, '-----BEGIN $1-----\n')
      .replace(/-----END ([A-Z ]+)-----/, '\n-----END $1-----\n');
  }

  if (!key.includes('-----BEGIN') && key.length > 80) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN')) {
        return normalizarClavePrivadaFirebase(decoded);
      }
    } catch {
      /* no era base64 de un PEM */
    }
  }

  return key.trim();
}
