import Redis from 'ioredis';

export async function probarConexionRedis(
  host: string,
  port: number,
): Promise<boolean> {
  const cliente = new Redis({
    host,
    port,
    connectTimeout: 3000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    retryStrategy: () => null,
    enableOfflineQueue: false,
  });

  // Evita "[ioredis] Unhandled error event" cuando Redis no está levantado
  cliente.on('error', () => {});

  try {
    await cliente.connect();
    await cliente.ping();
    return true;
  } catch {
    return false;
  } finally {
    cliente.removeAllListeners();
    cliente.disconnect();
  }
}
