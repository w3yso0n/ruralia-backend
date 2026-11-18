/**
 * Sustituto de `firebase-admin/auth` para las pruebas de integración: el
 * paquete real carga `jose` como ESM (Jest no lo transforma) y las pruebas no
 * deben tocar Firebase. Cualquier llamada falla de forma explícita.
 */
const sinFirebase = () => {
  throw new Error('Firebase no está disponible en las pruebas de integración');
};

export const getAuth = () => new Proxy({}, { get: () => sinFirebase });

export type DecodedIdToken = Record<string, unknown>;
export type UserRecord = Record<string, unknown>;
