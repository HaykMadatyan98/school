import {
  Controller,
  Post,
  Get,
  Query,
  Param,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { StorageService } from './storage.service';
import { Public, Roles } from '../common/decorators/auth.decorators';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

@ApiTags('uploads')
@ApiBearerAuth('JWT')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {
    ensureUploadDir();
  }

  @Get('google/status')
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiOperation({ summary: 'Google Drive connection status' })
  googleStatus() {
    return this.storage.getStatus();
  }

  @Get('google/auth-url')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get Google OAuth URL (open in browser to connect Drive)',
  })
  googleAuthUrl() {
    try {
      return {
        url: this.storage.getAuthUrl(),
        callbackUrl: this.storage.getCallbackUrl(),
      };
    } catch (err) {
      throw new ServiceUnavailableException(
        err instanceof Error ? err.message : 'OAuth not configured',
      );
    }
  }

  @Get('google/connect')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Redirect to Google OAuth (use from browser with session / Swagger)',
  })
  googleConnect(@Res() res: Response) {
    try {
      const url = this.storage.getAuthUrl();
      return res.redirect(url);
    } catch (err) {
      throw new ServiceUnavailableException(
        err instanceof Error ? err.message : 'OAuth not configured',
      );
    }
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'OAuth callback from Google (public)' })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error) {
      res.status(400).type('html').send(
        `<h1>Google OAuth error</h1><pre>${error}</pre><p>Close this tab.</p>`,
      );
      return;
    }
    if (!code) {
      throw new BadRequestException('Missing code');
    }
    try {
      const status = await this.storage.completeOAuth(code);
      const ok = status.configured
        ? 'Google Drive connected. You can close this tab and upload files in admin.'
        : 'Token saved, but Drive is not fully configured (check GOOGLE_DRIVE_FOLDER_ID).';
      res.status(200).type('html').send(
        `<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
          <h1>OK</h1>
          <p>${ok}</p>
          <pre>${JSON.stringify(status, null, 2)}</pre>
        </body></html>`,
      );
    } catch (err) {
      res.status(500).type('html').send(
        `<h1>Failed</h1><pre>${err instanceof Error ? err.message : 'Error'}</pre>`,
      );
    }
  }

  @Public()
  @Get('media/drive/:fileId')
  @ApiOperation({
    summary: 'Proxy a Google Drive file (public images/PDFs for the site)',
  })
  async proxyDriveFile(
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const id = StorageService.extractFileId(fileId);
    if (!id) throw new BadRequestException('Invalid file id');
    if (!this.storage.isDriveEnabled()) {
      throw new ServiceUnavailableException('Google Drive is not connected');
    }
    try {
      const file = await this.storage.streamFile(id);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      if (file.size) res.setHeader('Content-Length', String(file.size));
      if (file.name) {
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${encodeURIComponent(file.name)}"`,
        );
      }
      file.stream.pipe(res);
    } catch {
      throw new NotFoundException('File not found on Google Drive');
    }
  }

  @Post()
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiOperation({
    summary: 'Upload image or PDF (Google Drive when connected, else local)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          ALLOWED.has(file.mimetype) ||
          file.mimetype.startsWith('image/') ||
          file.originalname.toLowerCase().endsWith('.pdf');
        if (!ok) {
          cb(
            new BadRequestException('Only image or PDF files are allowed'),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (this.storage.isDriveEnabled()) {
      try {
        const stored = await this.storage.uploadLocalFile(file);
        return {
          url: stored.url,
          downloadUrl: stored.downloadUrl,
          filename: stored.publicId,
          size: stored.bytes ?? file.size,
          mimeType: file.mimetype,
          storage: 'google-drive',
        };
      } catch (err) {
        throw new ServiceUnavailableException(
          err instanceof Error ? err.message : 'Google Drive upload failed',
        );
      }
    }

    const ext = extname(file.originalname).toLowerCase() || '.bin';
    const filename = `${randomUUID()}${ext}`;
    writeFileSync(join(UPLOAD_DIR, filename), file.buffer);
    return {
      url: `/uploads/${filename}`,
      filename,
      size: file.size,
      mimeType: file.mimetype,
      storage: 'local',
      hint: 'Drive not connected. Admin open GET /api/uploads/google/connect',
    };
  }
}
