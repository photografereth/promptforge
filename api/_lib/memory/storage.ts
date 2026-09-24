import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import type { StoragePort, UploadTicket } from './types.js';

export const PHOTO_BUCKET = 'brand-assets';
const REMOVE_CHUNK = 100;

const LIST_LIMIT = 1000;

export function createSupabaseStorage(client: SupabaseClient = supabaseAdmin): StoragePort {
  const bucket = () => client.storage.from(PHOTO_BUCKET);

  // list() não é recursivo: pastas vêm com id null.
  async function entries(folder: string) {
    const { data, error } = await bucket().list(folder, { limit: LIST_LIMIT });
    if (error) throw error;
    return data.map((entry) => ({ path: `${folder}/${entry.name}`, isFolder: entry.id === null }));
  }

  async function collectFiles(folder: string): Promise<string[]> {
    const files: string[] = [];
    for (const entry of await entries(folder)) {
      if (entry.isFolder) files.push(...(await collectFiles(entry.path)));
      else files.push(entry.path);
    }
    return files;
  }

  async function removePaths(paths: string[]): Promise<void> {
    for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
      const { error } = await bucket().remove(paths.slice(i, i + REMOVE_CHUNK));
      if (error) throw error;
    }
  }

  return {
    async createUploadUrls(paths) {
      const tickets: UploadTicket[] = [];
      for (const path of paths) {
        const { data, error } = await bucket().createSignedUploadUrl(path);
        if (error) throw error;
        tickets.push({ path: data.path, signedUrl: data.signedUrl, token: data.token });
      }
      return tickets;
    },
    async createReadUrls(paths, expiresInSeconds) {
      if (paths.length === 0) return {};
      const { data, error } = await bucket().createSignedUrls(paths, expiresInSeconds);
      if (error) throw error;
      const urls: Record<string, string> = {};
      for (const item of data) {
        if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl;
      }
      return urls;
    },
    async stat(path) {
      // exists() devolve data=false para 400/404 e lança nos outros erros.
      const found = await bucket().exists(path);
      if (!found.data) return null;
      const { data, error } = await bucket().info(path);
      if (error) throw error;
      return { size: data.size ?? data.metadata?.size ?? 0, mime: data.contentType ?? data.metadata?.mimetype ?? null };
    },
    async remove(paths) {
      await removePaths(paths);
    },
    async listFiles(folder) {
      return (await entries(folder.replace(/\/+$/, ''))).filter((e) => !e.isFolder).map((e) => e.path);
    },
    async removeUnder(prefix) {
      await removePaths(await collectFiles(prefix.replace(/\/+$/, '')));
    },
  };
}
