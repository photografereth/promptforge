import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import type { Asset, AssetPatch, Brand, MemoryRepo, PromptEntry } from './types.js';

type Row = Record<string, any>;

const toBrand = (r: Row): Brand => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  kit: r.kit ?? {},
  isDefault: r.is_default,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toAsset = (r: Row): Asset => ({
  id: r.id,
  brandId: r.brand_id,
  userId: r.user_id,
  kind: r.kind,
  name: r.name,
  data: r.data,
  analysis: r.analysis,
  photos: r.photos ?? [],
  pinned: r.pinned,
  lastUsedAt: r.last_used_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toPrompt = (r: Row): PromptEntry => ({
  id: r.id,
  brandId: r.brand_id,
  userId: r.user_id,
  mode: r.mode,
  agent: r.agent,
  title: r.title,
  productName: r.product_name,
  deterministicPrompt: r.deterministic_prompt,
  enhancedPrompt: r.enhanced_prompt,
  state: r.state,
  assetIds: r.asset_ids ?? [],
  favorite: r.favorite,
  legacyId: r.legacy_id,
  createdAt: r.created_at,
});

function assetPatchRow(patch: AssetPatch): Row {
  const row: Row = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.data !== undefined) row.data = patch.data;
  if (patch.analysis !== undefined) row.analysis = patch.analysis;
  if (patch.photos !== undefined) row.photos = patch.photos;
  if (patch.pinned !== undefined) row.pinned = patch.pinned;
  if (patch.lastUsedAt !== undefined) row.last_used_at = patch.lastUsedAt;
  return row;
}

// A service role ignora o RLS: TODA consulta abaixo filtra por user_id. Nunca remover esse filtro.
export function createSupabaseMemoryRepo(client: SupabaseClient = supabaseAdmin): MemoryRepo {
  const brands = () => client.from('brands');
  const assets = () => client.from('brand_assets');
  const prompts = () => client.from('prompt_library');

  return {
    async listBrands(userId) {
      const { data, error } = await brands().select('*').eq('user_id', userId).order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toBrand);
    },
    async getBrand(userId, brandId) {
      const { data, error } = await brands().select('*').eq('user_id', userId).eq('id', brandId).maybeSingle();
      if (error) throw error;
      return data ? toBrand(data) : null;
    },
    async insertBrand(userId, input) {
      const { data, error } = await brands()
        .insert({ user_id: userId, name: input.name, kit: input.kit, is_default: input.isDefault })
        .select('*')
        .single();
      if (error) throw error;
      return toBrand(data);
    },
    async updateBrand(userId, brandId, patch) {
      const row: Row = { updated_at: new Date().toISOString() };
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.kit !== undefined) row.kit = patch.kit;
      if (patch.isDefault !== undefined) row.is_default = patch.isDefault;
      const { data, error } = await brands().update(row).eq('user_id', userId).eq('id', brandId).select('*').maybeSingle();
      if (error) throw error;
      return data ? toBrand(data) : null;
    },
    async deleteBrand(userId, brandId) {
      const { error } = await brands().delete().eq('user_id', userId).eq('id', brandId);
      if (error) throw error;
    },

    async listAssets(userId, brandId) {
      const { data, error } = await assets()
        .select('*')
        .eq('user_id', userId)
        .eq('brand_id', brandId)
        .order('last_used_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toAsset);
    },
    async listAllAssets(userId) {
      const { data, error } = await assets().select('*').eq('user_id', userId);
      if (error) throw error;
      return (data ?? []).map(toAsset);
    },
    async getAsset(userId, assetId) {
      const { data, error } = await assets().select('*').eq('user_id', userId).eq('id', assetId).maybeSingle();
      if (error) throw error;
      return data ? toAsset(data) : null;
    },
    async findAssetByName(userId, brandId, kind, name) {
      // Comparação em JS (no máximo ~50 linhas por marca e tipo) em vez de `ilike`, que trataria
      // `*`, `%` e `_` do nome como curingas.
      const { data, error } = await assets()
        .select('*')
        .eq('user_id', userId)
        .eq('brand_id', brandId)
        .eq('kind', kind);
      if (error) throw error;
      const target = name.toLowerCase();
      const row = (data ?? []).find((r: Row) => String(r.name).toLowerCase() === target);
      return row ? toAsset(row) : null;
    },
    async insertAsset(userId, input) {
      const { data, error } = await assets()
        .insert({
          user_id: userId,
          brand_id: input.brandId,
          kind: input.kind,
          name: input.name,
          data: input.data,
          analysis: input.analysis,
          photos: input.photos,
          pinned: input.pinned,
          last_used_at: input.lastUsedAt,
        })
        .select('*')
        .single();
      if (error) throw error;
      return toAsset(data);
    },
    async updateAsset(userId, assetId, patch) {
      const { data, error } = await assets()
        .update(assetPatchRow(patch))
        .eq('user_id', userId)
        .eq('id', assetId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? toAsset(data) : null;
    },
    async deleteAsset(userId, assetId) {
      const { error } = await assets().delete().eq('user_id', userId).eq('id', assetId);
      if (error) throw error;
    },

    async listPrompts(userId, brandId, query) {
      let request = prompts().select('*').eq('user_id', userId).eq('brand_id', brandId);
      if (query.favorite) request = request.eq('favorite', true);
      // `q` já chega higienizado (só letras, números e espaços); o cursor foi validado no serviço.
      const groups: string[] = [];
      if (query.q) groups.push(`or(title.ilike.*${query.q}*,product_name.ilike.*${query.q}*)`);
      if (query.before) {
        const { createdAt, id } = query.before;
        groups.push(`or(created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt.${id}))`);
      }
      if (groups.length > 0) request = request.or(`and(${groups.join(',')})`);
      const { data, error } = await request
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(query.limit);
      if (error) throw error;
      return (data ?? []).map(toPrompt);
    },
    async getPrompt(userId, promptId) {
      const { data, error } = await prompts().select('*').eq('user_id', userId).eq('id', promptId).maybeSingle();
      if (error) throw error;
      return data ? toPrompt(data) : null;
    },
    async insertPrompt(userId, input) {
      const row: Row = {
        user_id: userId,
        brand_id: input.brandId,
        mode: input.mode,
        agent: input.agent,
        title: input.title,
        product_name: input.productName,
        deterministic_prompt: input.deterministicPrompt,
        enhanced_prompt: input.enhancedPrompt,
        state: input.state,
        asset_ids: input.assetIds,
        legacy_id: input.legacyId,
      };
      if (input.createdAt) row.created_at = input.createdAt;
      const { data, error } = await prompts().insert(row).select('*').single();
      if (error) throw error;
      return toPrompt(data);
    },
    async setPromptFavorite(userId, promptId, favorite) {
      const { data, error } = await prompts()
        .update({ favorite })
        .eq('user_id', userId)
        .eq('id', promptId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? toPrompt(data) : null;
    },
    async deletePrompt(userId, promptId) {
      const { error } = await prompts().delete().eq('user_id', userId).eq('id', promptId);
      if (error) throw error;
    },
    async existingLegacyIds(userId, legacyIds) {
      if (legacyIds.length === 0) return [];
      const { data, error } = await prompts().select('legacy_id').eq('user_id', userId).in('legacy_id', legacyIds);
      if (error) throw error;
      return (data ?? []).map((r: Row) => r.legacy_id as string);
    },
    async deleteAllBrands(userId) {
      const { error } = await brands().delete().eq('user_id', userId);
      if (error) throw error;
    },
  };
}
