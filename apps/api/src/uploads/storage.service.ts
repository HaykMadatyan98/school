import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3, Auth } from 'googleapis';
import { Readable } from 'stream';
import { basename, extname, join, resolve } from 'path';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  createReadStream,
} from 'fs';

export type StoredFile = {
  url: string;
  downloadUrl?: string;
  publicId?: string;
  bytes?: number;
  format?: string;
  resourceType?: string;
  storage: 'google-drive' | 'local';
};

type OAuthTokenFile = {
  refresh_token: string;
  access_token?: string;
  expiry_date?: number;
  updatedAt?: string;
};

@Injectable()
export class StorageService {
  private readonly log = new Logger(StorageService.name);
  private drive: drive_v3.Drive | null = null;
  private folderId: string | null = null;
  private authMode: 'oauth' | 'service-account' | null = null;
  private readonly tokenPath: string;

  constructor(private readonly config: ConfigService) {
    this.tokenPath = resolve(
      process.cwd(),
      this.config.get<string>('GOOGLE_OAUTH_TOKEN_PATH') ||
        './secrets/google-oauth-tokens.json',
    );
    this.initGoogleDrive();
  }

  /** Rebuild Drive client (call after OAuth callback saves a token). */
  reconnect() {
    this.drive = null;
    this.folderId = null;
    this.authMode = null;
    this.initGoogleDrive();
  }

  getStatus() {
    return {
      configured: this.isDriveEnabled(),
      authMode: this.authMode,
      folderId: this.folderId,
      hasOAuthClient: Boolean(
        this.config.get('GOOGLE_OAUTH_CLIENT_ID') &&
          this.config.get('GOOGLE_OAUTH_CLIENT_SECRET'),
      ),
      hasRefreshToken: Boolean(this.readRefreshToken()),
      callbackUrl: this.getCallbackUrl(),
    };
  }

  getCallbackUrl() {
    const port = this.config.get<string>('PORT') || '3001';
    const base =
      this.config.get<string>('API_PUBLIC_URL')?.replace(/\/$/, '') ||
      `http://localhost:${port}`;
    return `${base}/api/uploads/google/callback`;
  }

  createOAuthClient(redirectUri?: string): Auth.OAuth2Client {
    const clientId = this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')?.trim();
    const clientSecret = this.config
      .get<string>('GOOGLE_OAUTH_CLIENT_SECRET')
      ?.trim();
    if (!clientId || !clientSecret) {
      throw new Error(
        'GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET missing in .env',
      );
    }
    return new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri || this.getCallbackUrl(),
    );
  }

  getAuthUrl() {
    const oauth2 = this.createOAuthClient();
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/drive.file'],
    });
  }

  async completeOAuth(code: string) {
    const oauth2 = this.createOAuthClient();
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      // Sometimes Google omits refresh_token if already granted — keep old one
      const existing = this.readRefreshToken();
      if (!existing) {
        throw new Error(
          'No refresh_token returned. Revoke app access at https://myaccount.google.com/permissions and try again.',
        );
      }
      tokens.refresh_token = existing;
    }
    this.saveTokenFile({
      refresh_token: tokens.refresh_token!,
      access_token: tokens.access_token || undefined,
      expiry_date: tokens.expiry_date || undefined,
      updatedAt: new Date().toISOString(),
    });
    this.reconnect();
    return this.getStatus();
  }

  private initGoogleDrive() {
    const folderId = this.config.get<string>('GOOGLE_DRIVE_FOLDER_ID')?.trim();
    if (!folderId) {
      this.log.warn(
        'GOOGLE_DRIVE_FOLDER_ID missing — uploads stay on local disk.',
      );
      return;
    }

    const oauthAuth = this.buildOAuthClientFromStoredToken();
    if (oauthAuth) {
      this.drive = google.drive({ version: 'v3', auth: oauthAuth });
      this.folderId = folderId;
      this.authMode = 'oauth';
      this.log.log(`Google Drive enabled via OAuth (folder ${folderId})`);
      return;
    }

    const sa = this.loadServiceAccount();
    if (sa) {
      const auth = new google.auth.JWT({
        email: sa.client_email,
        key: sa.private_key,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
      this.drive = google.drive({ version: 'v3', auth });
      this.folderId = folderId;
      this.authMode = 'service-account';
      this.log.log(
        `Google Drive via service account (folder ${folderId}) — personal My Drive may reject SA; prefer OAuth connect.`,
      );
      return;
    }

    this.log.warn(
      'Google Drive folder set but not connected. Admin: GET /api/uploads/google/connect',
    );
  }

  private buildOAuthClientFromStoredToken(): Auth.OAuth2Client | null {
    const refresh = this.readRefreshToken();
    if (!refresh) return null;
    try {
      const oauth2 = this.createOAuthClient();
      oauth2.setCredentials({ refresh_token: refresh });
      return oauth2;
    } catch {
      return null;
    }
  }

  private readRefreshToken(): string | null {
    const fromEnv = this.config.get<string>('GOOGLE_OAUTH_REFRESH_TOKEN')?.trim();
    if (fromEnv) return fromEnv;
    try {
      if (!existsSync(this.tokenPath)) return null;
      const data = JSON.parse(
        readFileSync(this.tokenPath, 'utf8'),
      ) as OAuthTokenFile;
      return data.refresh_token?.trim() || null;
    } catch {
      return null;
    }
  }

  private saveTokenFile(data: OAuthTokenFile) {
    const dir = join(this.tokenPath, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.tokenPath, JSON.stringify(data, null, 2), {
      mode: 0o600,
    });
    this.log.log(`Saved Google OAuth token → ${this.tokenPath}`);
  }

  private loadServiceAccount(): {
    client_email: string;
    private_key: string;
  } | null {
    const raw =
      this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON')?.trim() ||
      this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS')?.trim();
    if (!raw) return null;
    try {
      if (raw.startsWith('{')) return JSON.parse(raw);
      if (existsSync(raw)) return JSON.parse(readFileSync(raw, 'utf8'));
      return null;
    } catch {
      return null;
    }
  }

  isDriveEnabled() {
    return Boolean(this.drive && this.folderId);
  }

  static driveViewUrl(fileId: string, isPdf: boolean) {
    if (isPdf) return `https://drive.google.com/file/d/${fileId}/view`;
    // Stored as Drive id URL; frontend proxies via /api/media/drive/:id
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  static driveDownloadUrl(fileId: string) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  static extractFileId(urlOrId: string): string | null {
    const s = urlOrId.trim();
    if (/^[a-zA-Z0-9_-]{10,}$/.test(s) && !s.includes('/')) return s;
    const m =
      s.match(/\/d\/([^/=?]+)/) ||
      s.match(/[?&]id=([^&]+)/) ||
      s.match(/\/media\/drive\/([^/?#]+)/);
    return m?.[1] || null;
  }

  /** Stream a Drive file for public <img> / download (avoids Google hotlink 429). */
  async streamFile(fileId: string): Promise<{
    stream: NodeJS.ReadableStream;
    mimeType: string;
    size?: number;
    name?: string;
  }> {
    if (!this.drive) {
      throw new Error('Google Drive is not connected');
    }
    const meta = await this.drive.files.get({
      fileId,
      fields: 'id,name,mimeType,size',
      supportsAllDrives: true,
    });
    const res = await this.drive.files.get(
      {
        fileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      { responseType: 'stream' },
    );
    return {
      stream: res.data as NodeJS.ReadableStream,
      mimeType: meta.data.mimeType || 'application/octet-stream',
      size: meta.data.size ? Number(meta.data.size) : undefined,
      name: meta.data.name || undefined,
    };
  }

  async uploadLocalFile(
    file: Express.Multer.File,
    folderHint = 'school78',
  ): Promise<StoredFile> {
    if (!this.drive || !this.folderId) {
      throw new Error('Google Drive is not connected');
    }

    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    const safeName = basename(file.originalname).replace(
      /[^\w.\-()+\u0400-\u04FF\u0530-\u058F ]+/gi,
      '_',
    );
    const name = `${Date.now()}-${safeName || `file${extname(file.originalname) || ''}`}`;

    const body = file.buffer
      ? Readable.from(file.buffer)
      : file.path
        ? createReadStream(file.path)
        : null;
    if (!body) throw new Error('No file data to upload');

    const created = await this.drive.files.create({
      requestBody: {
        name,
        parents: [this.folderId],
        description: `Uploaded via School 78 portal (${folderHint})`,
      },
      media: {
        mimeType:
          file.mimetype ||
          (isPdf ? 'application/pdf' : 'application/octet-stream'),
        body,
      },
      fields: 'id,name,mimeType,size',
      supportsAllDrives: true,
    });

    const fileId = created.data.id;
    if (!fileId) throw new Error('Google Drive upload returned no file id');

    await this.drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });

    return {
      url: StorageService.driveViewUrl(fileId, isPdf),
      downloadUrl: StorageService.driveDownloadUrl(fileId),
      publicId: fileId,
      bytes: Number(created.data.size) || file.size,
      format: file.mimetype,
      resourceType: isPdf ? 'pdf' : 'image',
      storage: 'google-drive',
    };
  }

  async uploadFromUrl(
    remoteUrl: string,
    folderHint = 'school78/migrated',
  ): Promise<StoredFile> {
    if (!this.drive || !this.folderId) {
      return { url: remoteUrl, storage: 'local' };
    }
    const res = await fetch(remoteUrl, {
      headers: { 'User-Agent': 'School78DriveUploader/1.0' },
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      throw new Error(`Download failed ${res.status} for ${remoteUrl}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType =
      res.headers.get('content-type')?.split(';')[0] ||
      'application/octet-stream';
    const originalname =
      basename(new URL(remoteUrl).pathname) || `file-${Date.now()}`;
    return this.uploadLocalFile(
      {
        fieldname: 'file',
        originalname,
        encoding: '7bit',
        mimetype: contentType,
        size: buf.length,
        buffer: buf,
        destination: '',
        filename: originalname,
        path: '',
        stream: Readable.from(buf),
      } as Express.Multer.File,
      folderHint,
    );
  }
}
