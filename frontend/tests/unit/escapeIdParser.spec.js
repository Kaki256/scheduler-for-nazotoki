import { describe, it, expect } from 'vitest';
import {
  parseEventName,
  parseDateRange,
  parseLocationUid,
  parseLocationInfo,
  parseMaxParticipants,
  parseEstimatedTime,
} from '../../src/utils/escapeIdParser.js';

// ============================================================
// Mock data: New ESCAPE.id structure (2026~)
// ============================================================
const newStructure = {
  eventName: [0, '謎まみれX'],
  maxParticipants: [0, 4],
  estimatedTime: [0, '通常80〜90分/ロングタイム100〜110分'],
  locations: [
    1,
    [
      [
        0,
        {
          uid: [0, 'Jb8cLw9Tw4Mp'],
          name: [0, 'タンブルウィード ヒラメカ下北沢'],
          address: [0, '東京都世田谷区北沢2-12-2 サウスウェーブ下北沢3F'],
          periods: [
            1,
            [
              [
                0,
                {
                  startDate: [3, '2026-09-04T04:10:00.000Z'],
                  endDate: [3, '2026-10-04T11:50:00.000Z'],
                },
              ],
            ],
          ],
        },
      ],
    ],
  ],
  periods: [
    1,
    [
      [
        0,
        {
          startDate: [3, '2026-09-04T04:10:00.000Z'],
          endDate: [3, '2026-10-04T11:50:00.000Z'],
        },
      ],
    ],
  ],
};

// ============================================================
// Mock data: Old ESCAPE.id structure (legacy)
// ============================================================
const oldStructure = {
  eventName: [0, '旧イベント名'],
  maxParticipants: [0, 6],
  estimatedTime: [0, '60分'],
  activeSlotGroups: [
    1,
    [
      [
        0,
        {
          firstStartTime: [1, '2025-01-10T04:00:00.000Z'],
          lastEndTime: [1, '2025-03-20T12:00:00.000Z'],
          location: [
            1,
            {
              uid: [0, 'OldLocationUid123'],
              name: [0, '旧会場名'],
              address: [0, '旧住所'],
            },
          ],
        },
      ],
    ],
  ],
  visibleLocations: [
    1,
    [
      [
        0,
        {
          uid: [0, 'VisibleLocUid456'],
          name: [0, '旧可視会場'],
          address: [0, '旧可視住所'],
          firstStartTime: [1, '2025-02-01T04:00:00.000Z'],
          lastEndTime: [1, '2025-04-01T12:00:00.000Z'],
        },
      ],
    ],
  ],
};

// ============================================================
// Mock data: Empty / minimal structure
// ============================================================
const emptyStructure = {};

// ============================================================
// 1. parseEventName
// ============================================================
describe('parseEventName', () => {
  it('should extract event name from new structure', () => {
    expect(parseEventName(newStructure)).toBe('謎まみれX');
  });

  it('should extract event name from old structure', () => {
    expect(parseEventName(oldStructure)).toBe('旧イベント名');
  });

  it('should return null for empty structure', () => {
    expect(parseEventName(emptyStructure)).toBeNull();
  });

  it('should return null for null/undefined input', () => {
    expect(parseEventName(null)).toBeNull();
    expect(parseEventName(undefined)).toBeNull();
  });
});

// ============================================================
// 2. parseDateRange
// ============================================================
describe('parseDateRange', () => {
  it('should extract date range from new structure (periods)', () => {
    const result = parseDateRange(newStructure);
    expect(result.startDate).toBe('2026-09-04T04:10:00.000Z');
    expect(result.endDate).toBe('2026-10-04T11:50:00.000Z');
  });

  it('should extract date range from old structure (activeSlotGroups firstStartTime/lastEndTime)', () => {
    const result = parseDateRange(oldStructure);
    // Should use earliest start and latest end across all sources
    expect(result.startDate).toBeTruthy();
    expect(result.endDate).toBeTruthy();
    // The earliest start from oldStructure activeSlotGroups is 2025-01-10
    expect(new Date(result.startDate).getTime()).toBeLessThanOrEqual(
      new Date('2025-01-10T04:00:00.000Z').getTime(),
    );
    // The latest end from visibleLocations is 2025-04-01
    expect(new Date(result.endDate).getTime()).toBeGreaterThanOrEqual(
      new Date('2025-04-01T12:00:00.000Z').getTime(),
    );
  });

  it('should return nulls for empty structure', () => {
    const result = parseDateRange(emptyStructure);
    expect(result.startDate).toBeNull();
    expect(result.endDate).toBeNull();
  });

  it('should return nulls for null input', () => {
    const result = parseDateRange(null);
    expect(result.startDate).toBeNull();
    expect(result.endDate).toBeNull();
  });
});

// ============================================================
// 3. parseLocationUid
// ============================================================
describe('parseLocationUid', () => {
  it('should extract location UID from new structure (locations)', () => {
    expect(parseLocationUid(newStructure)).toBe('Jb8cLw9Tw4Mp');
  });

  it('should extract location UID from old structure (activeSlotGroups)', () => {
    expect(parseLocationUid(oldStructure)).toBe('OldLocationUid123');
  });

  it('should fallback to visibleLocations when activeSlotGroups has no location', () => {
    const onlyVisibleLocations = {
      visibleLocations: oldStructure.visibleLocations,
    };
    expect(parseLocationUid(onlyVisibleLocations)).toBe('VisibleLocUid456');
  });

  it('should return null for empty structure', () => {
    expect(parseLocationUid(emptyStructure)).toBeNull();
  });

  it('should return null for null input', () => {
    expect(parseLocationUid(null)).toBeNull();
  });
});

// ============================================================
// 4. parseLocationInfo
// ============================================================
describe('parseLocationInfo', () => {
  it('should extract name and address from new structure (locations)', () => {
    const result = parseLocationInfo(newStructure);
    expect(result.name).toBe('タンブルウィード ヒラメカ下北沢');
    expect(result.address).toBe('東京都世田谷区北沢2-12-2 サウスウェーブ下北沢3F');
  });

  it('should extract name and address from old structure (activeSlotGroups.location)', () => {
    const result = parseLocationInfo(oldStructure);
    expect(result.name).toBe('旧会場名');
    expect(result.address).toBe('旧住所');
  });

  it('should fallback to visibleLocations when activeSlotGroups has no location', () => {
    const onlyVisibleLocations = {
      visibleLocations: oldStructure.visibleLocations,
    };
    const result = parseLocationInfo(onlyVisibleLocations);
    expect(result.name).toBe('旧可視会場');
    expect(result.address).toBe('旧可視住所');
  });

  it('should return nulls for empty structure', () => {
    const result = parseLocationInfo(emptyStructure);
    expect(result.name).toBeNull();
    expect(result.address).toBeNull();
  });

  it('should return nulls for null input', () => {
    const result = parseLocationInfo(null);
    expect(result.name).toBeNull();
    expect(result.address).toBeNull();
  });
});

// ============================================================
// 5. parseMaxParticipants
// ============================================================
describe('parseMaxParticipants', () => {
  it('should extract maxParticipants from structure', () => {
    expect(parseMaxParticipants(newStructure)).toBe(4);
  });

  it('should return null for empty structure', () => {
    expect(parseMaxParticipants(emptyStructure)).toBeNull();
  });

  it('should return null for null input', () => {
    expect(parseMaxParticipants(null)).toBeNull();
  });
});

// ============================================================
// 6. parseEstimatedTime
// ============================================================
describe('parseEstimatedTime', () => {
  it('should extract estimatedTime as string from structure', () => {
    expect(parseEstimatedTime(newStructure)).toBe('通常80〜90分/ロングタイム100〜110分');
  });

  it('should return null for empty structure', () => {
    expect(parseEstimatedTime(emptyStructure)).toBeNull();
  });

  it('should return null for null input', () => {
    expect(parseEstimatedTime(null)).toBeNull();
  });
});
