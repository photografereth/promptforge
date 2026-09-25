import { describe, it, expect } from 'vitest';
import { assetName, characterFromData, productFromData } from './assetForm';

describe('assetForm', () => {
  it('monta a ficha do produto, com vazio no que faltar ou não for texto', () => {
    expect(productFromData({ nome: 'Sérum', categoria: 3 })).toEqual({ nome: 'Sérum', categoria: '', caracteristicasVisuais: '', beneficioVisual: '' });
  });
  it('monta a ficha da criadora', () => {
    expect(characterFromData({ cabelo: 'cacheado' })).toEqual({ nomeOuDescricao: '', caracteristicasFisicas: '', cabelo: 'cacheado', estiloVestuario: '', expressaoMarcante: '' });
  });
  it('nome do item: apara e corta em 80', () => {
    expect(assetName('  Sérum X  ')).toBe('Sérum X');
    expect(assetName('a'.repeat(90) + ' fim')).toHaveLength(80);
  });
});
