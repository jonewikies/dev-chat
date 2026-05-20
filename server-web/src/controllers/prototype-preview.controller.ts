import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { ProjectPrototypeRepository } from '../repositories/project-prototype.repository';
import { PrototypeArchiveService } from '../services/prototype-archive.service';
import { config } from '../config/app';

const AXURE_HINT_BOOLEAN_ENDPOINTS = new Set([
  'shouldShowSitemapHint',
  'shouldShowPageNoteHint',
  'shouldShowConsoleHint',
]);

const AXURE_HINT_ACK_ENDPOINTS = new Set([
  'sitemapHintAccepted',
  'pageNoteHintAccepted',
]);

export class PrototypePreviewController {
  private prototypeRepo: ProjectPrototypeRepository;
  private archiveService: PrototypeArchiveService;

  constructor() {
    this.prototypeRepo = new ProjectPrototypeRepository();
    this.archiveService = new PrototypeArchiveService();
  }

  private applyPreviewHeaders(res: Response, contentType?: string) {
    const allowedAncestors = Array.isArray(config.cors.origin) && config.cors.origin.length > 0
      ? ["'self'", ...config.cors.origin].join(' ')
      : "'self'";

    // Preview runs inside an HTTP iframe sandbox. Disable headers that are noisy or incompatible there.
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Origin-Agent-Cluster');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    res.removeHeader('Cross-Origin-Resource-Policy');

    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin, Accept, X-Requested-With');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader(
      'Content-Security-Policy',
        `default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; media-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src * data: blob:; frame-ancestors ${allowedAncestors}; base-uri 'self'; object-src 'none'`
    );
  }

  handleOptions = (_req: Request, res: Response) => {
    this.applyPreviewHeaders(res);
    res.status(204).end();
  };

  private tryServeAxureHintEndpoint(requestedPath: string | undefined, res: Response): boolean {
    if (!requestedPath) {
      return false;
    }

    const normalizedPath = requestedPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!normalizedPath) {
      return false;
    }

    const endpointName = normalizedPath.split('/').pop();
    if (!endpointName) {
      return false;
    }

    if (AXURE_HINT_BOOLEAN_ENDPOINTS.has(endpointName)) {
      this.applyPreviewHeaders(res, 'application/json; charset=utf-8');
      res.status(200).send('false');
      return true;
    }

    if (AXURE_HINT_ACK_ENDPOINTS.has(endpointName)) {
      this.applyPreviewHeaders(res, 'text/plain; charset=utf-8');
      res.status(204).end();
      return true;
    }

    return false;
  }

  servePreview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const previewKey = req.params.previewKey;
      const requestedPath = req.params[0];
      const prototype = this.prototypeRepo.findByPreviewKey(previewKey);

      if (!prototype) {
        res.status(404).send('Preview not found');
        return;
      }

      if (this.tryServeAxureHintEndpoint(requestedPath, res)) {
        return;
      }

      const targetFile = this.archiveService.resolvePreviewFile(prototype, requestedPath);
      const contentType = this.archiveService.getContentType(targetFile);
      this.applyPreviewHeaders(res, contentType);

      res.sendFile(path.resolve(targetFile));
    } catch (error) {
      next(error);
    }
  };
}