import type { CharacterAnchor, ProductAnchor } from '../../types';

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export function assetName(value: string): string {
  return value.trim().slice(0, 80).trim();
}

export function productFromData(data: Record<string, unknown>): ProductAnchor {
  return {
    nome: text(data.nome),
    categoria: text(data.categoria),
    caracteristicasVisuais: text(data.caracteristicasVisuais),
    beneficioVisual: text(data.beneficioVisual),
  };
}

export function characterFromData(data: Record<string, unknown>): CharacterAnchor {
  return {
    nomeOuDescricao: text(data.nomeOuDescricao),
    caracteristicasFisicas: text(data.caracteristicasFisicas),
    cabelo: text(data.cabelo),
    estiloVestuario: text(data.estiloVestuario),
    expressaoMarcante: text(data.expressaoMarcante),
  };
}
