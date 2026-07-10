/**
 * Pure utility functions for event list filtering, sorting, and formatting.
 * Extracted from EventListPage.vue for testability and reuse.
 */

/**
 * Returns the local date as a YYYY-MM-DD string.
 * @param {Date} [date=new Date()] - The date to format.
 * @returns {string} Date in YYYY-MM-DD format.
 */
export function getTodayStr(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a YYYY-MM-DD date string to Japanese display format (UTC).
 * @param {string|null|undefined} dateString
 * @returns {string} Formatted string like "2025年7月10日", or "未設定".
 */
export function formatDate(dateString) {
  if (!dateString) return '未設定';
  try {
    const date = new Date(dateString + 'T00:00:00Z'); // UTC interpretation
    if (isNaN(date.getTime())) return dateString;
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${year}年${month}月${day}日`;
  } catch (e) {
    return dateString;
  }
}

/**
 * Extracts a human-readable event name from a URL path.
 * @param {string} url
 * @returns {string} Extracted name or "イベント" as fallback.
 */
export function extractEventName(url) {
  try {
    const pathSegments = new URL(url).pathname.split('/');
    const eventSegment = pathSegments.filter(Boolean).pop();
    if (eventSegment) {
      return eventSegment.replace(/-org/g, '').replace(/-/g, ' ').replace(/_/g, ' ');
    }
    return 'イベント';
  } catch (e) {
    return 'イベント';
  }
}

/**
 * Filters events based on viewMode and a reference date string.
 * - 'active': events with no endDate, or endDate >= todayString
 * - 'archive': events with endDate < todayString
 * @param {Array} events
 * @param {'active'|'archive'} viewMode
 * @param {string} todayString - YYYY-MM-DD format
 * @returns {Array} Filtered events.
 */
export function filterEventsByViewMode(events, viewMode, todayString) {
  if (viewMode === 'active') {
    return events.filter((e) => !e.endDate || e.endDate >= todayString);
  } else {
    return events.filter((e) => e.endDate && e.endDate < todayString);
  }
}

/**
 * Sorts events based on viewMode. Does NOT mutate the original array.
 * - 'archive': by startDate descending (newest first).
 * - 'active': unsubmitted first → startDate descending → name ascending.
 * @param {Array} events
 * @param {'active'|'archive'} viewMode
 * @returns {Array} New sorted array.
 */
export function sortEvents(events, viewMode) {
  return [...events].sort((a, b) => {
    // Archive: sort by startDate descending only
    if (viewMode === 'archive') {
      const dateA = a.startDate ? new Date(a.startDate) : null;
      const dateB = b.startDate ? new Date(b.startDate) : null;
      if (dateA && dateB) return dateB - dateA;
      return 0;
    }

    // Active: 1. Unsubmitted first
    if (a.hasCurrentUserSubmittedStatus === false && b.hasCurrentUserSubmittedStatus !== false) {
      return -1;
    }
    if (a.hasCurrentUserSubmittedStatus !== false && b.hasCurrentUserSubmittedStatus === false) {
      return 1;
    }

    // Active: 2. startDate descending
    const dateA = a.startDate ? new Date(a.startDate) : null;
    const dateB = b.startDate ? new Date(b.startDate) : null;
    if (dateA && dateB) {
      if (dateA > dateB) return -1;
      if (dateA < dateB) return 1;
    } else if (dateA) {
      return -1;
    } else if (dateB) {
      return 1;
    }

    // Active: 3. Name ascending
    const nameA = (a.name || extractEventName(a.eventUrl) || '').toLowerCase();
    const nameB = (b.name || extractEventName(b.eventUrl) || '').toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;

    return 0;
  });
}
