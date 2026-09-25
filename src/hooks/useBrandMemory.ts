import { useCallback, useEffect, useRef, useState } from 'react';
import { memoryApi } from '../lib/memoryApi';
import type { Brand, BrandKit, MemoryAsset } from '../lib/memory/types';

const STORAGE_KEY_BRAND = 'flow_prompt_forge_brand_v1';

function readStoredBrand(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_BRAND);
  } catch {
    return null;
  }
}

function storeBrand(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY_BRAND, id);
    else localStorage.removeItem(STORAGE_KEY_BRAND);
  } catch {
    // Navegador sem localStorage: a escolha vale só nesta sessão.
  }
}

// `enabled` = logado e com acesso. A marca guardada no navegador pode ser de outra conta
// ou já apagada: nesse caso cai na marca padrão.
export function useBrandMemory(enabled: boolean) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState<string | null>(readStoredBrand);
  const [assets, setAssets] = useState<MemoryAsset[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const currentBrand = brands.find((b) => b.id === brandId) ?? brands.find((b) => b.isDefault) ?? brands[0] ?? null;
  const currentBrandId = currentBrand?.id ?? null;

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      const { brands: list } = await memoryApi.listBrands();
      setBrands(list);
      setStatus(list.length > 0 ? 'ready' : 'error');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void reload();
    } else {
      setBrands([]);
      setAssets([]);
      setStatus('idle');
    }
  }, [enabled, reload]);

  // A marca atual fica num ref: refreshAssets lê sempre a de agora (inclusive quando chamado por um
  // salvamento que começou em outra marca) e descarta respostas que chegam depois de uma troca.
  const brandRef = useRef<string | null>(currentBrandId);
  brandRef.current = currentBrandId;

  const refreshAssets = useCallback(async () => {
    const requested = brandRef.current;
    if (!requested) {
      setAssets([]);
      return;
    }
    try {
      const { assets: list } = await memoryApi.listAssets(requested);
      if (brandRef.current === requested) setAssets(list);
    } catch {
      // A lista anterior continua na tela.
    }
  }, []);

  useEffect(() => {
    setAssets([]); // nunca mostrar itens da marca anterior enquanto a nova carrega
    void refreshAssets();
  }, [currentBrandId, refreshAssets]);

  const selectBrand = (id: string) => {
    setBrandId(id);
    storeBrand(id);
  };

  const createBrand = async (name: string) => {
    const { brand } = await memoryApi.createBrand(name);
    setBrands((prev) => [...prev, brand]);
    selectBrand(brand.id);
    return brand;
  };

  const renameBrand = async (id: string, name: string) => {
    const { brand } = await memoryApi.updateBrand(id, { name });
    setBrands((prev) => prev.map((b) => (b.id === id ? brand : b)));
  };

  const deleteBrand = async (id: string) => {
    await memoryApi.deleteBrand(id);
    if (id === brandId) {
      setBrandId(null);
      storeBrand(null);
    }
    await reload();
  };

  const saveKit = async (kit: BrandKit) => {
    if (!currentBrandId) return;
    const { brand } = await memoryApi.updateBrand(currentBrandId, { kit });
    setBrands((prev) => prev.map((b) => (b.id === brand.id ? brand : b)));
  };

  const setPinned = async (asset: MemoryAsset, pinned: boolean) => {
    try {
      await memoryApi.updateAsset(asset.id, { pinned });
    } finally {
      await refreshAssets();
    }
  };

  const removeAsset = async (asset: MemoryAsset) => {
    await memoryApi.deleteAsset(asset.id);
    await refreshAssets();
  };

  return {
    status,
    brands,
    currentBrand,
    assets,
    reload,
    selectBrand,
    createBrand,
    renameBrand,
    deleteBrand,
    saveKit,
    refreshAssets,
    setPinned,
    removeAsset,
  };
}

export type BrandMemory = ReturnType<typeof useBrandMemory>;
