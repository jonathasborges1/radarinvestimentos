import { describe, it, expect } from 'vitest';
import {
  addToUploadHistory,
  buildUploadHistoryItem,
  mergeAssets,
  MAX_UPLOAD_HISTORY,
} from '../../../utils/assetKey';
import { assetReducer } from '../../../context/AssetContext';
import type { Asset, AssetState, UploadHistoryItem } from '../../../types';

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

function makeHistoryItem(overrides: Partial<UploadHistoryItem> = {}): UploadHistoryItem {
  return {
    id: `id-${Math.random().toString(36).slice(2, 10)}`,
    fileName: 'file.json',
    uploadedAt: new Date().toISOString(),
    totalRecords: 1,
    newRecords: 1,
    updatedRecords: 0,
    unchangedRecords: 0,
    originalJson: [makeAsset()],
    changesSummary: [],
    ...overrides,
  };
}

const emptyState: AssetState = {
  status: 'empty',
  assets: [],
  originalAssets: [],
  errorMessage: null,
  hasUnsavedChanges: false,
  uploadHistory: [],
};

describe('addToUploadHistory', () => {
  it('prepends new uploads (most recent first)', () => {
    const a = makeHistoryItem({ id: 'a', fileName: 'a.json' });
    const b = makeHistoryItem({ id: 'b', fileName: 'b.json' });
    const c = makeHistoryItem({ id: 'c', fileName: 'c.json' });

    let history: UploadHistoryItem[] = [];
    history = addToUploadHistory(history, a);
    history = addToUploadHistory(history, b);
    history = addToUploadHistory(history, c);

    expect(history.map((h) => h.id)).toEqual(['c', 'b', 'a']);
  });

  it('caps history at MAX_UPLOAD_HISTORY (30) items', () => {
    expect(MAX_UPLOAD_HISTORY).toBe(30);

    let history: UploadHistoryItem[] = [];
    for (let i = 0; i < 35; i++) {
      history = addToUploadHistory(history, makeHistoryItem({ id: `id-${i}` }));
    }

    expect(history).toHaveLength(30);
    // Most recent first → ids 34..5
    expect(history[0].id).toBe('id-34');
    expect(history[history.length - 1].id).toBe('id-5');
  });

  it('drops the oldest entry when adding the 31st upload', () => {
    let history: UploadHistoryItem[] = [];
    for (let i = 0; i < 30; i++) {
      history = addToUploadHistory(history, makeHistoryItem({ id: `id-${i}` }));
    }
    expect(history.find((h) => h.id === 'id-0')).toBeDefined();

    history = addToUploadHistory(history, makeHistoryItem({ id: 'id-30' }));
    expect(history).toHaveLength(30);
    expect(history.find((h) => h.id === 'id-0')).toBeUndefined();
    expect(history[0].id).toBe('id-30');
  });
});

describe('buildUploadHistoryItem', () => {
  it('captures fileName, totals and the original JSON snapshot', () => {
    const incoming = [makeAsset({ code: 1 }), makeAsset({ code: 2, nickName: 'OTHER' })];
    const merge = mergeAssets([], incoming);
    const item = buildUploadHistoryItem({
      fileName: 'positions.json',
      incomingAssets: incoming,
      mergeResult: merge,
    });

    expect(item.fileName).toBe('positions.json');
    expect(item.totalRecords).toBe(2);
    expect(item.newRecords).toBe(2);
    expect(item.updatedRecords).toBe(0);
    expect(item.unchangedRecords).toBe(0);
    expect(item.originalJson).toHaveLength(2);
    expect(item.changesSummary).toHaveLength(2);
    expect(item.id).toBeTruthy();
    expect(item.uploadedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('strips internal meta from the snapshot of original JSON', () => {
    const incoming: Asset[] = [
      {
        ...makeAsset({ code: 1 }),
        hasUnreadChanges: true,
        updatedFields: { fee: { oldValue: 'a', newValue: 'b' } },
      },
    ];
    const merge = mergeAssets([], incoming);
    const item = buildUploadHistoryItem({
      fileName: 'x.json',
      incomingAssets: incoming,
      mergeResult: merge,
    });

    expect(item.originalJson[0].hasUnreadChanges).toBeUndefined();
    expect(item.originalJson[0].updatedFields).toBeUndefined();
  });
});

describe('assetReducer — MERGE_ASSETS appends history with auto-trim', () => {
  function pretendUpload(state: AssetState, idx: number): AssetState {
    const incoming = [makeAsset({ code: idx, nickName: `N-${idx}`, maturityDate: `2030-01-${(idx % 28) + 1}` })];
    const merge = mergeAssets(state.assets, incoming);
    const historyItem = buildUploadHistoryItem({
      fileName: `f-${idx}.json`,
      incomingAssets: incoming,
      mergeResult: merge,
    });
    return assetReducer(state, {
      type: 'MERGE_ASSETS',
      payload: {
        assets: merge.assets,
        added: merge.added,
        updated: merge.updated,
        skipped: merge.skipped,
        historyItem,
      },
    });
  }

  it('adds one history item per upload and never goes above 30', () => {
    let state = emptyState;
    for (let i = 0; i < 35; i++) {
      state = pretendUpload(state, i);
    }
    expect(state.uploadHistory).toHaveLength(30);
    expect(state.uploadHistory[0].fileName).toBe('f-34.json');
  });
});

describe('assetReducer — MARK_ASSET_READ', () => {
  it('clears hasUnreadChanges only on the matching asset', () => {
    const incoming = [
      makeAsset({ code: 1, nickName: 'A', quantityAvailable: 100 }),
      makeAsset({ code: 2, nickName: 'B', quantityAvailable: 200 }),
    ];
    const firstUpload = mergeAssets([], incoming);
    const item = buildUploadHistoryItem({
      fileName: 'first.json',
      incomingAssets: incoming,
      mergeResult: firstUpload,
    });
    let state = assetReducer(emptyState, {
      type: 'MERGE_ASSETS',
      payload: { ...firstUpload, historyItem: item },
    });

    // Second upload changes both assets
    const secondIncoming = [
      makeAsset({ code: 1, nickName: 'A', quantityAvailable: 111 }),
      makeAsset({ code: 2, nickName: 'B', quantityAvailable: 222 }),
    ];
    const secondMerge = mergeAssets(state.assets, secondIncoming);
    const secondItem = buildUploadHistoryItem({
      fileName: 'second.json',
      incomingAssets: secondIncoming,
      mergeResult: secondMerge,
    });
    state = assetReducer(state, {
      type: 'MERGE_ASSETS',
      payload: { ...secondMerge, historyItem: secondItem },
    });

    const a = state.assets.find((x) => x.nickName === 'A')!;
    const b = state.assets.find((x) => x.nickName === 'B')!;
    expect(a.hasUnreadChanges).toBe(true);
    expect(b.hasUnreadChanges).toBe(true);

    // Open A's modal — clears only A's flag
    const aKey = `A|2030-07-15|PRÉ-FIXADO`;
    state = assetReducer(state, { type: 'MARK_ASSET_READ', payload: { key: aKey } });

    const aAfter = state.assets.find((x) => x.nickName === 'A')!;
    const bAfter = state.assets.find((x) => x.nickName === 'B')!;
    expect(aAfter.hasUnreadChanges).toBe(false);
    expect(bAfter.hasUnreadChanges).toBe(true);

    // updatedFields is preserved so the modal can still show the diff
    expect(aAfter.updatedFields).toBeDefined();
    expect(aAfter.updatedFields?.quantityAvailable).toEqual({ oldValue: 100, newValue: 111 });
  });

  it('does not flip hasUnsavedChanges when marking an asset as read', () => {
    const incoming = [makeAsset({ code: 1, quantityAvailable: 100 })];
    let state = assetReducer(emptyState, {
      type: 'MERGE_ASSETS',
      payload: {
        ...mergeAssets([], incoming),
        historyItem: buildUploadHistoryItem({
          fileName: 'x.json',
          incomingAssets: incoming,
          mergeResult: mergeAssets([], incoming),
        }),
      },
    });
    state = { ...state, hasUnsavedChanges: false, originalAssets: state.assets.map((a) => ({ ...a })) };

    // Trigger an update so the asset has hasUnreadChanges
    const second = [makeAsset({ code: 1, quantityAvailable: 200 })];
    const m = mergeAssets(state.assets, second);
    state = assetReducer(state, {
      type: 'MERGE_ASSETS',
      payload: {
        ...m,
        historyItem: buildUploadHistoryItem({ fileName: 'y.json', incomingAssets: second, mergeResult: m }),
      },
    });
    expect(state.assets[0].hasUnreadChanges).toBe(true);

    // Marking read must NOT mark the dataset as unsaved on its own.
    const before = state.hasUnsavedChanges;
    const key = `${state.assets[0].nickName.toUpperCase()}|2030-07-15|PRÉ-FIXADO`;
    state = assetReducer(state, { type: 'MARK_ASSET_READ', payload: { key } });
    expect(state.hasUnsavedChanges).toBe(before);
  });
});
