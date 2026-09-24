import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import type { StoragePort, UploadTicket } from './types.js';

export const PHOTO_BUCKET = 'brand-assets';
const REMOVE_CHUNK = 100;

export function createSupabaseStorage(client: SupabaseClient = supabaseAdmin): StoragePort {
  const bucket = () => client.storage.from(PHOTO_BUCKET);
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
      for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
        const { error } = await bucket().remove(paths.slice(i, i + REMOVE_CHUNK));
        if (error) throw error;
      }
    },
  };
}
