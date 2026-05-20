import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import unzipper from 'unzipper';
import { config } from '../config/app';
import { ProjectPrototype } from '../types/db.types';
import { NotFoundError, ValidationError } from '../utils/error.util';

interface PreparedPrototypeArchive {
  archiveFileName: string;
  archiveFilePath: string;
  archiveSize: number;
  extractedDir: string;
  entryFile: string;
  previewKey: string;
}

export class PrototypeArchiveService {
  private readonly rootDir = config.prototype.dir;
  private readonly archivesDir = path.join(this.rootDir, 'archives');
  private readonly extractedDir = path.join(this.rootDir, 'extracted');

  async preparePrototypeArchive(tempArchivePath: string, originalName: string): Promise<PreparedPrototypeArchive> {
    await this.ensureDirectories();
    this.validateArchiveName(originalName);

    const extension = path.extname(originalName).toLowerCase();
    if (extension !== '.zip') {
      throw new ValidationError('原型稿必须上传 zip 压缩包');
    }

    const archiveId = crypto.randomUUID();
    const previewKey = crypto.randomBytes(24).toString('hex');
    const safeOriginalName = this.sanitizeFileName(originalName);
    const archiveFileName = `${archiveId}-${safeOriginalName}`;
    const archiveFilePath = path.join(this.archivesDir, archiveFileName);
    const extractedDir = path.join(this.extractedDir, archiveId);

    await fs.promises.mkdir(extractedDir, { recursive: true });
    await fs.promises.rename(tempArchivePath, archiveFilePath);

    try {
      await this.extractArchive(archiveFilePath, extractedDir);
      const entryFile = await this.findEntryFile(extractedDir);
      const stat = await fs.promises.stat(archiveFilePath);

      return {
        archiveFileName: safeOriginalName,
        archiveFilePath,
        archiveSize: stat.size,
        extractedDir,
        entryFile,
        previewKey,
      };
    } catch (error) {
      await this.safeRemoveFile(archiveFilePath);
      await this.safeRemoveDirectory(extractedDir);
      throw error;
    }
  }

  async replacePrototypeArchive(existing: ProjectPrototype, tempArchivePath: string, originalName: string): Promise<PreparedPrototypeArchive> {
    const prepared = await this.preparePrototypeArchive(tempArchivePath, originalName);
    await this.removePrototypeAssets(existing);
    return prepared;
  }

  async removePrototypeAssets(prototype: Pick<ProjectPrototype, 'archive_file_path' | 'extracted_dir'>): Promise<void> {
    await this.safeRemoveFile(prototype.archive_file_path);
    await this.safeRemoveDirectory(prototype.extracted_dir);
  }

  resolvePreviewFile(prototype: ProjectPrototype, requestedPath?: string): string {
    const relativePath = requestedPath ? this.normalizeEntryPath(requestedPath) : this.normalizeEntryPath(prototype.entry_file);
    const prototypeRoot = path.resolve(prototype.extracted_dir);
    const absolutePath = path.resolve(prototypeRoot, relativePath);

    if (!(absolutePath === prototypeRoot || absolutePath.startsWith(`${prototypeRoot}${path.sep}`))) {
      throw new ValidationError('非法预览文件路径');
    }

    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new NotFoundError('预览文件不存在');
    }

    return absolutePath;
  }

  getContentType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    switch (extension) {
      case '.html':
      case '.htm':
        return 'text/html; charset=utf-8';
      case '.css':
        return 'text/css; charset=utf-8';
      case '.js':
        return 'application/javascript; charset=utf-8';
      case '.json':
        return 'application/json; charset=utf-8';
      case '.svg':
        return 'image/svg+xml';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      case '.ico':
        return 'image/x-icon';
      case '.woff':
        return 'font/woff';
      case '.woff2':
        return 'font/woff2';
      case '.ttf':
        return 'font/ttf';
      case '.eot':
        return 'application/vnd.ms-fontobject';
      case '.xml':
        return 'application/xml; charset=utf-8';
      case '.txt':
        return 'text/plain; charset=utf-8';
      default:
        return 'application/octet-stream';
    }
  }

  private async ensureDirectories(): Promise<void> {
    await fs.promises.mkdir(this.archivesDir, { recursive: true });
    await fs.promises.mkdir(this.extractedDir, { recursive: true });
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private validateArchiveName(fileName: string): void {
    if (!fileName.trim()) {
      throw new ValidationError('上传文件名不能为空');
    }
  }

  private normalizeEntryPath(filePath: string): string {
    const normalized = path.posix.normalize(filePath.replace(/\\/g, '/')).replace(/^\/+/, '');
    if (!normalized || normalized === '.' || normalized.startsWith('..') || normalized.includes('../')) {
      throw new ValidationError('压缩包内包含非法路径');
    }
    return normalized;
  }

  private async extractArchive(archivePath: string, destinationDir: string): Promise<void> {
    const directory = await unzipper.Open.file(archivePath);
    let totalUncompressedSize = 0;
    let fileCount = 0;

    for (const entry of directory.files) {
      if (entry.path.startsWith('__MACOSX/')) {
        continue;
      }

      const safeEntryPath = this.normalizeEntryPath(entry.path);
      const targetPath = path.resolve(destinationDir, safeEntryPath);
      if (!targetPath.startsWith(`${path.resolve(destinationDir)}${path.sep}`) && targetPath !== path.resolve(destinationDir)) {
        throw new ValidationError('压缩包内包含越界路径');
      }

      if (entry.type === 'Directory') {
        await fs.promises.mkdir(targetPath, { recursive: true });
        continue;
      }

      fileCount += 1;
      totalUncompressedSize += entry.uncompressedSize || 0;

      if (fileCount > 5000) {
        throw new ValidationError('压缩包内文件数量过多');
      }
      if (totalUncompressedSize > config.prototype.maxExtractedSize) {
        throw new ValidationError('压缩包解压后体积过大');
      }

      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await pipeline(entry.stream(), fs.createWriteStream(targetPath));
    }
  }

  private async findEntryFile(rootDir: string): Promise<string> {
    const candidates: string[] = [];

    const walk = async (currentDir: string) => {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === '__MACOSX') {
          continue;
        }

        const absolutePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(absolutePath);
          continue;
        }

        if (entry.isFile() && entry.name.toLowerCase() === 'index.html') {
          candidates.push(path.relative(rootDir, absolutePath).replace(/\\/g, '/'));
        }
      }
    };

    await walk(rootDir);

    if (candidates.length === 0) {
      throw new ValidationError('压缩包中未找到可预览的 index.html');
    }

    candidates.sort((left, right) => {
      const leftDepth = left.split('/').length;
      const rightDepth = right.split('/').length;
      if (leftDepth !== rightDepth) {
        return leftDepth - rightDepth;
      }
      return left.length - right.length;
    });

    return candidates[0];
  }

  private async safeRemoveFile(filePath: string): Promise<void> {
    if (!filePath) return;
    await fs.promises.rm(filePath, { force: true });
  }

  private async safeRemoveDirectory(directoryPath: string): Promise<void> {
    if (!directoryPath) return;
    await fs.promises.rm(directoryPath, { recursive: true, force: true });
  }
}