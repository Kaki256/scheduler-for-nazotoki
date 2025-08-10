<template>
  <div class="schedule-page">
    <div class="header-section">
      <h1 class="event-title">{{ eventDisplayNameRef || 'イベント' }}日程調整</h1>
      <p class="event-subtitle">参加可能な日時を選択してください。</p>
      <div class="header-buttons">
        <router-link :to="{ name: 'EventSummary', params: { orgSlug: props.orgSlug, eventSlug: props.eventSlug } }" class="button button-primary summary-link">出欠状況ページに行く</router-link>
        <router-link to="/events" class="button button-secondary back-to-list-link">イベント一覧ページに行く</router-link>
      </div>
    </div>

    <div class="controls-section">
      <div class="input-grid">
        <div>
          <label for="eventUrlDisplay" class="input-label">イベントURL:</label>
          <input
            type="url"
            id="eventUrlDisplay"
            :value="eventUrlRef"
            class="input-field display-only-input"
            readonly
          />
        </div>
        <div>
          <label for="recruitmentPeriodDisplay" class="input-label">募集期間:</label>
          <input
            type="text"
            id="recruitmentPeriodDisplay"
            :value="formattedRecruitmentPeriod"
            class="input-field display-only-input"
            readonly
          />
        </div>
        <div>
          <label for="usernameInput" class="input-label">ユーザー名:</label>
          <input
            type="text"
            id="usernameInput"
            v-model="username"
            placeholder="traQ ID"
            class="input-field"
            @change="onUsernameChange"
          />
        </div>
        <!-- <div v-if="locationAddressRef">
          <label for="locationAddressDisplay" class="input-label">開催場所:</label>
          <a 
            :href="googleMapsUrl" 
            target="_blank" 
            rel="noopener noreferrer"
            id="locationAddressDisplay"
            class="input-field display-only-input location-link"
            @click.prevent="openGoogleMaps"
            @keydown.enter.prevent="openGoogleMaps"
            role="link"
            tabindex="0"
            :aria-label="`Google Mapsで「${locationAddressRef}」を開く`"
          >
            {{ locationAddressRef }}
          </a>
        </div> -->
      </div>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </div>

    <div v-if="!loading && initialLoadDone && Object.keys(schedule).length > 0" class="schedule-display-section">
      <h2 class="section-title">開催日時・参加ステータス</h2>

      <!-- Calendar View -->
      <div class="calendar-view-container">
        <div v-for="monthData in calendarMonths" :key="monthData.key" class="calendar-month">
          <h3 class="calendar-month-title">{{ monthData.monthName }}</h3>
          <table class="calendar-table">
            <thead>
              <tr>
                <th v-for="(dayLabel, dayIndex) in weekdayLabels" 
                  :key="dayLabel"
                  @click="getRepresentativeSlotsForDay(dayIndex).length > 0 ? openWeekdayBulkModal(dayIndex) : null"
                  :class="{ 
                    'clickable-header': getRepresentativeSlotsForDay(dayIndex).length > 0, 
                    'active-header': modalMode === 'weekdayBulk' && selectedWeekdayForBulkModal === dayIndex && isModalOpen 
                  }"
                  :style="getWeekdayHeaderStyle(dayIndex)"
                  :aria-pressed="getRepresentativeSlotsForDay(dayIndex).length > 0 && modalMode === 'weekdayBulk' && selectedWeekdayForBulkModal === dayIndex && isModalOpen ? 'true' : 'false'"
                  :role="getRepresentativeSlotsForDay(dayIndex).length > 0 ? 'button' : null"
                  :tabindex="getRepresentativeSlotsForDay(dayIndex).length > 0 ? 0 : -1"
                  @keydown.enter="getRepresentativeSlotsForDay(dayIndex).length > 0 ? openWeekdayBulkModal(dayIndex) : null"
                  @keydown.space.prevent="getRepresentativeSlotsForDay(dayIndex).length > 0 ? openWeekdayBulkModal(dayIndex) : null"
                  :title="getRepresentativeSlotsForDay(dayIndex).length > 0 ? `${dayLabel}曜日の詳細設定を開閉` : `${dayLabel}曜日 (開催情報なし)`"
                >
                  {{ dayLabel }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(week, weekIndex) in monthData.weeks" :key="weekIndex">
                <td v-for="(day) in week" 
                  :key="day.key"
                  :class="{ 
                    'calendar-day-cell': !day.empty,
                    'empty-cell': day.empty,
                    'has-slots': day.isClickable,
                    'not-in-event-range': !day.isWithinEventRange && !day.empty && !day.hasSlots,
                    'today': day.isToday,
                    'no-slots-in-range-diagonal': day.isWithinEventRange && !day.hasSlots // 追加
                  }"
                  :style="getDayStyle(day)" 
                  @click="day.isClickable ? openModalForDate(day.dateString) : null"
                  :tabindex="day.isClickable ? 0 : -1"
                  @keydown.enter="day.isClickable ? openModalForDate(day.dateString) : null"
                  :aria-disabled="!day.isClickable"
                  :aria-label="day.isClickable ? `${day.dateString} のスロットを表示` : (day.empty ? '空セル' : `${day.dateString} は選択不可`)"
                >
                  <div v-if="!day.empty" class="day-number" :style="{ fontSize: '1em' }">{{ day.date }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="calendarMonths.length === 0 && initialLoadDone && !loading">表示できるカレンダーデータがありません。イベントの募集期間を確認してください。</p>
      </div>

      <!-- Unified Modal -->
      <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
        <div class="modal-content" role="dialog" aria-modal="true" :aria-labelledby="modalTitleId">
          <button class="modal-close-button" @click="closeModal" aria-label="閉じる">&times;</button>
          <h3 :id="modalTitleId" class="modal-title">{{ modalTitleComputed }}</h3>
          
          <div v-if="modalMode === 'date'" class="date-modal-layout">
            <div class="event-slots-container">
              <div class="date-bulk-actions modal-bulk-actions">
                <button @click="setBulkStatusForDate(selectedDateForModal, 'going')" :class="['button', 'bulk-action-button', 'bulk-going', { 'active': dateActiveBulkStatus[selectedDateForModal] === 'going' }]">全部行ける</button>
                <button @click="setBulkStatusForDate(selectedDateForModal, 'maybe')" :class="['button', 'bulk-action-button', 'bulk-maybe', { 'active': dateActiveBulkStatus[selectedDateForModal] === 'maybe' }]">全部微妙</button>
                <button @click="setBulkStatusForDate(selectedDateForModal, 'not_going')" :class="['button', 'bulk-action-button', 'bulk-not-going', { 'active': dateActiveBulkStatus[selectedDateForModal] === 'not_going' }]">全部行けない</button>
              </div>
              <ul v-if="slotsForModal.length > 0" class="slot-list modal-slot-list">
                <li v-for="slot in slotsForModal" :key="slot.originalStartTimeUTC" class="slot-item">
                  <div class="slot-info">
                    <span class="slot-time">{{ formatSlotTimeRange(slot.originalStartTimeUTC, parsedEstimatedTimeMinutes) }}</span>
                    <span v-if="slot.status" :class="['slot-availability', getSlotStatusClass(slot.status)]">{{ formatSlotStatus(slot.status) }}</span>
                  </div>
                  <div v-if="!isSlotSoldOut(slot.originalStartTimeUTC)" class="user-status-selector clickable" :class="getUserSlotClass(userSelection[slot.originalStartTimeUTC])" @click="toggleSlotStatus(slot.originalStartTimeUTC)" role="button" tabindex="0" @keydown.enter="toggleSlotStatus(slot.originalStartTimeUTC)" @keydown.space.prevent="toggleSlotStatus(slot.originalStartTimeUTC)" :aria-label="`スロット ${formatSlotTimeRange(slot.originalStartTimeUTC, parsedEstimatedTimeMinutes)} のあなたのステータス: ${formatUserSelectionStatus(userSelection[slot.originalStartTimeUTC])}。クリックまたはEnter/Spaceで変更`">{{ formatUserSelectionStatus(userSelection[slot.originalStartTimeUTC]) }}</div>
                  <div v-else class="user-status-selector disabled-slot" :aria-label="`スロット ${formatSlotTimeRange(slot.originalStartTimeUTC, parsedEstimatedTimeMinutes)} は満席です。あなたのステータス: ${formatUserSelectionStatus(userSelection[slot.originalStartTimeUTC])}`" aria-disabled="true">{{ formatUserSelectionStatus(userSelection[slot.originalStartTimeUTC]) }}</div>
                </li>
              </ul>
              <p v-else class="no-events-message modal-no-events">この日の開催情報はありません。</p>
            </div>
            <div class="personal-calendar-container">
              <h4 class="personal-calendar-title">マイカレンダーの予定</h4>
              <ul v-if="personalScheduleForSelectedDate.length > 0" class="personal-schedule-list">
                <li v-for="event in personalScheduleForSelectedDate" :key="event.id" class="personal-schedule-item">
                  <strong class="personal-schedule-title">{{ event.title }}</strong>
                  <span class="personal-schedule-time">{{ formatPersonalEventTime(event.start_datetime) }} - {{ formatPersonalEventTime(event.end_datetime) }}</span>
                </li>
              </ul>
              <p v-else class="no-events-message">この日の予定はありません。</p>
            </div>
          </div>

          <div v-if="modalMode === 'weekdayBulk'">
            <div v-if="selectedWeekdayForBulkModal !== null && getRepresentativeSlotsForDay(selectedWeekdayForBulkModal).length > 0" class="weekday-bulk-details-modal">
              <div class="weekday-overall-bulk-actions modal-bulk-actions">
                <button @click="setOverallBulkStatusForWeekday(selectedWeekdayForBulkModal, 'going')" :class="['button', 'bulk-action-button', 'bulk-going', { 'active': weekdayOverallActiveBulkStatus[selectedWeekdayForBulkModal] === 'going' }]">全部行ける</button>
                <button @click="setOverallBulkStatusForWeekday(selectedWeekdayForBulkModal, 'maybe')" :class="['button', 'bulk-action-button', 'bulk-maybe', { 'active': weekdayOverallActiveBulkStatus[selectedWeekdayForBulkModal] === 'maybe' }]">全部微妙</button>
                <button @click="setOverallBulkStatusForWeekday(selectedWeekdayForBulkModal, 'not_going')" :class="['button', 'bulk-action-button', 'bulk-not-going', { 'active': weekdayOverallActiveBulkStatus[selectedWeekdayForBulkModal] === 'not_going' }]">全部行けない</button>
              </div>
              <ul class="slot-list modal-slot-list">
                <li v-for="slotRep in getRepresentativeSlotsForDay(selectedWeekdayForBulkModal)" :key="slotRep.originalStartTimeUTC" class="slot-item">
                  <div class="slot-info">
                    <span class="slot-time">{{ formatSlotTimeRange(slotRep.originalStartTimeUTC, parsedEstimatedTimeMinutes) }}</span>
                  </div>
                  <div class="user-status-selector clickable" :class="getUserSlotClass(bulkWeekdaySlotSelections[selectedWeekdayForBulkModal]?.[slotRep.timeHHMM])" @click="toggleBulkSlotStatus(selectedWeekdayForBulkModal, slotRep.timeHHMM)" role="button" tabindex="0" @keydown.enter="toggleBulkSlotStatus(selectedWeekdayForBulkModal, slotRep.timeHHMM)" @keydown.space.prevent="toggleBulkSlotStatus(selectedWeekdayForBulkModal, slotRep.timeHHMM)" :aria-label="`曜日 ${weekdayLabels[selectedWeekdayForBulkModal]}, 時刻 ${slotRep.timeHHMM} (${formatSlotTimeRange(slotRep.originalStartTimeUTC, parsedEstimatedTimeMinutes)}) の一括設定ステータス: ${formatUserSelectionStatus(bulkWeekdaySlotSelections[selectedWeekdayForBulkModal]?.[slotRep.timeHHMM])}。クリックまたはEnter/Spaceで変更`">{{ formatUserSelectionStatus(bulkWeekdaySlotSelections[selectedWeekdayForBulkModal]?.[slotRep.timeHHMM]) }}</div>
                </li>
              </ul>
              <button @click="applyBulkWeekdaySelections(selectedWeekdayForBulkModal)" class="button primary-button apply-bulk-weekday-button modal-apply-button">{{ weekdayLabels[selectedWeekdayForBulkModal] }}曜日の設定を全週に適用</button>
            </div>
            <p v-else-if="selectedWeekdayForBulkModal !== null" class="no-representative-slots-message modal-no-events">この曜日の代表的なスロットパターンが見つかりません。</p>
            <p v-else class="modal-no-events">曜日が選択されていません。</p>
          </div>
        </div>
      </div>

    </div>
    <div v-else-if="!loading && initialLoadDone && Object.keys(schedule).length === 0 && !errorMessage" class="no-data-message">
      <p>対象期間に開催情報が見つかりませんでした。イベントURLや日付範囲を確認してください。</p>
    </div>
    <div v-if="loading && !initialLoadDone" class="loading-initial-message">
      <p>スケジュールを読み込んでいます...</p>
    </div>

    <div v-if="Object.keys(schedule).length > 0 && !isModalOpen" class="save-button-container">
      <button
        @click="saveSelections"
        :disabled="savingSelections || loading || !username"
        class="button success-button save-selections-button"
      >
        <svg v-if="savingSelections" class="loading-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {{ savingSelections ? '保存中...' : '選択をDBに保存' }}
      </button>
      <p v-if="saveMessage.text" :class="['save-message', saveMessage.type === 'success' ? 'save-message-success' : 'save-message-error']">{{ saveMessage.text }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, reactive, watch, onMounted, nextTick, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const router = useRouter();

const props = defineProps({
  orgSlug: { type: String, required: true },
  eventSlug: { type: String, required: true }
});

const allPersonalSchedules = ref([]);
const eventDisplayNameRef = ref('');
const eventUrlRef = ref('');
const locationUidRef = ref('');
const estimatedTimeRef = ref('');
const locationAddressRef = ref('');

const formatDateForInput = (date) => date.toISOString().split('T')[0];

const currentStartDate = ref('');
const currentEndDate = ref('');

const formattedRecruitmentPeriod = computed(() => {
  if (!currentStartDate.value || !currentEndDate.value) return '';
  const startDate = new Date(currentStartDate.value);
  const endDate = new Date(currentEndDate.value);
  return `${startDate.toLocaleDateString('ja-JP')} - ${endDate.toLocaleDateString('ja-JP')}`;
});

const personalScheduleForSelectedDate = computed(() => {
  if (!selectedDateForModal.value || allPersonalSchedules.value.length === 0) {
    return [];
  }
  const selectedDate = new Date(selectedDateForModal.value + 'T00:00:00Z');
  const selectedDateEnd = new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000);

  return allPersonalSchedules.value.filter(event => {
    const eventStart = new Date(event.start_datetime);
    const eventEnd = new Date(event.end_datetime);
    return eventStart < selectedDateEnd && eventEnd > selectedDate;
  }).sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
});

const parsedEstimatedTimeMinutes = computed(() => {
  if (!estimatedTimeRef.value) return 0;
  const timeStr = String(estimatedTimeRef.value).trim();
  const numbers = (timeStr.match(/\d+/g) || []).map(Number);
  if (numbers.length === 0) return 0;
  const maxMinutes = Math.max(...numbers);
  return maxMinutes > 0 ? maxMinutes : 0;
});

function formatSlotTimeRange(startTimeUTC, durationMinutes) {
  if (!startTimeUTC) return "時刻不明";
  try {
    const startDate = new Date(startTimeUTC);
    const startTimeFormatted = startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
    if (durationMinutes <= 0) return startTimeFormatted;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    const endTimeFormatted = endDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
    return `${startTimeFormatted}～${endTimeFormatted}`;
  } catch (e) {
    console.error("Error formatting slot time range:", startTimeUTC, durationMinutes, e);
    try {
      return new Date(startTimeUTC).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
    } catch { return "時刻エラー"; }
  }
}

function formatPersonalEventTime(datetime) {
  if (!datetime) return '';
  try {
    return new Date(datetime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
  } catch (e) {
    return '時刻エラー';
  }
}

const schedule = ref({});
const loading = ref(false);
const initialLoadDone = ref(false);
const errorMessage = ref('');
const userSelection = reactive({});
const savingSelections = ref(false);
const saveMessage = ref({ text: '', type: '' });
const dateActiveBulkStatus = reactive({});
const weekdayActiveBulkStatus = reactive({});
const weekdayOverallActiveBulkStatus = reactive({});
const isModalOpen = ref(false);
const modalMode = ref('');
const selectedDateForModal = ref(null);
const selectedWeekdayForBulkModal = ref(null);
const bulkWeekdaySlotSelections = reactive({});

const weekdayRepresentativeSlots = computed(() => {
  const result = {};
  if (!schedule.value || Object.keys(schedule.value).length === 0) {
    for (let i = 0; i < 7; i++) result[i] = [];
    return result;
  }
  const foundWeekdays = new Set();
  for (const dateKey of Object.keys(sortedSchedule.value)) {
    if (foundWeekdays.size === 7) break;
    const dateObj = new Date(dateKey + 'T00:00:00Z');
    const dayIndex = dateObj.getUTCDay();
    if (!foundWeekdays.has(dayIndex)) {
      const slotsForDate = schedule.value[dateKey];
      if (slotsForDate && slotsForDate.length > 0) {
        result[dayIndex] = slotsForDate.map(slot => ({
          timeHHMM: new Date(slot.originalStartTimeUTC).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }),
          originalStartTimeUTC: slot.originalStartTimeUTC
        })).filter(s => s !== null).sort((a, b) => a.timeHHMM.localeCompare(b.timeHHMM));
        foundWeekdays.add(dayIndex);
      }
    }
  }
  for (let i = 0; i < 7; i++) {
    if (!result[i]) result[i] = [];
  }
  return result;
});

const modalTitleId = 'unifiedModalTitle';
const modalTitleComputed = computed(() => {
  if (modalMode.value === 'date' && selectedDateForModal.value) {
    let title = formatDate(selectedDateForModal.value);
    if (parsedEstimatedTimeMinutes.value > 0 && slotsForModal.value && slotsForModal.value.length > 0 && slotsForModal.value[0].originalStartTimeUTC) {
      const firstSlotTime = new Date(slotsForModal.value[0].originalStartTimeUTC);
      const endTime = new Date(firstSlotTime.getTime() + parsedEstimatedTimeMinutes.value * 60000);
      try {
        title += ` (終了目安: ${endTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })})`;
      } catch (e) {
        console.error("Error formatting end time for modal title:", e);
      }
    }
    return title;
  } else if (modalMode.value === 'weekdayBulk' && selectedWeekdayForBulkModal.value !== null) {
    return `${weekdayLabels[selectedWeekdayForBulkModal.value]}曜日の一括設定`;
  }
  return '詳細設定';
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];
const possibleStatuses = ['going', 'maybe', 'not_going', undefined];

const sortedSchedule = computed(() => {
  if (!schedule.value || typeof schedule.value !== 'object') return {};
  return Object.entries(schedule.value).sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB)).reduce((obj, [key, value]) => {
    obj[key] = value;
    return obj;
  }, {});
});

function formatDate(dateString) {
  if (!dateString) return '';
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
  try {
    return new Date(dateString + 'T00:00:00Z').toLocaleDateString('ja-JP', options);
  } catch(e) { return dateString; }
}

function formatSlotStatus(status) {
  const statusMap = { 'MANY': '残数あり', 'FULL': '完売', 'FEW': '残りわずか', 'NOT_IN_SALES_PERIOD': '販売開始前' };
  return statusMap[status] || status;
}

function getSlotStatusClass(status) {
  switch (status) {
    case 'MANY': return 'status-available';
    case 'FEW': return 'status-few-tickets-left';
    case 'FULL': return 'status-sold-out';
    case 'NOT_IN_SALES_PERIOD': return 'status-on-sale-soon';
  }
}

function getDayOfWeek(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

function getUserSlotClass(status) {
  if (status === 'going') return 'status-going';
  if (status === 'maybe') return 'status-maybe';
  if (status === 'not_going') return 'status-not-going';
  return 'status-undefined';
}

function formatUserSelectionStatus(status) {
  if (status === 'going') return '行ける';
  if (status === 'maybe') return '微妙';
  if (status === 'not_going') return '行けない';
  return '未選択';
}

function toggleSlotStatus(slotUtcTime) {
  if (isSlotSoldOut(slotUtcTime)) {
    userSelection[slotUtcTime] = 'not_going';
    return;
  }
  const currentStatus = userSelection[slotUtcTime];
  const currentIndex = possibleStatuses.indexOf(currentStatus);
  const nextIndex = (currentIndex + 1) % possibleStatuses.length;
  const nextStatus = possibleStatuses[nextIndex];
  if (nextStatus === undefined) delete userSelection[slotUtcTime];
  else userSelection[slotUtcTime] = nextStatus;
  saveMessage.value = { text: '', type: '' };
  try {
    const datePart = slotUtcTime.substring(0, 10);
    if (dateActiveBulkStatus[datePart] !== undefined) dateActiveBulkStatus[datePart] = null;
    const dayIndex = getDayOfWeek(datePart);
    if (weekdayActiveBulkStatus[dayIndex] !== undefined) weekdayActiveBulkStatus[dayIndex] = null;
  } catch (e) { console.error("Error processing slotUtcTime for bulk status reset:", e); }
}

function setBulkStatusForDate(date, status) {
  if (schedule.value[date] && Array.isArray(schedule.value[date])) {
    schedule.value[date].forEach(slot => {
      if (slot && slot.originalStartTimeUTC) {
        if (isSlotSoldOut(slot.originalStartTimeUTC)) userSelection[slot.originalStartTimeUTC] = 'not_going';
        else userSelection[slot.originalStartTimeUTC] = status;
      }
    });
    dateActiveBulkStatus[date] = status;
    const dayIndex = getDayOfWeek(date);
    weekdayActiveBulkStatus[dayIndex] = null;
    saveMessage.value = { text: '', type: '' };
  }
}

function getRepresentativeSlotsForDay(dayIndex) {
  return weekdayRepresentativeSlots.value && weekdayRepresentativeSlots.value[dayIndex] ? weekdayRepresentativeSlots.value[dayIndex] : [];
}

function openWeekdayBulkModal(dayIndex) {
  modalMode.value = 'weekdayBulk';
  selectedWeekdayForBulkModal.value = dayIndex;
  if (!bulkWeekdaySlotSelections[dayIndex]) {
    bulkWeekdaySlotSelections[dayIndex] = {};
    const representativeSlots = getRepresentativeSlotsForDay(dayIndex);
    representativeSlots.forEach(slotTimeHHMM => {
      bulkWeekdaySlotSelections[dayIndex][slotTimeHHMM] = undefined;
    });
  }
  weekdayOverallActiveBulkStatus[dayIndex] = null;
  isModalOpen.value = true;
}

function setOverallBulkStatusForWeekday(dayIndex, status) {
  if (dayIndex === null || !bulkWeekdaySlotSelections[dayIndex]) return;
  const representativeSlots = getRepresentativeSlotsForDay(dayIndex);
  if (!representativeSlots || representativeSlots.length === 0) return;
  let allSlotsUpdated = true;
  representativeSlots.forEach(slotTimeHHMM => {
    if (bulkWeekdaySlotSelections[dayIndex].hasOwnProperty(slotTimeHHMM)) {
      bulkWeekdaySlotSelections[dayIndex][slotTimeHHMM] = status;
    } else {
      bulkWeekdaySlotSelections[dayIndex][slotTimeHHMM] = status;
    }
  });
  if(allSlotsUpdated) weekdayOverallActiveBulkStatus[dayIndex] = status;
  else weekdayOverallActiveBulkStatus[dayIndex] = null;
  saveMessage.value = { text: '', type: '' };
}

function toggleBulkSlotStatus(dayIndex, slotTimeHHMM) {
  if (!bulkWeekdaySlotSelections[dayIndex]) bulkWeekdaySlotSelections[dayIndex] = {};
  const currentStatus = bulkWeekdaySlotSelections[dayIndex][slotTimeHHMM];
  const currentIndex = possibleStatuses.indexOf(currentStatus);
  const nextIndex = (currentIndex + 1) % possibleStatuses.length;
  const nextStatus = possibleStatuses[nextIndex];
  if (nextStatus === undefined) bulkWeekdaySlotSelections[dayIndex][slotTimeHHMM] = undefined;
  else bulkWeekdaySlotSelections[dayIndex][slotTimeHHMM] = nextStatus;
  if (weekdayOverallActiveBulkStatus[dayIndex] !== undefined && weekdayOverallActiveBulkStatus[dayIndex] !== null) weekdayOverallActiveBulkStatus[dayIndex] = null;
  saveMessage.value = { text: '', type: '' };
}

function applyBulkWeekdaySelections(dayIndex) {
  const selectionsForWeekday = bulkWeekdaySlotSelections[dayIndex];
  if (!selectionsForWeekday) return;
  let changesMade = false;
  Object.keys(sortedSchedule.value).forEach(dateKey => {
    const dateObject = new Date(dateKey + 'T00:00:00Z');
    if (dateObject.getUTCDay() === dayIndex) {
      if (schedule.value[dateKey] && Array.isArray(schedule.value[dateKey])) {
        schedule.value[dateKey].forEach(slot => {
          if (slot && slot.originalStartTimeUTC) {
            let slotTimeHHMM;
            try {
              slotTimeHHMM = new Date(slot.originalStartTimeUTC).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
            } catch (e) { return; }
            if (selectionsForWeekday.hasOwnProperty(slotTimeHHMM)) {
              const newStatus = selectionsForWeekday[slotTimeHHMM];
              const currentActualStatus = userSelection[slot.originalStartTimeUTC];
              if (isSlotSoldOut(slot.originalStartTimeUTC)) {
                userSelection[slot.originalStartTimeUTC] = 'not_going';
                changesMade = true;
              } else {
                if (newStatus === undefined) {
                  if (currentActualStatus !== undefined) {
                    userSelection[slot.originalStartTimeUTC] = 'not_going';
                    changesMade = true;
                  }
                } else {
                  if (currentActualStatus !== newStatus) {
                    userSelection[slot.originalStartTimeUTC] = newStatus;
                    changesMade = true;
                  }
                }
              }
              if (dateActiveBulkStatus[dateKey] !== undefined && dateActiveBulkStatus[dateKey] !== null) dateActiveBulkStatus[dateKey] = null;
            }
          }
        });
      }
    }
  });
  if (changesMade) saveMessage.value = { text: '', type: '' };
  if (weekdayActiveBulkStatus[dayIndex] !== undefined && weekdayActiveBulkStatus[dayIndex] !== null) weekdayActiveBulkStatus[dayIndex] = null;
  closeModal();
}

const username = ref('');

async function fetchUsername() {
  try {
    const response = await axios.get(`${API_BASE_URL}/get-username`);
    if (response.data && response.data.username) username.value = response.data.username;
    else username.value = '';
  } catch (error) {
    console.error('[Auth] Error fetching username:', error);
    errorMessage.value = 'ユーザー名の取得に失敗しました。';
    username.value = '';
  }
}

async function fetchAllPersonalSchedules() {
  if (!username.value) {
    allPersonalSchedules.value = [];
    return;
  }
  try {
    const response = await axios.get(`${API_BASE_URL}/my-calendar`);
    allPersonalSchedules.value = response.data;
  } catch (error) {
    console.error('マイカレンダーの予定取得に失敗しました:', error);
  }
}

const googleMapsUrl = computed(() => {
  if (!locationAddressRef.value) return '#';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationAddressRef.value)}`;
});

function openGoogleMaps() {
  if (locationAddressRef.value) window.open(googleMapsUrl.value, '_blank', 'noopener,noreferrer');
}

async function fetchScheduleData(eventUrl, dateFrom, dateTo, locationUid) {
  const isYodaka = eventUrl && eventUrl.startsWith('https://yodaka.info/');
  if (!eventUrl || !dateFrom || !dateTo || (!locationUid && !isYodaka)) {
    schedule.value = { dates: [], message: 'スケジュール取得に必要な情報が不足しています。' };
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  schedule.value = {};
  try {
    const response = await axios.post(`${API_BASE_URL}/get-schedule`, { event_url: eventUrl, date_from: dateFrom, date_to: dateTo, location_uid: locationUid });
    if (response.data && typeof response.data === 'object') {
      const formattedSchedule = {};
      if (response.data.dates && Array.isArray(response.data.dates)) {
        response.data.dates.forEach(dateEntry => {
          if (dateEntry && dateEntry.date && Array.isArray(dateEntry.slots)) {
            const dateKey = dateEntry.date;
            formattedSchedule[dateKey] = dateEntry.slots.map(slot => ({
              time: new Date(slot.startAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }),
              status: slot.vacancyType,
              originalStartTimeUTC: slot.startAt,
            }));
          }
        });
        schedule.value = formattedSchedule;
      } else if (response.data.allTimeSlotsUTC && Array.isArray(response.data.allTimeSlotsUTC)) {
        const tempSchedule = {};
        response.data.allTimeSlotsUTC.forEach(utcTime => {
          const date = new Date(utcTime);
          const dateKey = date.toISOString().split('T')[0];
          if (!tempSchedule[dateKey]) tempSchedule[dateKey] = [];
          tempSchedule[dateKey].push({ time: date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }), status: 'unknown', originalStartTimeUTC: utcTime });
        });
        for (const dateKey in tempSchedule) tempSchedule[dateKey].sort((a, b) => new Date(a.originalStartTimeUTC) - new Date(b.originalStartTimeUTC));
        schedule.value = tempSchedule;
      } else {
        schedule.value = {};
      }
    } else {
      schedule.value = {};
    }
  } catch (err) {
    console.error('[ScheduleFetch] Error fetching schedule:', err);
    let errorMsg = 'スケジュールの取得に失敗しました';
    if (err.response) errorMsg += ` (ステータス: ${err.response.status})` + (err.response.data && err.response.data.error ? `: ${err.response.data.error}` : '');
    else if (err.request) errorMsg += '。サーバーからの応答がありません。';
    else errorMsg += `。エラー: ${err.message}`;
    errorMessage.value = errorMsg;
    schedule.value = {};
  } finally {
    loading.value = false;
    initialLoadDone.value = true;
    if (username.value && eventUrlRef.value) await loadUserStatus(username.value, eventUrlRef.value);
  }
}

async function fetchEventDetailsBySlugs(orgSlug, eventSlug) {
  let eventUrl;
  if (orgSlug === 'Yodaka') eventUrl = `https://yodaka.info/event/${eventSlug}/`;
  else eventUrl = `https://escape.id/${orgSlug}-org/e-${eventSlug}/`;
  loading.value = true;
  errorMessage.value = '';
  eventUrlRef.value = eventUrl;
  try {
    const encodedEventUrl = encodeURIComponent(eventUrl);
    const response = await axios.get(`${API_BASE_URL}/events/${encodedEventUrl}`);
    const eventDetails = response.data;
    locationUidRef.value = eventDetails.locationUid;
    currentStartDate.value = formatDateForInput(new Date(eventDetails.startDate));
    currentEndDate.value = formatDateForInput(new Date(eventDetails.endDate));
    eventDisplayNameRef.value = eventDetails.name;
    eventUrlRef.value = eventDetails.event_url;
    estimatedTimeRef.value = eventDetails.estimated_time;
    locationAddressRef.value = eventDetails.location_address;
    if (eventUrlRef.value && currentStartDate.value && currentEndDate.value && (locationUidRef.value || orgSlug === 'Yodaka')) {
      await fetchScheduleData(eventUrlRef.value, currentStartDate.value, currentEndDate.value, locationUidRef.value);
    }
    initialLoadDone.value = true;
  } catch (error) {
    console.error('[EventDetailsFetch] Error fetching event details by reconstructed eventUrl:', error);
    errorMessage.value = `イベント詳細の取得に失敗しました: ${error.message}`;
  }
  loading.value = false;
}

async function initializePage() {
  await fetchUsername();
  await fetchAllPersonalSchedules();
  if (props.orgSlug && props.eventSlug) await fetchEventDetailsBySlugs(props.orgSlug, props.eventSlug);
  else {
    errorMessage.value = 'イベント情報が不足しています。';
    loading.value = false;
  }
}

onMounted(async () => {
  await initializePage();
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

watch(() => [props.orgSlug, props.eventSlug], async (newSlugs, oldSlugs) => {
  const [newOrgSlug, newEventSlug] = newSlugs;
  if (newOrgSlug && newEventSlug) {
    await fetchEventDetailsBySlugs(newOrgSlug, newEventSlug);
    if (username.value && eventUrlRef.value) await loadUserStatus(username.value, eventUrlRef.value);
  }
}, { immediate: false });

watch(username, async (newUsername, oldUsername) => {
  if (newUsername && eventUrlRef.value && newUsername !== oldUsername) {
    await loadUserStatus(newUsername, eventUrlRef.value);
    await fetchAllPersonalSchedules();
  } else if (!newUsername) {
    Object.keys(userSelection).forEach(key => delete userSelection[key]);
    allPersonalSchedules.value = [];
  }
});

function onUsernameChange() {
  saveMessage.value = { text: '', type: '' };
}

async function loadUserStatus(user, url) {
  if (!user || !url) {
    Object.keys(userSelection).forEach(key => delete userSelection[key]);
    return;
  }
  errorMessage.value = '';
  try {
    const response = await axios.get(`${API_BASE_URL}/load-my-status`, { params: { username: user, eventUrl: url } });
    if (response.data && Array.isArray(response.data)) {
      Object.keys(userSelection).forEach(key => delete userSelection[key]);
      response.data.forEach(item => {
        if (!isSlotSoldOut(item.event_datetime_utc)) userSelection[item.event_datetime_utc] = item.status;
      });
      Object.keys(dateActiveBulkStatus).forEach(key => dateActiveBulkStatus[key] = null);
      Object.keys(weekdayActiveBulkStatus).forEach(key => weekdayActiveBulkStatus[key] = null);
    } else if (response.data && Object.keys(response.data).length === 0) {
      Object.keys(userSelection).forEach(key => delete userSelection[key]);
      Object.keys(dateActiveBulkStatus).forEach(key => dateActiveBulkStatus[key] = null);
      Object.keys(weekdayActiveBulkStatus).forEach(key => weekdayActiveBulkStatus[key] = null);
    } else {
      errorMessage.value = '以前の選択の読み込み中に予期せぬデータ形式を受信しました。';
    }
  } catch (error) {
    console.error('[StatusLoad] Error loading user status:', error);
    let userFriendlyMessage = '以前の選択の読み込みに失敗しました。';
    if (error.response && error.response.data && typeof error.response.data === 'object' && error.response.data.error) {
      userFriendlyMessage += ` サーバーエラー: ${error.response.data.error}`;
      if (error.response.data.details) userFriendlyMessage += ` 詳細: ${error.response.data.details}`;
    } else if (error.response && typeof error.response.data === 'string' && error.response.data.includes('ReferenceError: rows is not defined')) {
      userFriendlyMessage += ' サーバー内部でエラーが発生しました (データ参照エラー)。';
    } else if (error.response && typeof error.response.data === 'string' && error.response.data.toLowerCase().includes('syntaxerror')) {
      userFriendlyMessage += ' 保存されたデータの形式が正しくありません。';
    } else if (error.message) {
      userFriendlyMessage += ` (${error.message})`;
    }
    errorMessage.value = userFriendlyMessage;
    Object.keys(userSelection).forEach(key => delete userSelection[key]);
    Object.keys(dateActiveBulkStatus).forEach(key => dateActiveBulkStatus[key] = null);
    Object.keys(weekdayActiveBulkStatus).forEach(key => weekdayActiveBulkStatus[key] = null);
  }
}

async function saveSelections() {
  if (!username.value) {
    saveMessage.value = { text: 'ユーザー名を入力してください。', type: 'error' };
    return;
  }
  if (!eventUrlRef.value) {
    saveMessage.value = { text: 'イベントURLが不明です。保存できません。', type: 'error' };
    return;
  }
  savingSelections.value = true;
  saveMessage.value = { text: '', type: '' };
  try {
    const selectionsToSave = Object.keys(userSelection).map(key => ({ event_datetime_utc: key, status: userSelection[key] }));
    const response = await axios.post(`${API_BASE_URL}/save-my-status`, { username: username.value, eventUrl: eventUrlRef.value, selections: selectionsToSave });
    if (response.status === 204) {
      saveMessage.value = { text: '選択が保存されました。', type: 'success' };
    } else {
      saveMessage.value = { text: '選択の保存に失敗しました。サーバーからの応答が予期せぬものです。', type: 'error' };
    }
  } catch (error) {
    console.error('[SaveSelections] Error saving selections:', error);
    saveMessage.value = { text: '選択の保存中にエラーが発生しました。', type: 'error' };
  } finally {
    savingSelections.value = false;
  }
}

const slotsForModal = computed(() => {
  if (modalMode.value !== 'date' || !selectedDateForModal.value || !schedule.value[selectedDateForModal.value]) return [];
  return [...schedule.value[selectedDateForModal.value]].sort((a, b) => new Date(a.originalStartTimeUTC) - new Date(b.originalStartTimeUTC));
});

const calendarMonths = computed(() => {
  if (!currentStartDate.value || !currentEndDate.value || !initialLoadDone.value) return [];
  const months = [];
  let loopStartDate = new Date(currentStartDate.value + 'T00:00:00Z');
  const loopEndDate = new Date(currentEndDate.value + 'T00:00:00Z');
  let currentDateIterator = new Date(Date.UTC(loopStartDate.getUTCFullYear(), loopStartDate.getUTCMonth(), 1));
  while (currentDateIterator.getUTCFullYear() < loopEndDate.getUTCFullYear() || (currentDateIterator.getUTCFullYear() === loopEndDate.getUTCFullYear() && currentDateIterator.getUTCMonth() <= loopEndDate.getUTCMonth())) {
    const year = currentDateIterator.getUTCFullYear();
    const month = currentDateIterator.getUTCMonth();
    const monthName = `${year}年${month + 1}月`;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const firstDayOfMonthWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const weeks = [];
    let currentWeek = [];
    for (let i = 0; i < firstDayOfMonthWeekday; i++) currentWeek.push({ empty: true, key: `empty-${i}` });
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(Date.UTC(year, month, day));
      const dateString = dateObj.toISOString().split('T')[0];
      const isWithinEventRange = dateObj >= loopStartDate && dateObj <= loopEndDate;
      const hasSlots = schedule.value[dateString] && schedule.value[dateString].length > 0;
      currentWeek.push({ date: day, dateString, isToday: new Date().toISOString().split('T')[0] === dateString, hasSlots, isClickable: hasSlots && isWithinEventRange, isWithinEventRange, key: dateString });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push({ empty: true, key: `empty-end-${currentWeek.length}` });
      weeks.push(currentWeek);
    }
    months.push({ monthName, weeks, key: monthName });
    currentDateIterator.setUTCMonth(currentDateIterator.getUTCMonth() + 1);
  }
  return months;
});

function openModalForDate(dateString) {
  if (!schedule.value[dateString] || schedule.value[dateString].length === 0) return;
  modalMode.value = 'date';
  selectedDateForModal.value = dateString;
  isModalOpen.value = true;
}

function closeModal() {
  isModalOpen.value = false;
  modalMode.value = '';
  selectedDateForModal.value = null;
}

const handleKeydown = (e) => {
  if (e.key === 'Escape' && isModalOpen.value) closeModal();
};

const statusToColor = { going: 'lightgreen', maybe: 'yellow', not_going: 'lightcoral', unselected: 'lightcyan' };

const getWeekdayHeaderStyle = (dayIndex) => {
  const representativeSlots = getRepresentativeSlotsForDay(dayIndex);
  if (representativeSlots.length === 0) return { backgroundColor: '#f9f9f9', color: '#6c757d' };
  const colorStops = [];
  const slotCount = representativeSlots.length;
  const slotHeightPercent = 100 / slotCount;
  representativeSlots.forEach((slotTimeHHMM, index) => {
    const status = bulkWeekdaySlotSelections[dayIndex] && bulkWeekdaySlotSelections[dayIndex][slotTimeHHMM];
    const color = statusToColor[status] || statusToColor.unselected;
    const startPercent = index * slotHeightPercent;
    const endPercent = (index + 1) * slotHeightPercent;
    colorStops.push(`${color} ${startPercent}%`);
    colorStops.push(`${color} ${endPercent}%`);
  });
  if (colorStops.length === 0) return { backgroundColor: '#f9f9f9', color: '#6c757d' };
  return { background: `linear-gradient(to bottom, ${colorStops.join(', ')})`, color: '#343a40' };
};

const getDayStyle = (dayObject) => {
  if (!dayObject || !dayObject.dateString || !schedule.value) return {};
  const dateStr = dayObject.dateString;
  const slotsForDay = schedule.value[dateStr] ? [...schedule.value[dateStr]].sort((a, b) => new Date(a.originalStartTimeUTC).getTime() - new Date(b.originalStartTimeUTC).getTime()) : [];
  if (slotsForDay.length === 0) return !dayObject.isWithinEventRange && !dayObject.empty ? { backgroundColor: '#f9f9f9' } : {};
  const colorStops = [];
  const slotCount = slotsForDay.length;
  const slotHeightPercent = 100 / slotCount;
  slotsForDay.forEach((slot, index) => {
    const status = userSelection[slot.originalStartTimeUTC] || 'unselected';
    const color = statusToColor[status] || statusToColor.unselected;
    const startPercent = index * slotHeightPercent;
    const endPercent = (index + 1) * slotHeightPercent;
    colorStops.push(`${color} ${startPercent}%`);
    colorStops.push(`${color} ${endPercent}%`);
  });
  if (colorStops.length === 0) return {};
  return { background: `linear-gradient(to bottom, ${colorStops.join(', ')})` };
};

function getSlotByUtcTime(utcTime) {
  if (!schedule.value || Object.keys(schedule.value).length === 0) return null;
  for (const dateKey in schedule.value) {
    const slotsOnDate = schedule.value[dateKey];
    if (Array.isArray(slotsOnDate)) {
      const foundSlot = slotsOnDate.find(s => s.originalStartTimeUTC === utcTime);
      if (foundSlot) return foundSlot;
    }
  }
  return null;
}

function isSlotSoldOut(slotUtcTime) {
  const slot = getSlotByUtcTime(slotUtcTime);
  return slot && slot.status === 'FULL';
}

</script>

<style scoped>
.schedule-page *, .schedule-page *::before, .schedule-page *::after {
  box-sizing: border-box;
}
.schedule-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
.header-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
  text-align: center;
}
.event-title { font-size: 2em; margin-bottom: 0.5em; color: #333; }
.event-subtitle { font-size: 1.1em; margin-bottom: 1em; color: #555; }
.header-buttons { display: flex; gap: 10px; }
.controls-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
  border: 1px solid #dee2e6;
}
.input-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}
.input-label { display: block; font-size: 0.8rem; font-weight: 500; color: #495057; margin-bottom: 0.3rem; }
.input-field {
  width: 100%;
  padding: 0.65rem 0.8rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  box-shadow: inset 0 1px 1px rgba(0,0,0,0.03);
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  font-size: 0.85rem;
  background-color: #fff;
}
.input-field.display-only-input { background-color: #e9ecef; cursor: default; color: #6c757d; }
.input-field:focus { border-color: #86b7fe; outline: none; box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25); }
.button { font-weight: 500; padding: 0.6rem 1.2rem; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: all 0.15s ease; cursor: pointer; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; line-height: 1.5; text-decoration: none; }
.button:hover:not(:disabled) { box-shadow: 0 2px 4px rgba(0,0,0,0.07); transform: translateY(-1px); }
.button-primary { background-color: #4A90E2; color: white; }
.button-primary:hover { background-color: #357ABD; }
.button-secondary { background-color: #f0f0f0; color: #333; border: 1px solid #ccc; }
.button-secondary:hover { background-color: #e0e0e0; }
.loading-spinner { animation: spin 0.75s linear infinite; margin-right: 0.5em; height: 1em; width: 1em; }
.error-message { margin-top: 0.75rem; color: #b02a37; font-size: 0.8rem; font-weight: 500; text-align: right; }
.schedule-display-section { background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05); border: 1px solid #dee2e6; padding: 1rem; margin-top: 1.5rem; }
.section-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #343a40; border-bottom: 1px solid #e9ecef; padding-bottom: 0.5rem; }
.slot-list { list-style: none; padding: 0; margin-top: 10px; }
.slot-item { background-color: #fff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px 15px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.slot-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.95em; }
.slot-time { font-weight: bold; color: #333; }
.slot-availability { font-size: 0.85em; padding: 3px 8px; border-radius: 4px; color: #fff; }
.status-available { background-color: #4CAF50; }
.status-few-tickets-left { background-color: #FFC107; color: #000 !important; }
.status-sold-out { background-color: #F44336; }
.status-on-sale-soon { background-color: #2196F3; }
.user-status-selector { padding: 10px; border-radius: 5px; text-align: center; cursor: pointer; user-select: none; transition: all 0.2s ease-in-out; font-weight: 500; border: 2px solid transparent; }
.user-status-selector.status-undefined { background-color: #f0f0f0; color: #555; border: 2px dashed #ccc; }
.user-status-selector.status-undefined:hover { background-color: #e0e0e0; border-color: #bbb; }
.user-status-selector.status-going { background-color: #4CAF50; color: white; border-color: #388E3C; }
.user-status-selector.status-going:hover { background-color: #45a049; }
.user-status-selector.status-maybe { background-color: #FFC107; color: black; border-color: #FFA000; }
.user-status-selector.status-maybe:hover { background-color: #ffb300; }
.user-status-selector.status-not-going { background-color: #F44336; color: white; border-color: #D32F2F; }
.user-status-selector.status-not-going:hover { background-color: #e53935; }
.user-status-selector.clickable:focus { outline: 2px solid #007bff; outline-offset: 2px; }
.save-button-container { margin-top: 25px; text-align: center; }
.save-selections-button { padding: 12px 25px; font-size: 1.1em; }
.save-message { margin-top: 10px; font-size: 0.9em; }
.save-message-success { color: green; }
.save-message-error { color: red; }
.no-data-message, .loading-initial-message { text-align: center; padding: 20px; font-size: 1.1em; color: #555; }
.date-bulk-actions { margin-bottom: 15px; padding: 10px; background-color: #f0f4f8; border-radius: 6px; }
.bulk-action-button { margin-right: 5px; padding: 6px 10px; font-size: 0.9em; border: 1px solid transparent; }
.bulk-action-button.active { border-width: 2px; box-shadow: 0 0 5px rgba(0,0,0,0.2); }
.calendar-view-container { margin-top: 20px; padding: 10px; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.calendar-month { margin-bottom: 20px; }
.calendar-month-title { font-size: 1.4em; text-align: center; margin-bottom: 15px; color: #333; font-weight: 600; }
.calendar-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.calendar-table th, .calendar-table td { border: 1px solid black; padding: 0; text-align: center; vertical-align: top; height: 90px; }
.calendar-table th { background-color: #f8f9fa; font-weight: 500; color: #495057; padding: 10px 0; font-size: 0.85em; height: auto; }
.calendar-table th.clickable-header { cursor: pointer; transition: background-color 0.2s ease; }
.calendar-table th.clickable-header:hover { background-color: #e9ecef; }
.calendar-table th.clickable-header.active-header { background-color: #cfe2ff; color: #0a58ca; font-weight: bold; }
.calendar-day-cell { cursor: default; padding: 5px; position: relative; transition: all 0.15s ease-out; }
.calendar-day-cell.has-slots { cursor: pointer; }
.calendar-day-cell.not-in-event-range { background-color: #e0e0e0; color: #a0a0a0; }
.calendar-day-cell.not-in-event-range .day-number { color: #a0a0a0; }
.empty-cell { background-color: #fdfdfd; border: 1px solid #eee; }
.day-number { position: relative; z-index: 1; padding: 2px 4px; background-color: rgba(255, 255, 255, 0.75); border-radius: 3px; display: inline-block; color: #000; }
.today .day-number { font-weight: bold; color: #000; border: 1px solid #000; }
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 15px; }
.modal-content { background-color: #fff; padding: 20px 25px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); width: 100%; max-width: 800px; max-height: 90vh; overflow-y: auto; position: relative; }
.modal-close-button { position: absolute; top: 12px; right: 15px; background: none; border: none; font-size: 1.8rem; line-height: 1; cursor: pointer; color: #888; }
.modal-close-button:hover { color: #333; }
.modal-title { margin-top: 0; margin-bottom: 20px; font-size: 1.4rem; color: #333; text-align: center; font-weight: 600; }
.modal-bulk-actions { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: center; gap: 10px; }
.modal-slot-list { padding-left: 0; list-style: none; }
.modal-content .slot-item { margin-bottom: 12px; padding: 12px 15px; }
.modal-no-events { text-align: center; color: #555; padding: 15px 0; }
.disabled-slot { background-color: #e0e0e0; cursor: not-allowed; opacity: 0.7; }
.date-modal-layout { display: flex; flex-direction: row; gap: 20px; }
.event-slots-container { flex: 2; min-width: 0; }
.personal-calendar-container { flex: 1; min-width: 0; border-left: 1px solid #e9ecef; padding-left: 20px; }
.personal-calendar-title { font-size: 1.1em; font-weight: 600; margin-bottom: 15px; color: #343a40; }
.personal-schedule-list { list-style: none; padding: 0; margin: 0; }
.personal-schedule-item { background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px; margin-bottom: 10px; }
.personal-schedule-title { font-weight: bold; display: block; margin-bottom: 5px; color: #212529; }
.personal-schedule-time { font-size: 0.9em; color: #495057; }
.personal-calendar-container .no-events-message { font-size: 0.9em; color: #6c757d; padding-top: 10px; }
@media (max-width: 768px) {
  .date-modal-layout { flex-direction: column; }
  .personal-calendar-container { border-left: none; border-top: 1px solid #e9ecef; padding-left: 0; padding-top: 20px; margin-top: 20px; }
}
</style>
