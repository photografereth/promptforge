import { describe, it, expect } from 'vitest';
import { kitFromPreferences, preferencesFromKit, toImportItems } from './historyImport';
import type { PromptHistoryItem } from '../../types';

const item = (extra: Partial<PromptHistoryItem> = {}): PromptHistoryItem => ({
  id: '1', timestamp: 1700000000000, mode: 'video', title: 'Sérum (UGC)', deterministicPrompt: 'p',
  videoState: { agent: 'pov', product: { nome: 'Sérum', categoria: '', caracteristicasVisuais: '', beneficioVisual: '' } } as PromptHistoryItem['videoState'],
  ...extra,
});

describe('toImportItems', () => {
  it('leva agente e nome do produto do estado salvo', () => {
    expect(toImportItems([item()])[0]).toMatchObject({ id: '1', mode: 'video', agent: 'pov', productName: 'Sérum', title: 'Sérum (UGC)' });
  });
  it('corta nome do produto em 80 e título em 200 em vez de perder o item', () => {
    const long = item({
      title: 't'.repeat(250),
      videoState: { agent: 'ugc', product: { nome: 'n'.repeat(120), categoria: '', caracteristicasVisuais: '', beneficioVisual: '' } } as PromptHistoryItem['videoState'],
    });
    const [out] = toImportItems([long]);
    expect((out.productName as string).length).toBe(80);
    expect((out.title as string).length).toBe(200);
  });
  it('omite nome de produto vazio', () => {
    const empty = item({ videoState: { agent: 'ugc', product: { nome: '  ', categoria: '', caracteristicasVisuais: '', beneficioVisual: '' } } as PromptHistoryItem['videoState'] });
    expect(toImportItems([empty])[0].productName).toBeUndefined();
  });
});

describe('kit ↔ preferências', () => {
  it('descarta textos vazios e volta ao formato de preferências', () => {
    const kit = kitFromPreferences({ autoApply: true, preferredAgent: 'ugc', preferredStyle: 'Cinema', preferredPalette: ' ', preferredCamera: '' });
    expect(kit).toEqual({ autoApply: true, preferredAgent: 'ugc', preferredStyle: 'Cinema' });
    expect(preferencesFromKit(kit)).toEqual({ autoApply: true, preferredAgent: 'ugc', preferredStyle: 'Cinema', preferredPalette: '', preferredCamera: '' });
  });
});
