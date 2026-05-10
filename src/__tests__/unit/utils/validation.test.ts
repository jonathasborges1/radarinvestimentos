import { describe, it, expect } from 'vitest';
import { validateAssetFile } from '../../../utils/validation';

describe('validateAssetFile', () => {
  it('should accept a valid asset file with items', () => {
    const input = {
      data: [
        { code: 1, nickName: 'CRA Test', product: 'CRA', guaranteeFGC: false },
        { code: 'ABC', nickName: 'CRI Test', product: 'CRI', guaranteeFGC: true },
      ],
    };

    const result = validateAssetFile(input);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.assets).toHaveLength(2);
      expect(result.assets[0].code).toBe(1);
      expect(result.assets[1].nickName).toBe('CRI Test');
    }
  });

  it('should accept an empty data array as valid', () => {
    const result = validateAssetFile({ data: [] });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.assets).toHaveLength(0);
    }
  });

  it('should reject null input', () => {
    const result = validateAssetFile(null);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Estrutura incompatível: o arquivo deve conter a propriedade 'data'."
      );
    }
  });

  it('should reject non-object input (string)', () => {
    const result = validateAssetFile('not an object');

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Estrutura incompatível: o arquivo deve conter a propriedade 'data'."
      );
    }
  });

  it('should reject non-object input (number)', () => {
    const result = validateAssetFile(42);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Estrutura incompatível: o arquivo deve conter a propriedade 'data'."
      );
    }
  });

  it('should reject an array as input', () => {
    const result = validateAssetFile([1, 2, 3]);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Estrutura incompatível: o arquivo deve conter a propriedade 'data'."
      );
    }
  });

  it('should reject object without data property', () => {
    const result = validateAssetFile({ items: [] });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Estrutura incompatível: o arquivo deve conter a propriedade 'data'."
      );
    }
  });

  it('should reject when data is not an array (object)', () => {
    const result = validateAssetFile({ data: { code: 1 } });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Estrutura incompatível: a propriedade 'data' deve ser um array."
      );
    }
  });

  it('should reject when data is not an array (string)', () => {
    const result = validateAssetFile({ data: 'not an array' });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Estrutura incompatível: a propriedade 'data' deve ser um array."
      );
    }
  });

  it('should reject when data is null', () => {
    const result = validateAssetFile({ data: null });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Estrutura incompatível: a propriedade 'data' deve ser um array."
      );
    }
  });

  it('should reject item missing code field', () => {
    const result = validateAssetFile({
      data: [{ nickName: 'Test' }],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Ativo na posição 0 não possui o campo obrigatório 'code' ou 'nickName'."
      );
    }
  });

  it('should reject item missing nickName field', () => {
    const result = validateAssetFile({
      data: [{ code: 1 }],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Ativo na posição 0 não possui o campo obrigatório 'code' ou 'nickName'."
      );
    }
  });

  it('should reject item with null code', () => {
    const result = validateAssetFile({
      data: [{ code: null, nickName: 'Test' }],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Ativo na posição 0 não possui o campo obrigatório 'code' ou 'nickName'."
      );
    }
  });

  it('should reject item with null nickName', () => {
    const result = validateAssetFile({
      data: [{ code: 1, nickName: null }],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Ativo na posição 0 não possui o campo obrigatório 'code' ou 'nickName'."
      );
    }
  });

  it('should report the correct position for invalid items', () => {
    const result = validateAssetFile({
      data: [
        { code: 1, nickName: 'Valid' },
        { code: 2, nickName: 'Also Valid' },
        { nickName: 'Missing code' },
      ],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Ativo na posição 2 não possui o campo obrigatório 'code' ou 'nickName'."
      );
    }
  });

  it('should reject non-object items in data array', () => {
    const result = validateAssetFile({
      data: ['not an object'],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Ativo na posição 0 não possui o campo obrigatório 'code' ou 'nickName'."
      );
    }
  });

  it('should reject null items in data array', () => {
    const result = validateAssetFile({
      data: [null],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        "Ativo na posição 0 não possui o campo obrigatório 'code' ou 'nickName'."
      );
    }
  });

  it('should preserve extra fields on valid assets', () => {
    const input = {
      data: [
        {
          code: 1,
          nickName: 'Test',
          guaranteeFGC: true,
          customField: 'extra',
        },
      ],
    };

    const result = validateAssetFile(input);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect((result.assets[0] as Record<string, unknown>).customField).toBe('extra');
    }
  });
});
