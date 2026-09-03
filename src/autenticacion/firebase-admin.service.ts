import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import {
  DecodedIdToken,
  getAuth,
  UserRecord,
} from 'firebase-admin/auth';
import { normalizarClavePrivadaFirebase } from './normalizar-clave-privada';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private app: App;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKeyRaw = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    const privateKey = privateKeyRaw
      ? normalizarClavePrivadaFirebase(privateKeyRaw)
      : undefined;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Variables de entorno de Firebase no configuradas (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)',
      );
    }

    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      throw new Error(
        'FIREBASE_PRIVATE_KEY no es un PEM válido. En Docker/Coolify pégala en una sola línea con \\n (sin saltos reales) y sin comillas extra.',
      );
    }

    if (getApps().length === 0) {
      this.app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      this.app = getApps()[0];
    }
  }

  async verificarToken(token: string): Promise<DecodedIdToken> {
    return getAuth(this.app).verifyIdToken(token);
  }

  async crearUsuario(
    correo: string,
    contrasena: string,
    nombreCompleto: string,
  ): Promise<UserRecord> {
    return getAuth(this.app).createUser({
      email: correo,
      password: contrasena,
      displayName: nombreCompleto,
      emailVerified: true,
    });
  }

  async actualizarUsuario(
    uid: string,
    datos: {
      correo?: string;
      contrasena?: string;
      nombreCompleto?: string;
      deshabilitado?: boolean;
    },
  ): Promise<UserRecord> {
    return getAuth(this.app).updateUser(uid, {
      email: datos.correo,
      password: datos.contrasena,
      displayName: datos.nombreCompleto,
      disabled: datos.deshabilitado,
    });
  }

  async eliminarUsuario(uid: string): Promise<void> {
    await getAuth(this.app).deleteUser(uid);
  }
}
