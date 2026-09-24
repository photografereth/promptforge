import { describe, it, expect } from 'vitest';
import { cleanKit, cleanName, cleanObject, cleanSearch, cleanText, isAllowedMime, isUuid } from './validate.js';

describe('cleanName', () => {
  it('apara espaços e aceita até 80 caracteres', () => {
    expect(cleanName('  Sérum X  ')).toBe('Sérum X');
    expect(cleanName('a'.repeat(80))).toBe('a'.repeat(80));
  });
  it('recusa vazio, longo demais e não-string', () => {
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('a'.repeat(81))).toBeNull();
    expect(cleanName(42)).toBeNull();
  });
});

describe('cleanObject', () => {
  it('aceita objeto simples dentro do limite', () => {
    expect(cleanObject({ nome: 'Sérum' }, 100)).toEqual({ nome: 'Sérum' });
  });
  it('recusa array, null, string e objeto acima do limite', () => {
    expect(cleanObject([1], 100)).toBeNull();
    expect(cleanObject(null, 100)).toBeNull();
    expect(cleanObject('x', 100)).toBeNull();
    expect(cleanObject({ texto: 'a'.repeat(200) }, 100)).toBeNull();
  });
});

describe('cleanText', () => {
  it('aceita texto dentro do limite e recusa vazio ou grande demais', () => {
    expect(cleanText('prompt', 10)).toBe('prompt');
    expect(cleanText('', 10)).toBeNull();
    expect(cleanText('a'.repeat(11), 10)).toBeNull();
  });
});

describe('cleanKit', () => {
  it('mantém só as chaves conhecidas', () => {
    expect(
      cleanKit({ autoApply: true, preferredAgent: 'ugc', preferredStyle: 'minimalista', extra: 'x' })
    ).toEqual({ autoApply: true, preferredAgent: 'ugc', preferredStyle: 'minimalista' });
  });
  it('recusa agente desconhecido, tipo errado e texto longo demais', () => {
    expect(cleanKit({ preferredAgent: 'hacker' })).toBeNull();
    expect(cleanKit({ autoApply: 'sim' })).toBeNull();
    expect(cleanKit({ preferredPalette: 'a'.repeat(201) })).toBeNull();
    expect(cleanKit('kit')).toBeNull();
  });
});

describe('cleanSearch', () => {
  it('remove caracteres que quebrariam o filtro do PostgREST', () => {
    expect(cleanSearch('sérum, (x)*"%')).toBe('sérum x');
  });
  it('devolve undefined quando nada sobra', () => {
    expect(cleanSearch(' ,() ')).toBeUndefined();
  });
});

describe('isAllowedMime / isUuid', () => {
  it('aceita só os tipos de imagem permitidos', () => {
    expect(isAllowedMime('image/webp')).toBe(true);
    expect(isAllowedMime('image/gif')).toBe(false);
  });
  it('reconhece UUID e recusa o resto', () => {
    expect(isUuid('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(true);
    expect(isUuid('1; drop table')).toBe(false);
    expect(isUuid(7)).toBe(false);
  });
});
