import type { PromptHistoryItem, UserPreferences } from '../../types';
import type { BrandKit } from './types';

const clip = (value: string | undefined, max: number): string | undefined => {
  const text = value?.trim();
  return text ? text.slice(0, max) : undefined;
};

// Formato aceito por /api/memory/import-local; corta nos limites do backend em vez de perder o item.
export function toImportItems(history: PromptHistoryItem[]): Record<string, unknown>[] {
  return history.slice(0, 50).map((item) => {
    const state = item.videoState ?? item.imageState;
    return {
      id: item.id,
      timestamp: item.timestamp,
      mode: item.mode,
      agent: item.videoState?.agent ?? item.imageState?.agent ?? item.agent,
      productName: clip(state?.product?.nome ?? item.productName, 80),
      title: clip(item.title, 200),
      deterministicPrompt: item.deterministicPrompt,
      enhancedPrompt: item.enhancedPrompt,
      videoState: item.videoState,
      imageState: item.imageState,
    };
  });
}

export function kitFromPreferences(prefs: UserPreferences): BrandKit {
  const kit: BrandKit = { autoApply: Boolean(prefs.autoApply) };
  if (prefs.preferredAgent) kit.preferredAgent = prefs.preferredAgent;
  for (const key of ['preferredStyle', 'preferredPalette', 'preferredCamera'] as const) {
    const text = prefs[key];
    if (typeof text === 'string' && text.trim()) kit[key] = text.slice(0, 200);
  }
  return kit;
}

export function preferencesFromKit(kit: BrandKit): UserPreferences {
  return {
    autoApply: kit.autoApply ?? false,
    preferredAgent: kit.preferredAgent,
    preferredStyle: kit.preferredStyle ?? '',
    preferredPalette: kit.preferredPalette ?? '',
    preferredCamera: kit.preferredCamera ?? '',
  };
}
