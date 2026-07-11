/**
 * Pure utility functions to parse ESCAPE.id event data from astro-island props.
 * Supports both the new structure (2026~: locations/periods) and the
 * legacy structure (activeSlotGroups/visibleLocations).
 */

/**
 * Extracts event name from infoDetails.
 * @param {object|null|undefined} info - props.info[1]
 * @returns {string|null}
 */
export function parseEventName(info) {
  if (!info) return null;
  return info.eventName?.[1] ?? null;
}

/**
 * Extracts the earliest start date and latest end date.
 * New structure: periods[1][*][1].startDate / endDate
 * Old structure: activeSlotGroups/visibleLocations firstStartTime / lastEndTime
 * @param {object|null|undefined} info - props.info[1]
 * @returns {{ startDate: string|null, endDate: string|null }}
 */
export function parseDateRange(info) {
  if (!info) return { startDate: null, endDate: null };

  let earliestStart = null;
  let latestEnd = null;

  const trackDate = (dateStr, isStart) => {
    if (!dateStr || typeof dateStr !== 'string') return;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return;
    if (isStart) {
      if (!earliestStart || d < earliestStart) earliestStart = d;
    } else {
      if (!latestEnd || d > latestEnd) latestEnd = d;
    }
  };

  // --- New structure: top-level periods ---
  if (info.periods && Array.isArray(info.periods[1])) {
    info.periods[1].forEach((entry) => {
      if (entry?.[1]) {
        trackDate(entry[1].startDate?.[1], true);
        // For date type tag [3, "..."], the value is at index 1
        if (!entry[1].startDate?.[1] && typeof entry[1].startDate?.[1] === 'undefined') {
          trackDate(entry[1].startDate?.[1], true);
        }
        trackDate(entry[1].endDate?.[1], false);
      }
    });
  }

  // --- New structure: locations[*].periods ---
  if (info.locations && Array.isArray(info.locations[1])) {
    info.locations[1].forEach((locEntry) => {
      const loc = locEntry?.[1];
      if (loc?.periods && Array.isArray(loc.periods[1])) {
        loc.periods[1].forEach((pEntry) => {
          if (pEntry?.[1]) {
            trackDate(pEntry[1].startDate?.[1], true);
            trackDate(pEntry[1].endDate?.[1], false);
          }
        });
      }
    });
  }

  // --- Old structure: activeSlotGroups ---
  if (info.activeSlotGroups && Array.isArray(info.activeSlotGroups[1])) {
    info.activeSlotGroups[1].forEach((groupEntry) => {
      const group = groupEntry?.[1];
      if (group) {
        if (group.firstStartTime && Array.isArray(group.firstStartTime)) {
          trackDate(group.firstStartTime[1], true);
        }
        if (group.lastEndTime && Array.isArray(group.lastEndTime)) {
          trackDate(group.lastEndTime[1], false);
        }
      }
    });
  }

  // --- Old structure: visibleLocations ---
  if (info.visibleLocations && Array.isArray(info.visibleLocations[1])) {
    info.visibleLocations[1].forEach((locEntry) => {
      const loc = locEntry?.[1];
      if (loc) {
        if (loc.firstStartTime && Array.isArray(loc.firstStartTime)) {
          trackDate(loc.firstStartTime[1], true);
        }
        if (loc.lastEndTime && Array.isArray(loc.lastEndTime)) {
          trackDate(loc.lastEndTime[1], false);
        }
      }
    });
  }

  return {
    startDate: earliestStart ? earliestStart.toISOString() : null,
    endDate: latestEnd ? latestEnd.toISOString() : null,
  };
}

/**
 * Extracts the first location object from infoDetails.
 * New structure: locations[1][0][1]
 * Old structure: activeSlotGroups[1][0][1].location[1] or visibleLocations[1][0][1]
 * @param {object|null|undefined} info
 * @returns {object|null} The raw location object
 */
function getFirstLocationObject(info) {
  if (!info) return null;

  // New structure: locations
  if (info.locations?.[1]?.[0]?.[1]) {
    return info.locations[1][0][1];
  }

  // Old structure: activeSlotGroups → location
  if (info.activeSlotGroups?.[1]?.[0]?.[1]?.location?.[1]) {
    return info.activeSlotGroups[1][0][1].location[1];
  }

  // Old structure: visibleLocations
  if (info.visibleLocations?.[1]?.[0]?.[1]) {
    return info.visibleLocations[1][0][1];
  }

  return null;
}

/**
 * Extracts location UID.
 * @param {object|null|undefined} info - props.info[1]
 * @returns {string|null}
 */
export function parseLocationUid(info) {
  const loc = getFirstLocationObject(info);
  return loc?.uid?.[1] ?? null;
}

/**
 * Extracts location name and address.
 * @param {object|null|undefined} info - props.info[1]
 * @returns {{ name: string|null, address: string|null }}
 */
export function parseLocationInfo(info) {
  const loc = getFirstLocationObject(info);
  if (loc) {
    return {
      name: loc.name?.[1] ?? null,
      address: loc.address?.[1] ?? null,
    };
  }
  return { name: null, address: null };
}

/**
 * Extracts maxParticipants.
 * @param {object|null|undefined} info - props.info[1]
 * @returns {number|null}
 */
export function parseMaxParticipants(info) {
  if (!info) return null;
  const val = info.maxParticipants?.[1];
  return val !== undefined ? val : null;
}

/**
 * Extracts estimatedTime as string.
 * @param {object|null|undefined} info - props.info[1]
 * @returns {string|null}
 */
export function parseEstimatedTime(info) {
  if (!info) return null;
  const val = info.estimatedTime?.[1];
  return val ? String(val) : null;
}
