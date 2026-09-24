import type { StoragePort, StoredFileInfo } from '../types.js';

export interface InMemoryStorage extends StoragePort {
  files: Map<string, StoredFileInfo>;
  failRemove: boolean;
}

export function createMemoryStorage(): InMemoryStorage {
  const files = new Map<string, StoredFileInfo>();
  const storage: InMemoryStorage = {
    files,
    failRemove: false,
    async createUploadUrls(paths) {
      return paths.map((path) => ({ path, signedUrl: `https://storage.test/upload/${path}`, token: `token-${path}` }));
    },
    async createReadUrls(paths) {
      return Object.fromEntries(paths.map((path) => [path, `https://storage.test/read/${path}`]));
    },
    async stat(path) {
      return files.get(path) ?? null;
    },
    async remove(paths) {
      if (storage.failRemove) throw new Error('storage fora do ar');
      for (const path of paths) files.delete(path);
    },
    async listFiles(folder) {
      const prefix = `${folder.replace(/\/+$/, '')}/`;
      return [...files.keys()].filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'));
    },
    async removeUnder(prefix) {
      if (storage.failRemove) throw new Error('storage fora do ar');
      for (const path of [...files.keys()]) if (path.startsWith(prefix)) files.delete(path);
    },
  };
  return storage;
}
