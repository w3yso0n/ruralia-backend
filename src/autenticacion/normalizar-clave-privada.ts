/**
 * Coolify/Railpack pasa env con bash: un \n real trunca FIREBASE_PRIVATE_KEY
 * en -----BEGIN PRIVATE KEY----- y OpenSSL responde ERR_OSSL_UNSUPPORTED.
 * Formato seguro: cuerpo PKCS#8 en una sola línea, sin BEGIN/END y sin \n.
 */
export function normalizarClavePrivadaFirebase(raw: string): string {
  let key = raw.trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  key = key.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  key = key.replace(/\|\|/g, '\n');
  while (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }

  if (!key.includes('-----BEGIN') && esCuerpoPkcs8(key)) {
    const comoPemCompleto = decodificarPemEnBase64(key);
    if (comoPemCompleto) {
      return normalizarClavePrivadaFirebase(comoPemCompleto);
    }
    return envolverPem('PRIVATE KEY', key);
  }

  if (key.includes('-----BEGIN') && !key.includes('\n')) {
    key = key
      .replace(/-----BEGIN ([A-Z ]+)-----/, '-----BEGIN $1-----\n')
      .replace(/-----END ([A-Z ]+)-----/, '\n-----END $1-----\n');
  }

  return key.trim();
}

export function clavePrivadaFirebaseEsValida(key: string): boolean {
  return (
    key.includes('-----BEGIN PRIVATE KEY-----') &&
    key.includes('-----END PRIVATE KEY-----') &&
    key.length > 200
  );
}

function esCuerpoPkcs8(key: string): boolean {
  const limpio = key.replace(/\s+/g, '');
  return limpio.length > 80 && /^[A-Za-z0-9+/=]+$/.test(limpio);
}

function decodificarPemEnBase64(key: string): string | null {
  try {
    const decoded = Buffer.from(key.replace(/\s+/g, ''), 'base64').toString(
      'utf8',
    );
    return decoded.includes('-----BEGIN') ? decoded : null;
  } catch {
    return null;
  }
}

function envolverPem(tipo: string, body: string): string {
  const limpio = body.replace(/\s+/g, '');
  const lineas = limpio.match(/.{1,64}/g) ?? [limpio];
  return `-----BEGIN ${tipo}-----\n${lineas.join('\n')}\n-----END ${tipo}-----\n`;
}
