import { InternalServerErrorException } from '@nestjs/common';

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StorageService } from './storage.service.js';

describe('StorageService', () => {
  let service: StorageService;
  let storagePath: string;

  beforeEach(async () => {
    storagePath = await mkdtemp(join(tmpdir(), 'image-storage-'));

    vi.stubEnv('UPLOAD_STORAGE_PATH', storagePath);

    service = new StorageService();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();

    await rm(storagePath, {
      recursive: true,
      force: true,
    });
  });

  it('should save an image with a generated UUID filename', async () => {
    const buffer = Buffer.from('fake-image-data');

    const storageKey = await service.save(buffer, 'image/png');

    expect(storageKey).toMatch(/^[0-9a-f-]{36}\.png$/i);

    const savedBuffer = await readFile(join(storagePath, storageKey));

    expect(savedBuffer).toEqual(buffer);
  });

  it('should use the correct extension for supported MIME types', async () => {
    await expect(service.save(Buffer.from('jpeg'), 'image/jpeg')).resolves.toMatch(/\.jpg$/);

    await expect(service.save(Buffer.from('png'), 'image/png')).resolves.toMatch(/\.png$/);

    await expect(service.save(Buffer.from('webp'), 'image/webp')).resolves.toMatch(/\.webp$/);
  });

  it('should reject unsupported MIME types', async () => {
    await expect(service.save(Buffer.from('data'), 'image/gif')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should delete an existing image', async () => {
    const storageKey = await service.save(Buffer.from('fake-image-data'), 'image/png');

    await service.delete(storageKey);

    await expect(readFile(join(storagePath, storageKey))).rejects.toThrow();
  });

  it('should reject invalid storage keys', async () => {
    await expect(service.delete('../important-file')).rejects.toThrow(InternalServerErrorException);
  });
});
