import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import type { Queryable } from '../db/transaction.js';
import { ApiError } from '../errors.js';
import { rewriteLocationCodes } from './svg.js';

const ASSET_PREFIX = '/api/assets/maps/';

async function collectFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(path) : Promise.resolve([path]);
    }));
    return nested.flat();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export class SvgStorage {
  constructor(private readonly rootDirectory: string) {}

  async ensureReady(): Promise<void> {
    await mkdir(this.rootDirectory, { recursive: true });
  }

  private pathForAsset(assetUrl: string): string {
    if (!assetUrl.startsWith(ASSET_PREFIX)) {
      throw new ApiError(500, 'INVALID_ASSET_URL', 'La referencia del SVG no pertenece al almacenamiento local.');
    }
    const relativePath = assetUrl.slice(ASSET_PREFIX.length).replaceAll('/', sep);
    const absolute = resolve(this.rootDirectory, relativePath);
    const root = `${resolve(this.rootDirectory)}${sep}`;
    if (!absolute.startsWith(root)) {
      throw new ApiError(400, 'INVALID_ASSET_PATH', 'La ruta del recurso no es válida.');
    }
    return absolute;
  }

  async write(schemeId: number, source: string): Promise<string> {
    const directory = join(this.rootDirectory, String(schemeId));
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.svg`;
    const path = join(directory, filename);
    await writeFile(path, source, { encoding: 'utf8', flag: 'wx' });
    return `${ASSET_PREFIX}${schemeId}/${filename}`;
  }

  async read(assetUrl: string): Promise<string> {
    try {
      return await readFile(this.pathForAsset(assetUrl), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ApiError(500, 'SVG_FILE_MISSING', 'El archivo SVG registrado no existe.');
      }
      throw error;
    }
  }

  async remove(assetUrl: string): Promise<void> {
    await rm(this.pathForAsset(assetUrl), { force: true });
  }

  async clone(
    assetUrl: string,
    targetSchemeId: number,
    replacements?: Map<string, string>,
  ): Promise<string> {
    const source = await this.read(assetUrl);
    return this.write(
      targetSchemeId,
      replacements === undefined ? source : rewriteLocationCodes(source, replacements),
    );
  }

  absoluteDirectory(): string {
    return this.rootDirectory;
  }

  async reconcile(database: Queryable): Promise<{ removed: number; kept: number }> {
    await this.ensureReady();
    const result = await database.query<{ asset_url: string }>('SELECT asset_url FROM map_layer_svgs');
    const referenced = new Set(result.rows.map((row) => resolve(this.pathForAsset(row.asset_url))));
    const files = await collectFiles(this.rootDirectory);
    let removed = 0;
    for (const file of files) {
      if (basename(file).endsWith('.tmp') || !referenced.has(resolve(file))) {
        await rm(file, { force: true });
        removed += 1;
      }
    }
    const directories = new Set(files.map(dirname));
    for (const directory of [...directories].sort((a, b) => b.length - a.length)) {
      if (relative(this.rootDirectory, directory) !== '') {
        await rm(directory, { recursive: false, force: true }).catch(() => undefined);
      }
    }
    return { removed, kept: files.length - removed };
  }
}
