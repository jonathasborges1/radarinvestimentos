import { describe, it, expect } from 'vitest';
import { getAssetKey, getChangedFields, mergeAssets } from '../../../utils/assetKey';
import type { Asset } from '../../../types';

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    nickName: 'CRA FS BIO - JUL/2030',
    maturityDate: '2030-07-15T00:00:00',
    fee: 'Pré-fixado 12%',
    product: 'CRA',
    qualifiedInvestor: 'S',
    professionalInvestor: 'N',
    generalInvestor: 'N',
    indexers: 'Pré-fixado',
    incentive: 'S',
    ratingName: 'AAA',
    agencyName: 'Fitch',
    guaranteeFGC: false,
    redemptionType: 'Vencimento',
    code: 1001,
    quantityAvailable: 541,
    ...overrides,
  };
}

describe('getAssetKey', () => {
  it('builds a key from nickName + maturityDate + indexers', () => {
    const key = getAssetKey(
      makeAsset({
        nickName: 'CRA FS BIO - JUL/2030',
        maturityDate: '2030-07-15T00:00:00',
        indexers: 'Pré-fixado',
      })
    );
    expect(key).toBe('CRA FS BIO - JUL/2030|2030-07-15|PRÉ-FIXADO');
  });

  it('treats different casing as the same asset', () => {
    const a = getAssetKey(makeAsset({ nickName: 'cra fs bio - jul/2030', indexers: 'pré-fixado' }));
    const b = getAssetKey(makeAsset({ nickName: 'CRA FS BIO - JUL/2030', indexers: 'PRÉ-FIXADO' }));
    expect(a).toBe(b);
  });

  it('treats extra/internal whitespace as the same asset', () => {
    const a = getAssetKey(makeAsset({ nickName: '  CRA   FS   BIO - JUL/2030  ' }));
    const b = getAssetKey(makeAsset({ nickName: 'CRA FS BIO - JUL/2030' }));
    expect(a).toBe(b);
  });

  it('treats equivalent date representations as the same asset', () => {
    const a = getAssetKey(makeAsset({ maturityDate: '2030-07-15T00:00:00' }));
    const b = getAssetKey(makeAsset({ maturityDate: '2030-07-15' }));
    const c = getAssetKey(makeAsset({ maturityDate: '2030-07-15T00:00:00.000Z' }));
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('produces different keys when any identifier differs', () => {
    const base = getAssetKey(makeAsset());
    expect(base).not.toBe(getAssetKey(makeAsset({ nickName: 'OTHER' })));
    expect(base).not.toBe(getAssetKey(makeAsset({ maturityDate: '2031-07-15' })));
    expect(base).not.toBe(getAssetKey(makeAsset({ indexers: 'IPCA' })));
  });

  it('handles null/undefined values without throwing', () => {
    const key = getAssetKey({
      nickName: undefined as unknown as string,
      maturityDate: null,
      indexers: null,
    });
    expect(typeof key).toBe('string');
  });
});

describe('mergeAssets — initial upload', () => {
  it('adds every incoming asset when the existing list is empty', () => {
    const incoming = [makeAsset({ code: 1 }), makeAsset({ code: 2, nickName: 'OTHER' })];
    const result = mergeAssets([], incoming);

    expect(result.assets).toHaveLength(2);
    expect(result.added).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
  });
});

describe('mergeAssets — re-import of identical asset', () => {
  it('does not duplicate and counts as skipped', () => {
    const existing = [makeAsset({ code: 1, quantityAvailable: 541 })];
    const incoming = [makeAsset({ code: 1, quantityAvailable: 541 })];
    const result = mergeAssets(existing, incoming);

    expect(result.assets).toHaveLength(1);
    expect(result.added).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

describe('mergeAssets — quantityAvailable update', () => {
  it('updates a dynamic field on existing record without duplicating', () => {
    const existing = [makeAsset({ code: 1, quantityAvailable: 541 })];
    const incoming = [makeAsset({ code: 1, quantityAvailable: 300 })];
    const result = mergeAssets(existing, incoming);

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].quantityAvailable).toBe(300);
    expect(result.added).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
  });
});

describe('mergeAssets — manual field preservation', () => {
  it('preserves b3Code, fiduciaryAgentUrl and other user-edited fields', () => {
    const existing: Asset[] = [
      makeAsset({
        code: 1,
        quantityAvailable: 541,
        b3Code: 'B3-XYZ',
        fiduciaryAgentUrl: 'https://example.com/agent',
        notes: 'comprado em jan/2026',
        favorite: true,
        tags: ['imobiliário', 'high-yield'],
        trackingStatus: 'watching',
      }),
    ];
    const incoming = [makeAsset({ code: 1, quantityAvailable: 300 })];
    const result = mergeAssets(existing, incoming);

    expect(result.assets[0].quantityAvailable).toBe(300);
    expect(result.assets[0].b3Code).toBe('B3-XYZ');
    expect(result.assets[0].fiduciaryAgentUrl).toBe('https://example.com/agent');
    expect(result.assets[0].notes).toBe('comprado em jan/2026');
    expect(result.assets[0].favorite).toBe(true);
    expect(result.assets[0].tags).toEqual(['imobiliário', 'high-yield']);
    expect(result.assets[0].trackingStatus).toBe('watching');
    expect(result.updated).toBe(1);
  });

  it('does not let an incoming payload overwrite manual fields with empty values', () => {
    const existing: Asset[] = [makeAsset({ code: 1, b3Code: 'B3-XYZ' })];
    const incoming = [makeAsset({ code: 1, b3Code: '' as unknown as string })];
    const result = mergeAssets(existing, incoming);

    expect(result.assets[0].b3Code).toBe('B3-XYZ');
  });
});

describe('mergeAssets — adding a truly new asset', () => {
  it('appends a new asset whose key is not present', () => {
    const existing = [makeAsset({ code: 1, nickName: 'CRA FS BIO - JUL/2030' })];
    const incoming = [
      makeAsset({ code: 1, nickName: 'CRA FS BIO - JUL/2030' }),
      makeAsset({ code: 2, nickName: 'CRI ABC - DEZ/2031', maturityDate: '2031-12-15' }),
    ];
    const result = mergeAssets(existing, incoming);

    expect(result.assets).toHaveLength(2);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.assets[1].nickName).toBe('CRI ABC - DEZ/2031');
  });
});

describe('mergeAssets — normalization-tolerant matching', () => {
  it('matches across whitespace, case and equivalent date formats', () => {
    const existing = [
      makeAsset({
        nickName: 'CRA FS BIO - JUL/2030',
        maturityDate: '2030-07-15T00:00:00',
        indexers: 'Pré-fixado',
        quantityAvailable: 541,
        b3Code: 'B3-XYZ',
      }),
    ];
    const incoming = [
      makeAsset({
        nickName: '  cra   fs   bio - jul/2030 ',
        maturityDate: '2030-07-15',
        indexers: 'PRÉ-FIXADO',
        quantityAvailable: 300,
      }),
    ];
    const result = mergeAssets(existing, incoming);

    expect(result.assets).toHaveLength(1);
    expect(result.added).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.assets[0].quantityAvailable).toBe(300);
    expect(result.assets[0].b3Code).toBe('B3-XYZ');
  });
});

describe('mergeAssets — additional safety', () => {
  it('preserves order: existing first, new ones appended', () => {
    const existing = [
      makeAsset({ code: 1, nickName: 'A', maturityDate: '2030-01-01' }),
      makeAsset({ code: 2, nickName: 'B', maturityDate: '2030-01-02' }),
    ];
    const incoming = [
      makeAsset({ code: 99, nickName: 'C', maturityDate: '2030-01-03' }),
      makeAsset({ code: 1, nickName: 'A', maturityDate: '2030-01-01', quantityAvailable: 999 }),
    ];
    const result = mergeAssets(existing, incoming);

    expect(result.assets.map((a) => a.nickName)).toEqual(['A', 'B', 'C']);
    expect(result.added).toBe(1);
    expect(result.updated).toBe(1);
  });

  it('handles repeated keys in incoming: last one wins, only one record', () => {
    const incoming = [
      makeAsset({ code: 1, quantityAvailable: 100 }),
      makeAsset({ code: 1, quantityAvailable: 200 }),
      makeAsset({ code: 1, quantityAvailable: 300 }),
    ];
    const result = mergeAssets([], incoming);

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].quantityAvailable).toBe(300);
    expect(result.added).toBe(1);
    expect(result.updated + result.skipped).toBe(2);
  });

  it('does not mutate the original arrays', () => {
    const existing = [makeAsset({ code: 1, quantityAvailable: 541 })];
    const snapshot = JSON.parse(JSON.stringify(existing));
    mergeAssets(existing, [makeAsset({ code: 1, quantityAvailable: 300 })]);
    expect(existing).toEqual(snapshot);
  });
});

describe('getChangedFields', () => {
  it('returns only fields that actually differ', () => {
    const oldAsset = makeAsset({ code: 1, quantityAvailable: 541, puMinValue: 844.29 });
    const newAsset = makeAsset({ code: 1, quantityAvailable: 300, puMinValue: 842.10 });

    const changes = getChangedFields(oldAsset, newAsset);
    expect(changes.quantityAvailable).toEqual({ oldValue: 541, newValue: 300 });
    expect(changes.puMinValue).toEqual({ oldValue: 844.29, newValue: 842.10 });
    expect(changes.code).toBeUndefined();
    expect(changes.fee).toBeUndefined();
  });

  it('ignores manual fields (b3Code, notes, fiduciaryAgentUrl, ...)', () => {
    const oldAsset = makeAsset({ code: 1, b3Code: 'B3-OLD', notes: 'old note' });
    const newAsset = makeAsset({ code: 1, b3Code: 'B3-NEW', notes: 'new note' });

    const changes = getChangedFields(oldAsset, newAsset);
    expect(changes.b3Code).toBeUndefined();
    expect(changes.notes).toBeUndefined();
  });

  it('ignores app metadata (updatedFields, hasUnreadChanges)', () => {
    const oldAsset: Asset = makeAsset({ code: 1 });
    const newAsset: Asset = {
      ...makeAsset({ code: 1 }),
      updatedFields: { fee: { oldValue: 'a', newValue: 'b' } },
      hasUnreadChanges: true,
    };

    const changes = getChangedFields(oldAsset, newAsset);
    expect(changes.updatedFields).toBeUndefined();
    expect(changes.hasUnreadChanges).toBeUndefined();
  });

  it('returns empty object when nothing changed', () => {
    const a = makeAsset({ code: 1 });
    const b = makeAsset({ code: 1 });
    expect(getChangedFields(a, b)).toEqual({});
  });
});

describe('mergeAssets — updatedFields and unread flag', () => {
  it('attaches updatedFields with old/new pairs and sets hasUnreadChanges on updated assets', () => {
    const existing = [
      makeAsset({ code: 1, quantityAvailable: 541, puMinValue: 844.29 }),
    ];
    const incoming = [
      makeAsset({ code: 1, quantityAvailable: 300, puMinValue: 842.10 }),
    ];
    const result = mergeAssets(existing, incoming);

    expect(result.updated).toBe(1);
    expect(result.assets[0].hasUnreadChanges).toBe(true);
    expect(result.assets[0].updatedFields).toEqual({
      quantityAvailable: { oldValue: 541, newValue: 300 },
      puMinValue: { oldValue: 844.29, newValue: 842.10 },
    });
  });

  it('does not set updatedFields/hasUnreadChanges on truly new assets', () => {
    const incoming = [makeAsset({ code: 99, nickName: 'NEW' })];
    const result = mergeAssets([], incoming);

    expect(result.added).toBe(1);
    expect(result.assets[0].hasUnreadChanges).toBeUndefined();
    expect(result.assets[0].updatedFields).toBeUndefined();
  });

  it('strips stale meta from incoming brand-new assets', () => {
    const incoming: Asset[] = [
      {
        ...makeAsset({ code: 1, nickName: 'NEW' }),
        hasUnreadChanges: true,
        updatedFields: { fee: { oldValue: 'a', newValue: 'b' } },
      },
    ];
    const result = mergeAssets([], incoming);
    expect(result.assets[0].hasUnreadChanges).toBeUndefined();
    expect(result.assets[0].updatedFields).toBeUndefined();
  });

  it('produces a per-asset changesSummary for new/updated/unchanged', () => {
    const existing = [
      makeAsset({ code: 1, nickName: 'A', maturityDate: '2030-01-01', quantityAvailable: 100 }),
      makeAsset({ code: 2, nickName: 'B', maturityDate: '2030-01-02', quantityAvailable: 200 }),
    ];
    const incoming = [
      makeAsset({ code: 1, nickName: 'A', maturityDate: '2030-01-01', quantityAvailable: 999 }), // updated
      makeAsset({ code: 2, nickName: 'B', maturityDate: '2030-01-02', quantityAvailable: 200 }), // unchanged
      makeAsset({ code: 3, nickName: 'C', maturityDate: '2030-01-03' }), // new
    ];
    const result = mergeAssets(existing, incoming);

    const byNickName = (n: string) => result.changesSummary.find((s) => s.nickName === n)!;
    expect(byNickName('A').status).toBe('updated');
    expect(byNickName('A').changedFields?.quantityAvailable).toEqual({ oldValue: 100, newValue: 999 });
    expect(byNickName('B').status).toBe('unchanged');
    expect(byNickName('B').changedFields).toBeUndefined();
    expect(byNickName('C').status).toBe('new');
  });
});
