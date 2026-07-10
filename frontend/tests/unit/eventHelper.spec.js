import { describe, it, expect } from 'vitest';
import {
  getTodayStr,
  formatDate,
  extractEventName,
  filterEventsByViewMode,
  sortEvents,
} from '../../src/utils/eventHelper.js';

// ============================================================
// 1. getTodayStr
// ============================================================
describe('getTodayStr', () => {
  it('should return YYYY-MM-DD for a given Date object', () => {
    const date = new Date(2025, 6, 10); // July 10, 2025 (month is 0-indexed)
    expect(getTodayStr(date)).toBe('2025-07-10');
  });

  it('should zero-pad single-digit months and days', () => {
    const date = new Date(2025, 0, 5); // January 5, 2025
    expect(getTodayStr(date)).toBe('2025-01-05');
  });

  it('should return a string when called without arguments (uses current date)', () => {
    const result = getTodayStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ============================================================
// 2. formatDate
// ============================================================
describe('formatDate', () => {
  it('should return "未設定" for null or undefined input', () => {
    expect(formatDate(null)).toBe('未設定');
    expect(formatDate(undefined)).toBe('未設定');
    expect(formatDate('')).toBe('未設定');
  });

  it('should format a YYYY-MM-DD string to "YYYY年M月D日" (UTC)', () => {
    expect(formatDate('2025-07-10')).toBe('2025年7月10日');
  });

  it('should not zero-pad month or day in the output', () => {
    expect(formatDate('2025-01-05')).toBe('2025年1月5日');
  });

  it('should return the original string for unparseable dates', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

// ============================================================
// 3. extractEventName
// ============================================================
describe('extractEventName', () => {
  it('should extract the last path segment from a valid URL', () => {
    const result = extractEventName('https://example.com/events/my-event/');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('should replace hyphens and underscores with spaces', () => {
    const result = extractEventName('https://example.com/org/my-cool_event/');
    expect(result).toContain(' ');
    expect(result).not.toContain('-');
    expect(result).not.toContain('_');
  });

  it('should return "イベント" for an invalid URL', () => {
    expect(extractEventName('not-a-url')).toBe('イベント');
  });

  it('should return "イベント" for a URL with no path segments', () => {
    expect(extractEventName('https://example.com/')).toBe('イベント');
  });
});

// ============================================================
// 4. filterEventsByViewMode
// ============================================================
describe('filterEventsByViewMode', () => {
  const today = '2025-07-10';

  const events = [
    { id: 1, name: 'Future Event', endDate: '2025-08-01' },
    { id: 2, name: 'Past Event', endDate: '2025-06-01' },
    { id: 3, name: 'No End Date', endDate: null },
    { id: 4, name: 'Today Ending', endDate: '2025-07-10' },
  ];

  describe('active mode', () => {
    it('should include events with no endDate', () => {
      const result = filterEventsByViewMode(events, 'active', today);
      expect(result.find((e) => e.id === 3)).toBeTruthy();
    });

    it('should include events whose endDate is today or later', () => {
      const result = filterEventsByViewMode(events, 'active', today);
      expect(result.find((e) => e.id === 1)).toBeTruthy(); // future
      expect(result.find((e) => e.id === 4)).toBeTruthy(); // today
    });

    it('should exclude events whose endDate is before today', () => {
      const result = filterEventsByViewMode(events, 'active', today);
      expect(result.find((e) => e.id === 2)).toBeFalsy();
    });
  });

  describe('archive mode', () => {
    it('should include only events whose endDate is before today', () => {
      const result = filterEventsByViewMode(events, 'archive', today);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it('should exclude events with no endDate', () => {
      const result = filterEventsByViewMode(events, 'archive', today);
      expect(result.find((e) => e.id === 3)).toBeFalsy();
    });

    it('should exclude events whose endDate is today or later', () => {
      const result = filterEventsByViewMode(events, 'archive', today);
      expect(result.find((e) => e.id === 1)).toBeFalsy();
      expect(result.find((e) => e.id === 4)).toBeFalsy();
    });
  });
});

// ============================================================
// 5. sortEvents
// ============================================================
describe('sortEvents', () => {
  describe('archive mode', () => {
    it('should sort by startDate descending (newest first)', () => {
      const events = [
        { id: 1, startDate: '2025-05-01' },
        { id: 2, startDate: '2025-07-01' },
        { id: 3, startDate: '2025-06-01' },
      ];
      const result = sortEvents(events, 'archive');
      expect(result.map((e) => e.id)).toEqual([2, 3, 1]);
    });

    it('should handle events with null startDate gracefully', () => {
      const events = [
        { id: 1, startDate: '2025-05-01' },
        { id: 2, startDate: null },
      ];
      const result = sortEvents(events, 'archive');
      expect(result).toHaveLength(2);
    });
  });

  describe('active mode', () => {
    it('should prioritize events where user has NOT submitted (false first)', () => {
      const events = [
        { id: 1, hasCurrentUserSubmittedStatus: true, startDate: '2025-07-01' },
        { id: 2, hasCurrentUserSubmittedStatus: false, startDate: '2025-06-01' },
      ];
      const result = sortEvents(events, 'active');
      expect(result[0].id).toBe(2); // not submitted → first
    });

    it('should sort by startDate descending within the same submission status', () => {
      const events = [
        { id: 1, hasCurrentUserSubmittedStatus: false, startDate: '2025-05-01' },
        { id: 2, hasCurrentUserSubmittedStatus: false, startDate: '2025-07-01' },
      ];
      const result = sortEvents(events, 'active');
      expect(result[0].id).toBe(2); // newer date first
    });

    it('should sort by event name ascending as a tiebreaker', () => {
      const events = [
        { id: 1, hasCurrentUserSubmittedStatus: true, startDate: '2025-07-01', name: 'Beta' },
        { id: 2, hasCurrentUserSubmittedStatus: true, startDate: '2025-07-01', name: 'Alpha' },
      ];
      const result = sortEvents(events, 'active');
      expect(result[0].id).toBe(2); // "Alpha" < "Beta"
    });

    it('should not mutate the original array', () => {
      const events = [
        { id: 1, startDate: '2025-07-01' },
        { id: 2, startDate: '2025-05-01' },
      ];
      const original = [...events];
      sortEvents(events, 'active');
      expect(events).toEqual(original);
    });
  });
});
