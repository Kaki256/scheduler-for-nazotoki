<template>
  <div class="schedule-page">
    <div class="header-section">
      <h1 class="event-title">{{ eventDisplayNameRef || 'イベント' }}日程調整</h1>
      <p class="event-subtitle">参加可能な日時を選択してください。</p>
      <router-link to="/events" class="button back-to-list-button">イベント一覧に戻る</router-link>
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
            placeholder="TRAQ ID"
            class="input-field"
            @change="onUsernameChange"
          />
        </div>
      </div>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </div>

    <div v-if="!loading && initialLoadDone && Object.keys(schedule).length > 0" class="schedule-display-section">
      <h2 class="section-title">開催日時・参加ステータス</h2>

      <!-- Weekday bulk actions (remains at the top) -->
      <!-- <div class="weekday-bulk-actions-container">
        <h3 class="bulk-actions-title">曜日ごとに詳細一括変更:</h3>
        <div v-for="(dayLabel, dayIndex) in weekdayLabels" :key="dayIndex" class="weekday-bulk-item">
          <div class="weekday-bulk-header">
            <span class="weekday-label">{{ dayLabel }}:</span>
            <button @click="openWeekdayBulkModal(dayIndex)" class="button small-button">
              詳細設定
            </button>
          </div>
        </div>
      </div> -->

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
                  <!-- Removed slot-indicator as background now shows status -->
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
          
          <!-- Content for Date Specific Modal -->
          <div v-if="modalMode === 'date'">
            <div class="date-bulk-actions modal-bulk-actions">
              <button 
                @click="setBulkStatusForDate(selectedDateForModal, 'going')" 
                :class="['button', 'bulk-action-button', 'bulk-going', { 'active': dateActiveBulkStatus[selectedDateForModal] === 'going' }]">
                全部行ける
              </button>
              <button 
                @click="setBulkStatusForDate(selectedDateForModal, 'maybe')" 
                :class="['button', 'bulk-action-button', 'bulk-maybe', { 'active': dateActiveBulkStatus[selectedDateForModal] === 'maybe' }]">
                全部微妙
              </button>
              <button 
                @click="setBulkStatusForDate(selectedDateForModal, 'not_going')" 
                :class="['button', 'bulk-action-button', 'bulk-not-going', { 'active': dateActiveBulkStatus[selectedDateForModal] === 'not_going' }]">
                全部行けない
              </button>
            </div>

            <ul v-if="slotsForModal.length > 0" class="slot-list modal-slot-list">
              <li v-for="slot in slotsForModal" :key="slot.originalStartTimeUTC" class="slot-item">
                <div class="slot-info">
                  <span class="slot-time">{{ new Date(slot.originalStartTimeUTC).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) }}</span>
                  <span v-if="slot.status" :class="['slot-availability', getSlotStatusClass(slot.status)]">
                    {{ formatSlotStatus(slot.status) }}
                  </span>
                </div>
                <div
                  class="user-status-selector clickable"
                  :class="getUserSlotClass(userSelection[slot.originalStartTimeUTC])"
                  @click="toggleSlotStatus(slot.originalStartTimeUTC)"
                  role="button"
                  tabindex="0"
                  @keydown.enter="toggleSlotStatus(slot.originalStartTimeUTC)"
                  @keydown.space.prevent="toggleSlotStatus(slot.originalStartTimeUTC)"
                  :aria-label="`スロット ${new Date(slot.originalStartTimeUTC).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })} のあなたのステータス: ${formatUserSelectionStatus(userSelection[slot.originalStartTimeUTC])}。クリックまたはEnter/Spaceで変更`"
                >
                  {{ formatUserSelectionStatus(userSelection[slot.originalStartTimeUTC]) }}
                </div>
              </li>
            </ul>
            <p v-else class="no-events-message modal-no-events">この日の開催情報はありません。</p>
          </div>

          <!-- Content for Weekday Bulk Modal -->
          <div v-if="modalMode === 'weekdayBulk'">
            <div v-if="selectedWeekdayForBulkModal !== null && getRepresentativeSlotsForDay(selectedWeekdayForBulkModal).length > 0" class="weekday-bulk-details-modal">
              <div class="weekday-overall-bulk-actions modal-bulk-actions">
                <button 
                  @click="setOverallBulkStatusForWeekday(selectedWeekdayForBulkModal, 'going')" 
                  :class="['button', 'bulk-action-button', 'bulk-going', { 'active': weekdayOverallActiveBulkStatus[selectedWeekdayForBulkModal] === 'going' }]">
                  全部行ける
                </button>
                <button 
                  @click="setOverallBulkStatusForWeekday(selectedWeekdayForBulkModal, 'maybe')" 
                  :class="['button', 'bulk-action-button', 'bulk-maybe', { 'active': weekdayOverallActiveBulkStatus[selectedWeekdayForBulkModal] === 'maybe' }]">
                  全部微妙
                </button>
                <button 
                  @click="setOverallBulkStatusForWeekday(selectedWeekdayForBulkModal, 'not_going')" 
                  :class="['button', 'bulk-action-button', 'bulk-not-going', { 'active': weekdayOverallActiveBulkStatus[selectedWeekdayForBulkModal] === 'not_going' }]">
                  全部行けない
                </button>
              </div>

              <ul class="slot-list modal-slot-list">
                <li v-for="slotTimeHHMM in getRepresentativeSlotsForDay(selectedWeekdayForBulkModal)" :key="slotTimeHHMM" class="slot-item">
                  <div class="slot-info">
                    <span class="slot-time">{{ slotTimeHHMM }}</span>
                    <!-- 曜日一括設定では元々のスロットの空き状況 (slot.status) は表示しない -->
                  </div>
                  <div
                    class="user-status-selector clickable"
                    :class="getUserSlotClass(bulkWeekdaySlotSelections[selectedWeekdayForBulkModal]?.[slotTimeHHMM])"
                    @click="toggleBulkSlotStatus(selectedWeekdayForBulkModal, slotTimeHHMM)"
                    role="button" 
                    tabindex="0"
                    @keydown.enter="toggleBulkSlotStatus(selectedWeekdayForBulkModal, slotTimeHHMM)"
                    @keydown.space.prevent="toggleBulkSlotStatus(selectedWeekdayForBulkModal, slotTimeHHMM)"
                    :aria-label="`曜日 ${weekdayLabels[selectedWeekdayForBulkModal]}, 時刻 ${slotTimeHHMM} の一括設定ステータス: ${formatUserSelectionStatus(bulkWeekdaySlotSelections[selectedWeekdayForBulkModal]?.[slotTimeHHMM])}。クリックまたはEnter/Spaceで変更`"
                  >
                    {{ formatUserSelectionStatus(bulkWeekdaySlotSelections[selectedWeekdayForBulkModal]?.[slotTimeHHMM]) }}
                  </div>
                </li>
              </ul>
              <button 
                @click="applyBulkWeekdaySelections(selectedWeekdayForBulkModal)" 
                class="button primary-button apply-bulk-weekday-button modal-apply-button">
                {{ weekdayLabels[selectedWeekdayForBulkModal] }}曜日の設定を全週に適用
              </button>
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
import { useRoute } from 'vue-router';
import axios from 'axios'; // axios をインポート

const route = useRoute();

const props = defineProps({
  orgSlug: { type: String, required: true },
  eventSlug: { type: String, required: true }
});

const eventDisplayNameRef = ref('');
const eventUrlRef = ref('');
const locationUidRef = ref('');

const formatDateForInput = (date) => date.toISOString().split('T')[0];
const todayForDefaults = new Date();

const currentStartDate = ref('');
const currentEndDate = ref('');

const formattedRecruitmentPeriod = computed(() => {
  if (!currentStartDate.value || !currentEndDate.value) return '';
  const startDate = new Date(currentStartDate.value);
  const endDate = new Date(currentEndDate.value);
  return `${startDate.toLocaleDateString('ja-JP')} - ${endDate.toLocaleDateString('ja-JP')}`;
});

const schedule = ref({});
const loading = ref(false);
const initialLoadDone = ref(false);
const errorMessage = ref('');

const userSelection = reactive({});
const savingSelections = ref(false);
const saveMessage = ref({ text: '', type: '' });

const dateActiveBulkStatus = reactive({}); // { [date]: 'going' | 'maybe' | 'not_going' | null }
const weekdayActiveBulkStatus = reactive({}); // { [dayIndex]: 'going' | 'maybe' | 'not_going' | null }
const weekdayOverallActiveBulkStatus = reactive({}); // { [dayIndex]: 'going' | 'maybe' | 'not_going' | null }

// モーダル状態管理の統合
const isModalOpen = ref(false); // 共通のモーダル表示状態
const modalMode = ref(''); // 'date' または 'weekdayBulk'
const selectedDateForModal = ref(null); // YYYY-MM-DD
const selectedWeekdayForBulkModal = ref(null); // 現在編集中の曜日のインデックス (0-6)
// const isWeekdayBulkModalOpen = ref(false); // 削除

const bulkWeekdaySlotSelections = reactive({}); // { dayIndex: { "HH:MM": "status", ... }, ... }

const weekdayRepresentativeSlots = computed(() => {
  const result = {}; // { 0: ["HH:MM", ...], 1: ["HH:MM", ...], ... }
  if (!schedule.value || Object.keys(schedule.value).length === 0) {
    for (let i = 0; i < 7; i++) result[i] = [];
    return result;
  }

  const foundWeekdays = new Set();

  // sortedSchedule.value を使って日付順に処理
  for (const dateKey of Object.keys(sortedSchedule.value)) {
    if (foundWeekdays.size === 7) break; // 全曜日の代表を見つけたら終了

    const dateObj = new Date(dateKey + 'T00:00:00Z'); // UTCとして解釈
    const dayIndex = dateObj.getUTCDay();

    if (!foundWeekdays.has(dayIndex)) {
      const slotsForDate = schedule.value[dateKey];
      if (slotsForDate && slotsForDate.length > 0) {
        result[dayIndex] = slotsForDate
          .map(slot => {
            try {
              // スロットの開始時刻を 'HH:MM' 形式 (Asia/Tokyo) で取得
              return new Date(slot.originalStartTimeUTC).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
            } catch (e) {
              console.error("Error formatting time for representative slot:", slot.originalStartTimeUTC, e);
              return null;
            }
          })
          .filter(time => time !== null)
          .sort((a, b) => a.localeCompare(b)); // 時刻文字列としてソート
        foundWeekdays.add(dayIndex);
      }
    }
  }

  // まだ代表スロットが見つかっていない曜日があれば空リストで初期化
  for (let i = 0; i < 7; i++) {
    if (!result[i]) { 
      result[i] = [];
    }
  }
  return result;
});

// 統合されたモーダルタイトル
const modalTitleId = 'unifiedModalTitle';
const modalTitleComputed = computed(() => {
  if (modalMode.value === 'date' && selectedDateForModal.value) {
    return formatDate(selectedDateForModal.value);
  } else if (modalMode.value === 'weekdayBulk' && selectedWeekdayForBulkModal.value !== null) {
    return `${weekdayLabels[selectedWeekdayForBulkModal.value]}曜日の一括設定`;
  }
  return '詳細設定'; // デフォルトタイトル
});


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];

// ステータスの循環順序
const possibleStatuses = ['going', 'maybe', 'not_going', undefined];

const sortedSchedule = computed(() => {
  if (!schedule.value || typeof schedule.value !== 'object') return {};
  return Object.entries(schedule.value)
    .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});
});

function formatDate(dateString) {
  if (!dateString) return '';
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
  try {
    return new Date(dateString + 'T00:00:00Z').toLocaleDateString('ja-JP', options);
  } catch(e) {
    return dateString;
  }
}

function formatSlotStatus(status) {
  const statusMap = {
    'available': '予約可', 'sold_out': '完売', 'few_tickets_left': '残りわずか',
    'on_sale_soon': '販売開始前', 'sales_ended': '販売終了', 'unknown': '不明'
  };
  return statusMap[status] || status;
}

function getSlotStatusClass(status) {
  switch (status) {
    case 'available': return 'status-available';
    case 'few_tickets_left': return 'status-few-tickets-left';
    case 'sold_out': return 'status-sold-out';
    case 'sales_ended': return 'status-sales-ended';
    case 'on_sale_soon': return 'status-on-sale-soon';
    default: return 'status-unknown';
  }
}

function getDayOfWeek(dateString) {
  // dateString is 'YYYY-MM-DD'
  // Need to be careful with timezone if just new Date(dateString) is used.
  // Assuming dateString is effectively a local date for the purpose of day of week.
  const [year, month, day] = dateString.split('-').map(Number);
  // JavaScript's Date month is 0-indexed.
  return new Date(year, month - 1, day).getDay(); // 0 for Sunday, 1 for Monday, ...
}

// selectUserStatus 関数を削除

// 新しい関数: ユーザーステータスに応じたCSSクラスを返す
function getUserSlotClass(status) {
  if (status === 'going') return 'status-going';
  if (status === 'maybe') return 'status-maybe';
  if (status === 'not_going') return 'status-not-going';
  return 'status-undefined'; // 未選択またはキーが存在しない場合
}

// 新しい関数: ユーザーステータスを日本語文字列で返す
function formatUserSelectionStatus(status) {
  if (status === 'going') return '行ける';
  if (status === 'maybe') return '微妙';
  if (status === 'not_going') return '行けない';
  return '未選択';
}

// 新しい関数: スロットのステータスをトグルする
function toggleSlotStatus(slotUtcTime) {
  const currentStatus = userSelection[slotUtcTime];
  const currentIndex = possibleStatuses.indexOf(currentStatus);
  const nextIndex = (currentIndex + 1) % possibleStatuses.length;
  const nextStatus = possibleStatuses[nextIndex];

  if (nextStatus === undefined) {
    delete userSelection[slotUtcTime]; // 未選択の場合はキーを削除
  } else {
    userSelection[slotUtcTime] = nextStatus;
  }

  saveMessage.value = { text: '', type: '' }; // 保存メッセージをクリア

  // バルクステータスのリセットロジック
  try {
    const datePart = slotUtcTime.substring(0, 10); // Extracts 'YYYY-MM-DD'
    if (dateActiveBulkStatus[datePart] !== undefined) {
      dateActiveBulkStatus[datePart] = null;
    }
    
    const dayIndex = getDayOfWeek(datePart);
    if (weekdayActiveBulkStatus[dayIndex] !== undefined) {
      weekdayActiveBulkStatus[dayIndex] = null;
    }
  } catch (e) {
    console.error("Error processing slotUtcTime for bulk status reset:", e);
  }
  console.log(`Toggled status to: ${nextStatus} for slot: ${slotUtcTime}. Current userSelection:`, JSON.parse(JSON.stringify(userSelection)));
}


// 日付ごとの一括変更処理
function setBulkStatusForDate(date, status) {
  if (schedule.value[date] && Array.isArray(schedule.value[date])) {
    schedule.value[date].forEach(slot => {
      if (slot && slot.originalStartTimeUTC) {
        userSelection[slot.originalStartTimeUTC] = status;
      }
    });
    dateActiveBulkStatus[date] = status;
    // Potentially reset related weekday bulk status if this action makes it inconsistent
    // For simplicity, we'll only set the date one for now.
    // Or, we could try to determine if this date action makes a weekday fully one status.
    const dayIndex = getDayOfWeek(date);
    weekdayActiveBulkStatus[dayIndex] = null; // Reset weekday if a specific date within it is changed

    saveMessage.value = { text: '', type: '' }; // 保存メッセージをクリア
    console.log(`Bulk status '${status}' set for date '${date}'`, JSON.parse(JSON.stringify(userSelection)));
  }
}

// 曜日ごとの一括変更処理 (0:日曜, 1:月曜, ..., 6:土曜) - 新しいUIに置き換えられるため削除
/*
function setBulkStatusForWeekday(targetDayIndex, status) {
  // ... (古いコード) ...
}
*/

// 新しい曜日別詳細一括設定関連の関数
function getRepresentativeSlotsForDay(dayIndex) {
  // weekdayRepresentativeSlots.value が存在し、dayIndex キーを持つことを確認
  return weekdayRepresentativeSlots.value && weekdayRepresentativeSlots.value[dayIndex] 
    ? weekdayRepresentativeSlots.value[dayIndex] 
    : [];
}

// openWeekdayBulkModal をモーダル統合版に更新
function openWeekdayBulkModal(dayIndex) {
  modalMode.value = 'weekdayBulk';
  selectedWeekdayForBulkModal.value = dayIndex;
  // bulkWeekdaySlotSelections[dayIndex] が未定義なら初期化
  if (!bulkWeekdaySlotSelections[dayIndex]) {
    bulkWeekdaySlotSelections[dayIndex] = {};
    const representativeSlots = getRepresentativeSlotsForDay(dayIndex);
    representativeSlots.forEach(slotTimeHHMM => {
      // 初期状態は未選択 (undefined)
      bulkWeekdaySlotSelections[dayIndex][slotTimeHHMM] = undefined;
    });
  }
  // モーダルを開く際に、その曜日の全体一括ステータスをリセット
  weekdayOverallActiveBulkStatus[dayIndex] = null;
  isModalOpen.value = true; // 共通モーダルを開く
}

// toggleBulkSlotStatus は特定の曜日の特定の代表スロットのステータスをトグルします
// (この関数は上で定義済み、内容確認・重複削除)

// ★★★ START: 新しい関数 ★★★
function setOverallBulkStatusForWeekday(dayIndex, status) {
  if (dayIndex === null || !bulkWeekdaySlotSelections[dayIndex]) {
    console.warn('Cannot set overall bulk status: dayIndex is null or no bulk selections initialized for this dayIndex.');
    return;
  }
  const representativeSlots = getRepresentativeSlotsForDay(dayIndex);
  if (!representativeSlots || representativeSlots.length === 0) {
    console.warn('No representative slots to set overall status for.');
    return;
  }

  let allSlotsUpdated = true;
  representativeSlots.forEach(slotTimeHHMM => {
    if (bulkWeekdaySlotSelections[dayIndex].hasOwnProperty(slotTimeHHMM)) {
      bulkWeekdaySlotSelections[dayIndex][slotTimeHHMM] = status;
    } else {
      // This case should ideally not happen if bulkWeekdaySlotSelections is properly initialized
      // with all representative slots.
      console.warn(`Slot ${slotTimeHHMM} not found in bulk selections for dayIndex ${dayIndex}. Initializing it.`);
      bulkWeekdaySlotSelections[dayIndex][slotTimeHHMM] = status; 
    }
  });

  if(allSlotsUpdated){
    weekdayOverallActiveBulkStatus[dayIndex] = status;
  } else {
    // If somehow not all slots could be updated (e.g. representativeSlots had items not in bulkWeekdaySlotSelections)
    // then the overall status might be inconsistent, so reset it.
    weekdayOverallActiveBulkStatus[dayIndex] = null;
  }
  
  saveMessage.value = { text: '', type: '' }; // 保存メッセージをクリア
  console.log(`Overall bulk status '${status}' set for weekday index '${dayIndex}' in modal. Selections:`, JSON.parse(JSON.stringify(bulkWeekdaySlotSelections[dayIndex])));
}
// ★★★ END: 新しい関数 ★★★

// applyBulkWeekdaySelections は特定の曜日のモーダルで設定された各スロットのステータスを、
// 実際の userSelection に適用します。
// (この関数は上で定義済み、内容確認・重複削除)


// toggleBulkSlotStatus は特定の曜日の特定の代表スロットのステータスをトグルします
// (この関数は上で定義済み、内容確認・重複削除)

function applyBulkWeekdaySelections(dayIndex) {
  const selectionsForWeekday = bulkWeekdaySlotSelections[dayIndex];
  if (!selectionsForWeekday) {
    console.warn(`No bulk selections found for weekday index ${dayIndex}.`);
    return;
  }

  let changesMade = false;
  Object.keys(sortedSchedule.value).forEach(dateKey => {
    const dateObject = new Date(dateKey + 'T00:00:00Z'); // UTCとして解釈
    if (dateObject.getUTCDay() === dayIndex) { // 対象の曜日か確認
      if (schedule.value[dateKey] && Array.isArray(schedule.value[dateKey])) {
        schedule.value[dateKey].forEach(slot => {
          if (slot && slot.originalStartTimeUTC) {
            let slotTimeHHMM;
            try {
              slotTimeHHMM = new Date(slot.originalStartTimeUTC).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
            } catch (e) {
              console.error("Error formatting slot time during bulk apply:", slot.originalStartTimeUTC, e);
              return; // このスロットはスキップ
            }

            // 代表スロットの時刻と一致するか確認
            if (selectionsForWeekday.hasOwnProperty(slotTimeHHMM)) {
              const newStatus = selectionsForWeekday[slotTimeHHMM];
              const currentActualStatus = userSelection[slot.originalStartTimeUTC];

              if (newStatus === undefined) { // 未選択に設定する場合
                if (currentActualStatus !== undefined) { // 既に何か選択されていれば削除
                  delete userSelection[slot.originalStartTimeUTC];
                  changesMade = true;
                }
              } else { // 'going', 'maybe', 'not_going' に設定する場合
                if (currentActualStatus !== newStatus) { // 状態が異なる場合のみ更新
                  userSelection[slot.originalStartTimeUTC] = newStatus;
                  changesMade = true;
                }
              }
              // この日付の dateActiveBulkStatus をリセット (変更があった場合のみでも良いが、簡潔さのため常に)
              if (dateActiveBulkStatus[dateKey] !== undefined && dateActiveBulkStatus[dateKey] !== null) {
                 dateActiveBulkStatus[dateKey] = null;
              }
            }
          }
        });
      }
    }
  });

  if (changesMade) {
    saveMessage.value = { text: '', type: '' }; // 保存メッセージをクリア
    console.log(`Applied bulk selections for weekday ${dayIndex}. Current userSelection:`, JSON.parse(JSON.stringify(userSelection)));
  }
  
  // 曜日別の一括設定UIのアクティブ状態（もしあれば）をリセット
  if (weekdayActiveBulkStatus[dayIndex] !== undefined && weekdayActiveBulkStatus[dayIndex] !== null) {
    weekdayActiveBulkStatus[dayIndex] = null;
  }
  closeModal(); // 共通モーダルを閉じる
}


const username = ref(''); // 初期値を空文字列に設定

async function fetchUsername() {
  try {
    console.log('[Auth] Fetching username...');
    const response = await axios.get(`${API_BASE_URL}/get-username`);
    if (response.data && response.data.username) {
      username.value = response.data.username;
      console.log('[Auth] Username fetched:', username.value);
    } else {
      console.log('[Auth] Username not found in response or is null.');
      username.value = ''; // or a default/guest username
    }
  } catch (error) {
    console.error('[Auth] Error fetching username:', error);
    errorMessage.value = 'ユーザー名の取得に失敗しました。';
    username.value = ''; // エラー時もクリア
  }
}

async function fetchScheduleData(eventUrl, dateFrom, dateTo, locationUid) {
  if (!eventUrl || !dateFrom || !dateTo || !locationUid) {
    console.warn('[ScheduleFetch] Missing parameters for fetchScheduleData. Required: eventUrl, dateFrom, dateTo, locationUid. Received:', { eventUrl, dateFrom, dateTo, locationUid });
    schedule.value = { dates: [], message: 'スケジュール取得に必要な情報が不足しています。' };
    return;
  }
  console.log(`[ScheduleFetch] Fetching schedule for ${eventUrl} from ${dateFrom} to ${dateTo} for location ${locationUid}`);
  loading.value = true;
  errorMessage.value = '';
  schedule.value = {}; // Reset schedule before fetching

  try {
    // APIエンドポイントとメソッドを変更
    const response = await axios.post(`${API_BASE_URL}/get-schedule`, {
      event_url: eventUrl,
      date_from: dateFrom,
      date_to: dateTo,
      location_uid: locationUid
    });

    console.log('[ScheduleFetch] Raw API Response:', JSON.parse(JSON.stringify(response.data))); // ★ 詳細なレスポンス全体ログ
    console.log('[ScheduleFetch] Raw API Response Data:', JSON.parse(JSON.stringify(response.data))); // ★ レスポンスデータログ

    if (response.data && typeof response.data === 'object') { // Object.keysチェックを一旦削除してdata自体の存在を確認
      console.log('[ScheduleFetch] Processing response.data.dates:', response.data.dates ? JSON.parse(JSON.stringify(response.data.dates)) : 'response.data.dates is undefined/null'); // ★ dates配列のログ

      const formattedSchedule = {};
      if (response.data.dates && Array.isArray(response.data.dates)) {
        if (response.data.dates.length === 0) {
            console.log('[ScheduleFetch] response.data.dates is an empty array.');
        }
        response.data.dates.forEach(dateEntry => {
          if (dateEntry && dateEntry.date && Array.isArray(dateEntry.slots)) { // ★ dateEntry と slots の存在チェックを追加
            const dateKey = dateEntry.date; // YYYY-MM-DD
            formattedSchedule[dateKey] = dateEntry.slots.map(slot => ({
              time: new Date(slot.startAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }),
              status: slot.vacancyType, 
              originalStartTimeUTC: slot.startAt,
            }));
          } else {
            console.warn('[ScheduleFetch] Invalid dateEntry or slots missing:', dateEntry);
          }
        });
        schedule.value = formattedSchedule;
      } else {
        console.warn('[ScheduleFetch] response.data.dates is missing, not an array, or main response.data is empty. Response data:', JSON.parse(JSON.stringify(response.data)));
        // フォールバックロジックは現状維持 (allTimeSlotsUTC)
        if (response.data.allTimeSlotsUTC && Array.isArray(response.data.allTimeSlotsUTC)) {
            const tempSchedule = {};
            response.data.allTimeSlotsUTC.forEach(utcTime => {
                const date = new Date(utcTime);
                const dateKey = date.toISOString().split('T')[0];
                if (!tempSchedule[dateKey]) {
                    tempSchedule[dateKey] = [];
                }
                tempSchedule[dateKey].push({
                    time: date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }),
                    status: 'unknown', 
                    originalStartTimeUTC: utcTime,
                });
            });
            for (const dateKey in tempSchedule) {
                tempSchedule[dateKey].sort((a, b) => new Date(a.originalStartTimeUTC) - new Date(b.originalStartTimeUTC));
            }
            schedule.value = tempSchedule;
            console.log('[ScheduleFetch] Constructed schedule from allTimeSlotsUTC:', schedule.value);
        } else {
            console.warn('[ScheduleFetch] No parsable schedule data found in response.data.dates or response.data.allTimeSlotsUTC. Setting schedule to empty.');
            schedule.value = {}; 
        }
      }
      console.log('[ScheduleFetch] Formatted schedule (after processing):', JSON.parse(JSON.stringify(schedule.value)));
      if (Object.keys(schedule.value).length === 0 && !errorMessage.value) {
          console.log('[ScheduleFetch] No schedule slots found for the given period/event.');
          // errorMessage.value = '対象期間に開催情報が見つかりませんでした。'; // これは表示メッセージなので、ここではログに留める
      }
    } else {
      console.warn('[ScheduleFetch] No schedule data received or data is empty/invalid type.');
      schedule.value = {};
      if (!errorMessage.value) { // エラーメッセージが他で設定されていなければ
        // errorMessage.value = 'スケジュールデータを取得できませんでした。';
      }
    }
  } catch (err) {
    console.error('[ScheduleFetch] Error fetching schedule:', err);
    let errorMsg = 'スケジュールの取得に失敗しました';
    if (err.response) {
      console.error('[ScheduleFetch] Error response data:', err.response.data);
      console.error('[ScheduleFetch] Error response status:', err.response.status);
      errorMsg += ` (ステータス: ${err.response.status})`;
      if (err.response.data && err.response.data.error) {
        errorMsg += `: ${err.response.data.error}`;
      }
    } else if (err.request) {
      console.error('[ScheduleFetch] Error request:', err.request);
      errorMsg += '。サーバーからの応答がありません。';
    } else {
      errorMsg += `。エラー: ${err.message}`;
    }
    errorMessage.value = errorMsg;
    schedule.value = {}; // エラー時はスケジュールをクリア
  } finally {
    loading.value = false;
    initialLoadDone.value = true; // 初回ロード試行完了
    console.log('[ScheduleFetch] Fetch schedule finished. Loading:', loading.value, 'InitialLoadDone:', initialLoadDone.value);
    // ユーザー名が取得できていれば、続けてユーザーステータスをロード
    if (username.value && eventUrlRef.value) {
      console.log('[ScheduleFetch] Triggering loadUserStatus after schedule fetch. Username:', username.value, 'EventURL:', eventUrlRef.value);
      await loadUserStatus(username.value, eventUrlRef.value);
    } else {
      console.warn('[ScheduleFetch] Skipping loadUserStatus because username or eventUrl is missing.', { username: username.value, eventUrl: eventUrlRef.value });
    }
  }
}

async function fetchEventDetailsBySlugs(orgSlug, eventSlug) {
  // Reconstruct the full eventUrl from slugs
  // Ensuring it ends with a trailing slash to match backend normalization
  const eventUrl = `https://escape.id/org/${orgSlug}/event/${eventSlug}/`;
  console.log(`[SchedulePage] Reconstructed eventUrl: ${eventUrl}`);

  loading.value = true;
  errorMessage.value = '';
  // Use the already reconstructed and normalized eventUrl for eventUrlRef
  eventUrlRef.value = eventUrl; 
  console.log('[EventDetailsFetch] Using eventUrl for API call:', eventUrl);

  try {
    const encodedEventUrl = encodeURIComponent(eventUrl); // Use the normalized eventUrl
    const response = await axios.get(`${API_BASE_URL}/events/${encodedEventUrl}`);
    const eventDetails = response.data;

    locationUidRef.value = eventDetails.locationUid;
    currentStartDate.value = formatDateForInput(new Date(eventDetails.startDate));
    currentEndDate.value = formatDateForInput(new Date(eventDetails.endDate));
    eventDisplayNameRef.value = eventDetails.name;

    // データ取得後、スケジュールデータをフェッチ
    if (eventUrlRef.value && currentStartDate.value && currentEndDate.value && locationUidRef.value) {
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
  if (props.orgSlug && props.eventSlug) {
    await fetchEventDetailsBySlugs(props.orgSlug, props.eventSlug);
  } else {
    errorMessage.value = 'イベント情報が不足しています。';
    loading.value = false;
  }
  // initialLoadDone は fetchEventDetailsBySlug の中で設定される
}

onMounted(async () => {
  await initializePage();
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

// Watch for changes in route query parameters to re-initialize if eventUrl changes
watch(() => [props.orgSlug, props.eventSlug], async (newSlugs, oldSlugs) => {
  const [newOrgSlug, newEventSlug] = newSlugs;
  if (newOrgSlug && newEventSlug) {
    console.log('[Watch Slugs] orgSlug or eventSlug changed, re-initializing with:', newOrgSlug, newEventSlug);
    await fetchEventDetailsBySlugs(newOrgSlug, newEventSlug);
    if (username.value && eventUrlRef.value) { // Ensure eventUrlRef is set
      await loadUserStatus(username.value, eventUrlRef.value);
    }
  }
}, { immediate: false }); // immediate: true だと onMounted と二重実行の可能性があるので注意

// ユーザー名が変更されたら、そのユーザーの選択をロードする
watch(username, async (newUsername, oldUsername) => {
  console.log(`[Watch] Username changed from "${oldUsername}" to "${newUsername}"`);
  if (newUsername && eventUrlRef.value && newUsername !== oldUsername) {
    console.log('[Watch] Username changed, attempting to load user status for:', newUsername);
    await loadUserStatus(newUsername, eventUrlRef.value);
  } else if (!newUsername) {
    // ユーザー名がクリアされた場合、選択もクリアする（またはゲスト状態にする）
    Object.keys(userSelection).forEach(key => delete userSelection[key]);
    console.log('[Watch] Username cleared, user selections cleared.');
  }
});

function onUsernameChange() {
  // この関数は v-model で username が更新された後に呼ばれるので、
  // watch(username, ...) がその変更を検知して loadUserStatus を呼び出す。
  // 必要であれば、ここに追加のロジック（例: localStorageへの保存など）を記述。
  console.log('Username input changed, current value:', username.value);
  saveMessage.value = { text: '', type: '' }; // ユーザー変更時は保存メッセージをクリア
}

async function loadUserStatus(user, url) {
  if (!user || !url) {
    console.warn('[StatusLoad] Missing user or url for loadUserStatus. User:', user, 'URL:', url);
    // ユーザー選択をクリアする（オプション）
    Object.keys(userSelection).forEach(key => delete userSelection[key]);
    return;
  }
  console.log(`[StatusLoad] Loading user status for ${user} and ${url}`);
  errorMessage.value = ''; // 読み込み開始時にエラーメッセージをクリア

  try {
    const response = await axios.get(`${API_BASE_URL}/load-my-status`, {
      params: { username: user, eventUrl: url },
    });
    if (response.data && Array.isArray(response.data)) {
      Object.keys(userSelection).forEach(key => delete userSelection[key]);
      response.data.forEach(item => {
        userSelection[item.event_datetime_utc] = item.status;
      });
      console.log('[StatusLoad] User status loaded and applied:', JSON.parse(JSON.stringify(userSelection)));
      Object.keys(dateActiveBulkStatus).forEach(key => dateActiveBulkStatus[key] = null);
      Object.keys(weekdayActiveBulkStatus).forEach(key => weekdayActiveBulkStatus[key] = null);
    } else if (response.data && Object.keys(response.data).length === 0) {
        console.log('[StatusLoad] No saved status found for this user/event. Clearing local selections.');
        Object.keys(userSelection).forEach(key => delete userSelection[key]);
        Object.keys(dateActiveBulkStatus).forEach(key => dateActiveBulkStatus[key] = null);
        Object.keys(weekdayActiveBulkStatus).forEach(key => weekdayActiveBulkStatus[key] = null);
    } else {
      console.warn('[StatusLoad] Received unexpected data format:', response.data);
      errorMessage.value = '以前の選択の読み込み中に予期せぬデータ形式を受信しました。';
    }
  } catch (error) {
    console.error('[StatusLoad] Error loading user status:', error);
    let userFriendlyMessage = '以前の選択の読み込みに失敗しました。';
    if (error.response && error.response.data && typeof error.response.data === 'object' && error.response.data.error) {
      userFriendlyMessage += ` サーバーエラー: ${error.response.data.error}`;
      if (error.response.data.details) {
        userFriendlyMessage += ` 詳細: ${error.response.data.details}`;
      }
    } else if (error.response && typeof error.response.data === 'string' && error.response.data.includes('ReferenceError: rows is not defined')) {
      // このケースはサーバー側の古いエラーの名残かもしれないが、念のためキャッチ
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
    saveMessage.value = { text: 'ユーザー名を入力してください。', type: 'error' }; // errorMessageではなくsaveMessageに表示
    return;
  }
  if (!eventUrlRef.value) {
    saveMessage.value = { text: 'イベントURLが不明です。保存できません。', type: 'error' };
    return;
  }
  savingSelections.value = true;
  saveMessage.value = { text: '', type: '' };

  try {
    const selectionsToSave = Object.keys(userSelection).map(key => ({
      event_datetime_utc: key, // キーを event_datetime_utc に変更
      status: userSelection[key],
    }));

    console.log('[SaveSelections] Attempting to save:', {
      username: username.value,
      eventUrl: eventUrlRef.value, // eventUrl を追加
      selections: selectionsToSave
    });

    const response = await axios.post(`${API_BASE_URL}/save-my-status`, { // エンドポイントを /save-my-status に変更
      username: username.value,
      eventUrl: eventUrlRef.value, // eventUrl を追加
      selections: selectionsToSave,
    });

    // バックエンド /api/save-my-status は 204 No Content を返す想定
    // そのため、response.data を直接チェックする代わりにステータスコードで成功を判断
    if (response.status === 204) {
      saveMessage.value = { text: '選択が保存されました。', type: 'success' };
      console.log('[SaveSelections] Selections saved successfully.');
    } else {
      // 204以外のステータスコードや、万が一データが返ってきた場合の処理
      saveMessage.value = { text: '選択の保存に失敗しました。サーバーからの応答が予期せぬものです。', type: 'error' };
      console.warn('[SaveSelections] Unexpected server response status or data:', response);
    }
  } catch (error) {
    console.error('[SaveSelections] Error saving selections:', error);
    saveMessage.value = { text: '選択の保存中にエラーが発生しました。', type: 'error' };
  } finally {
    savingSelections.value = false;
  }
}

const slotsForModal = computed(() => {
  if (modalMode.value !== 'date' || !selectedDateForModal.value || !schedule.value[selectedDateForModal.value]) {
    return [];
  }
  // schedule.value[dateString] は既にソートされている想定だが、念のためソートする
  return [...schedule.value[selectedDateForModal.value]].sort((a, b) =>
    new Date(a.originalStartTimeUTC) - new Date(b.originalStartTimeUTC)
  );
});

// Calendar generation logic
const calendarMonths = computed(() => {
  if (!currentStartDate.value || !currentEndDate.value || !initialLoadDone.value) { // initialLoadDoneもチェック
    return [];
  }

  const months = [];
  // currentStartDateとcurrentEndDateをDateオブジェクトとして正しく扱う
  // UTCの日付部分のみを考慮するため、T00:00:00Z を付与してパース
  let loopStartDate = new Date(currentStartDate.value + 'T00:00:00Z');
  const loopEndDate = new Date(currentEndDate.value + 'T00:00:00Z');

  let currentDateIterator = new Date(Date.UTC(loopStartDate.getUTCFullYear(), loopStartDate.getUTCMonth(), 1));

  while (currentDateIterator.getUTCFullYear() < loopEndDate.getUTCFullYear() || 
        (currentDateIterator.getUTCFullYear() === loopEndDate.getUTCFullYear() && currentDateIterator.getUTCMonth() <= loopEndDate.getUTCMonth())) {
    const year = currentDateIterator.getUTCFullYear();
    const month = currentDateIterator.getUTCMonth(); // 0-indexed

    const monthName = `${year}年${month + 1}月`;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const firstDayOfMonthWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0 (Sun) - 6 (Sat)

    const weeks = [];
    let currentWeek = [];
    
    for (let i = 0; i < firstDayOfMonthWeekday; i++) {
      currentWeek.push({ empty: true, key: `empty-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(Date.UTC(year, month, day));
      const dateString = dateObj.toISOString().split('T')[0];
      
      const isWithinEventRange = dateObj >= loopStartDate && dateObj <= loopEndDate;
      
      const hasSlots = schedule.value[dateString] && schedule.value[dateString].length > 0;
      
      currentWeek.push({
        date: day,
        dateString,
        isToday: new Date().toISOString().split('T')[0] === dateString,
        hasSlots,
        isClickable: hasSlots && isWithinEventRange,
        isWithinEventRange,
        key: dateString
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ empty: true, key: `empty-end-${currentWeek.length}` });
      }
      weeks.push(currentWeek);
    }
    months.push({ monthName, weeks, key: monthName });

    currentDateIterator.setUTCMonth(currentDateIterator.getUTCMonth() + 1);
  }
  return months;
});


function openModalForDate(dateString) {
  if (!schedule.value[dateString] || schedule.value[dateString].length === 0) {
    console.log(`No slots for date ${dateString}, not opening modal.`);
    return;
  }
  modalMode.value = 'date'; // モードを設定
  selectedDateForModal.value = dateString;
  isModalOpen.value = true; // 共通モーダルを開く
  console.log(`Modal opened for date: ${dateString}`);
}

function closeModal() {
  isModalOpen.value = false;
  modalMode.value = '';
  selectedDateForModal.value = null;
  // selectedWeekdayForBulkModal.value = null; // 曜日選択は維持しても良いかもしれない
}

const handleKeydown = (e) => {
  if (e.key === 'Escape' && isModalOpen.value) {
    closeModal(); // 共通の closeModal を呼ぶ
  }
};

const statusToColor = {
  going: 'lightgreen',
  maybe: 'yellow',
  not_going: 'lightcoral',
  unselected: 'lightcyan', // Default color for unselected slots
};

const getWeekdayHeaderStyle = (dayIndex) => {
  const representativeSlots = getRepresentativeSlotsForDay(dayIndex); // 代表スロットを取得しておく

  if (representativeSlots.length === 0) {
    return { backgroundColor: '#f9f9f9', color: '#6c757d' }; // No slots, light gray background
  }
  const colorStops = [];
  const slotCount = representativeSlots.length;
  const slotHeightPercent = 100 / slotCount;
  representativeSlots.forEach((slotTimeHHMM, index) => {
    const status = bulkWeekdaySlotSelections[dayIndex] && bulkWeekdaySlotSelections[dayIndex][slotTimeHHMM];
    const color = statusToColor[status] || statusToColor.unselected; // Use unselected color if not set
    const startPercent = index * slotHeightPercent;
    const endPercent = (index + 1) * slotHeightPercent;
    colorStops.push(`${color} ${startPercent}%`);
    colorStops.push(`${color} ${endPercent}%`);
  });
  if (colorStops.length === 0) {
    return { backgroundColor: '#f9f9f9', color: '#6c757d' }; // Default style if no slots
  }
  return {
    background: `linear-gradient(to bottom, ${colorStops.join(', ')})`,
    color: '#343a40', // Dark text for contrast
  };
};

const getDayStyle = (dayObject) => {
  // dayObject is now the day object from calendarMonths, e.g., { date: 1, dateString: '2024-05-01', ... }
  if (!dayObject || !dayObject.dateString || !schedule.value) return {};
  const dateStr = dayObject.dateString;

  // schedule.value is now an object where keys are date strings 'YYYY-MM-DD'
  // and values are arrays of slot objects.
  const slotsForDay = schedule.value[dateStr] 
    ? [...schedule.value[dateStr]].sort((a, b) => new Date(a.originalStartTimeUTC).getTime() - new Date(b.originalStartTimeUTC).getTime()) 
    : [];

  if (slotsForDay.length === 0) {
    // No slots for this day, return default style or style for non-event days
    // This part depends on how you want to style days without slots but within the month view.
    // For now, just return empty if no slots, or a specific style if it's not in the event range.
    return !dayObject.isWithinEventRange && !dayObject.empty ? { backgroundColor: '#f9f9f9' } : {};
  }

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

  return {
    background: `linear-gradient(to bottom, ${colorStops.join(', ')})`,
  };
};

</script>

<style scoped>
/* frontend/src/components/SchedulePage.vue の <style scoped> 内 */

/* Apply border-box to all elements within this component for easier sizing */
.schedule-page *, .schedule-page *::before, .schedule-page *::after {
  box-sizing: border-box;
}

.schedule-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f9f9f9; /* Light gray background for the whole page */
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  font-family: 'Helvetica Neue', Arial, sans-serif;
}

.back-to-list-button {
  background-color: #6c757d; /* Secondary button color */
  color: white;
  margin-top: 10px;
  /* 必要に応じて他のスタイルを追加 */
}

.back-to-list-button:hover:not(:disabled) {
  background-color: #5a6268;
}


.header-section {
  margin-bottom: 2rem;
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.event-title {
  font-size: 1.75rem; /* Slightly smaller */
  font-weight: 600;
  color: #343a40;
  margin-bottom: 0.3rem;
}

.event-subtitle {
  color: #6c757d; /* Bootstrap secondary text color */
  font-size: 0.9rem;
  margin-top: 0.1rem;
}

.controls-section {
  margin-bottom: 2rem;
  padding: 1.5rem; /* Adjusted padding */
  background-color: #ffffff;
  border-radius: 8px; /* Standardized radius */
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05); /* Softer shadow */
  border: 1px solid #dee2e6; /* Subtle border */
}

.input-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); /* Adjusted minmax */
  gap: 1rem; /* Adjusted gap */
  margin-bottom: 1rem;
}

.input-label {
  display: block;
  font-size: 0.8rem; /* Smaller label */
  font-weight: 500;
  color: #495057;
  margin-bottom: 0.3rem; /* Reduced margin */
}

.input-field {
  width: 100%;
  padding: 0.65rem 0.8rem; /* Adjusted padding */
  border: 1px solid #ced4da;
  border-radius: 4px; /* Sharper radius */
  box-shadow: inset 0 1px 1px rgba(0,0,0,0.03);
  color: #495057;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  font-size: 0.85rem;
  background-color: #fff;
}
.input-field.display-only-input {
  background-color: #e9ecef;
  cursor: default;
  color: #6c757d;
}
.input-field:focus {
  border-color: #007bff;
  outline: none;
  border-color: #86b7fe; /* Bootstrap focus color */
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
}
.date-input {
  min-height: calc(0.65rem * 2 + 0.85rem + 2px);
  appearance: none;
}

.fetch-button-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.button {
  font-weight: 500;
  padding: 0.6rem 1.2rem; /* Adjusted padding */
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.05s ease; /* Faster transform */
  cursor: pointer;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem; /* Smaller button text */
  line-height: 1.5;
  text-decoration: none;
}
.button:hover:not(:disabled) {
   box-shadow: 0 2px 4px rgba(0,0,0,0.07);
   transform: translateY(-1px);
}
.button:active:not(:disabled) {
  transform: translateY(0px);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.05); /* Inset shadow on active */
}
.button:focus-visible { /* Use focus-visible for better accessibility */
  outline: none;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.35);
}
.button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.primary-button {
  background-color: #0d6efd; /* Bootstrap primary */
  color: #ffffff;
  border-color: #0d6efd;
}
.primary-button:hover:not(:disabled) {
  background-color: #0b5ed7;
  border-color: #0a58ca;
}
.primary-button:focus-visible {
  box-shadow: 0 0 0 0.2rem rgba(49,132,253,.5);
}

.loading-spinner {
  animation: spin 0.75s linear infinite;
  margin-right: 0.5em;
  height: 1em;
  width: 1em;
}

.error-message {
  margin-top: 0.75rem;
  color: #b02a37; /* Darker, less saturated red */
  font-size: 0.8rem;
  font-weight: 500;
  text-align: right;
}

.schedule-display-section {
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
  border: 1px solid #dee2e6;
  padding: 1rem; /* 1.5rem から変更 */
  margin-top: 1.5rem; /* 2rem から変更 */
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem; /* 1rem から変更 */
  color: #343a40;
  border-bottom: 1px solid #e9ecef;
  padding-bottom: 0.5rem; /* 0.75rem から変更 */
}

.schedule-scroll-container {
  overflow-y: auto; /* 日付リストが縦に長い場合にスクロール */
  overflow-x: hidden; /* 横スクロールは各行で制御するのでここでは隠す */
  width: 100%;
  max-height: 70vh; /* 例: ビューポートの高さの70%に制限 */
}

.schedule-grid {
  display: flex;
  flex-direction: column; /* 日付を縦に並べる */
  padding-bottom: 2px; /* 4px から変更 */
}

.date-column {
  display: flex;
  flex-direction: column; /* 日付ヘッダーとスロットリストを縦積みにする */
  align-items: stretch; /* 幅を親要素に合わせる */
  border-bottom: 1px solid #eee;
  padding: 5px 0; /* 10px 0 から変更 */
}

.date-header {
  min-width: auto; /* 最小幅を解除 */
  width: 100%;    /* 幅を100%にする */
  padding: 5px; /* 10px から変更 */
  font-weight: bold;
  text-align: left; 
  padding-bottom: 3px; /* 5px から変更 */
  border-bottom: 1px solid #f0f0f0; 
  margin-bottom: 5px; /* 10px から変更 */
}

.slot-list {
  list-style: none;
  padding: 0;
  margin-top: 10px;
}

.slot-item {
  background-color: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 10px 15px;
  margin-bottom: 10px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.slot-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px; /* セレクタとの間隔 */
  font-size: 0.95em;
}

.slot-time {
  font-weight: bold;
  color: #333;
}

.slot-availability {
  font-size: 0.85em;
  padding: 3px 8px;
  border-radius: 4px;
  color: #fff;
}

/* ... existing status-available, etc. styles ... */
.status-available { background-color: #4CAF50; }
.status-few-tickets-left { background-color: #FFC107; color: #000 !important; } /* 文字色を黒に */
.status-sold-out { background-color: #F44336; }
.status-sales-ended { background-color: #757575; }
.status-on-sale-soon { background-color: #2196F3; }
.status-unknown { background-color: #9E9E9E; }


/* New styles for user-status-selector */
.user-status-selector {
  padding: 10px;
  border-radius: 5px;
  text-align: center;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out, border-color 0.2s ease-in-out;
  font-weight: 500;
  border: 2px solid transparent; /* 枠線用にスペースを確保 */
}

.user-status-selector.status-undefined {
  background-color: #f0f0f0;
  color: #555;
  border: 2px dashed #ccc;
}
.user-status-selector.status-undefined:hover {
  background-color: #e0e0e0;
  border-color: #bbb;
}

.user-status-selector.status-going {
  background-color: #4CAF50; /* 緑 */
  color: white;
  border-color: #388E3C;
}
.user-status-selector.status-going:hover {
  background-color: #45a049;
}

.user-status-selector.status-maybe {
  background-color: #FFC107; /* 黄色 */
  color: black;
  border-color: #FFA000;
}
.user-status-selector.status-maybe:hover {
  background-color: #ffb300;
}

.user-status-selector.status-not-going {
  background-color: #F44336; /* 赤 */
  color: white;
  border-color: #D32F2F;
}
.user-status-selector.status-not-going:hover {
  background-color: #e53935;
}

.user-status-selector.clickable:focus {
  outline: 2px solid #007bff;
  outline-offset: 2px;
}


/* ... other existing styles ... */
.save-button-container {
  margin-top: 25px;
  text-align: center;
}

.save-selections-button {
  padding: 12px 25px;
  font-size: 1.1em;
}

.save-message {
  margin-top: 10px;
  font-size: 0.9em;
}
.save-message-success {
  color: green;
}
.save-message-error {
  color: red;
}

.no-data-message, .loading-initial-message {
  text-align: center;
  padding: 20px;
  font-size: 1.1em;
  color: #555;
}

.error-message {
  color: #D32F2F; /* 赤色 */
  background-color: #FFCDD2; /* 薄い赤背景 */
  border: 1px solid #F44336;
  padding: 10px 15px;
  border-radius: 4px;
  margin-top: 15px;
  text-align: center;
}

/* Bulk action button styling */
.weekday-bulk-actions-container, .date-bulk-actions {
  margin-bottom: 15px;
  padding: 10px;
  background-color: #f0f4f8;
  border-radius: 6px;
}
.bulk-actions-title, .weekday-label {
  margin-right: 8px;
  font-weight: 500;
  color: black;
}
.weekday-bulk-action-group {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}
.bulk-action-button {
  margin-right: 5px;
  padding: 6px 10px;
  font-size: 0.9em;
  border: 1px solid transparent;
}
.bulk-action-button.active {
  border-width: 2px;
  box-shadow: 0 0 5px rgba(0,0,0,0.2);
}
/* .bulk-going.active, .bulk-maybe.active, .bulk-not-going.active は古いUI用なので削除またはコメントアウト */
/* .bulk-going.active { border-color: #4CAF50; background-color: #e8f5e9; color: #2e7d32;} */
/* .bulk-maybe.active { border-color: #FFC107; background-color: #fff8e1; color: #e65100;} */
/* .bulk-not-going.active { border-color: #F44336; background-color: #ffebee; color: #c62828;} */

/* New styles for detailed weekday bulk actions */
.weekday-bulk-item {
  margin-bottom: 10px;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #fff;
}

.weekday-bulk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* margin-bottom: 8px; Removed to avoid jump when details open/close */
}

.weekday-bulk-header .weekday-label {
  font-weight: bold;
}

.button.small-button { /* For "詳細設定" / "閉じる" buttons */
  padding: 4px 8px;
  font-size: 0.8em;
}

.weekday-bulk-details { /* アコーディオン用だったので、モーダル用に変更または新しいクラス作成 */
  margin-top: 10px; 
  padding-top: 10px;
  border-top: 1px solid #eee;
}
/* New class for modal context if needed, or adapt existing */
.weekday-bulk-details-modal {
  margin-top: 15px; /* Spacing from modal title */
  /* padding-bottom: 15px; */ /* Apply button is now outside the list, so this might not be needed here */
}

/* .bulk-slot-setting and .modal-bulk-slot-setting might be less relevant now or can be removed if .slot-item structure is fully adopted */
.bulk-slot-setting {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 5px 0;
}

/* .bulk-slot-time might be replaced by .slot-time if styles are compatible */
.bulk-slot-time {
  font-size: 0.9em;
  color: #333;
  margin-right: 10px;
}

.apply-bulk-weekday-button {
  margin-top: 10px;
  width: 100%; /* Make button full width of its container */
  padding: 8px 12px;
  font-size: 0.9em;
}
.modal-apply-button { /* Specific styling for apply button in modal */
  margin-top: 20px; /* Increased margin from the list */

  padding: 10px 15px; 
}

.no-representative-slots-message {
  font-size: 0.85em;
  color: #777;
  padding: 5px 0;
  text-align: center;
}


/* Visually hidden class (if needed elsewhere, though radio buttons are removed) */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

/* Calendar Styles */
.calendar-view-container {
  margin-top: 20px;
  padding: 10px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.calendar-month {
  margin-bottom: 20px;
}

.calendar-month-title {
  font-size: 1.4em;
  text-align: center;
  margin-bottom: 15px;
  color: #333;
  font-weight: 600;
}

.calendar-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.calendar-table th,
.calendar-table td {
  border: 1px solid black;
  padding: 0;
  text-align: center;
  vertical-align: top;
  height: 90px;
}

.calendar-table th {
  background-color: #f8f9fa;
  font-weight: 500;
  color: #495057;
  padding: 10px 0;
  font-size: 0.85em;
  height: auto;
}

.calendar-table th.clickable-header {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.calendar-table th.clickable-header:hover {
  background-color: #e9ecef;
}

.calendar-table th.clickable-header.active-header {
  background-color: #cfe2ff; /* Bootstrap primary-bg-subtle like color */
  color: #0a58ca; /* Darker blue for text */
  font-weight: bold;
}

.calendar-day-cell {
  cursor: default;
  padding: 5px; /* Add padding inside td */
  position: relative; /* For positioning the day number span if needed */
  /* Ensure day number is visible over the gradient */
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out; /* Added transition for hover effect */
}

.calendar-day-cell.has-slots { /* This class is already applied when day.isClickable is true */
  cursor: pointer;
}

.calendar-day-cell.not-in-event-range {
  background-color: #e0e0e0; /* より暗い灰色に変更 */
  color: #a0a0a0; /* テキスト色も調整 */
}
.calendar-day-cell.not-in-event-range .day-number {
  color: #a0a0a0; /* 日付の数字も同様に調整 */
}

.empty-cell {
  background-color: #fdfdfd;
  border: 1px solid #eee;
}

.day-number {
  position: relative; /* Ensure it stacks correctly if other elements are absolutely positioned */
  z-index: 1; /* Ensure number is above the gradient background */

  padding: 2px 4px;
  background-color: rgba(255, 255, 255, 0.75); /* Semi-transparent background for readability */
  border-radius: 3px;
  font-size: 1em; /* フォントサイズを 1em に戻す (style属性で設定したため) */
  display: inline-block; /* To allow padding and background */
  color: #000000; /* Set text color to black */
}

.today .day-number {
  font-weight: bold;
  color: #000000; /* Set text color to black for today as well */
  border:  1px solid #000000; /* Optional: make border black or a contrasting color */
  /* background-color: rgba(255, 255, 255, 0.85); */ /* Slightly more opaque for today if needed */
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 15px; /* Padding for smaller screens */
}

.modal-content {
  background-color: #fff;
  padding: 20px 25px 25px 25px; /* Adjusted padding */
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  width: 100%; /* Responsive width */
  max-width: 550px; /* Max width for the modal */
  max-height: 90vh; /* Max height */
  overflow-y: auto; 
  position: relative;
}

.modal-close-button {
  position: absolute;
  top: 12px;
  right: 15px;
  background: none;
  border: none;
  font-size: 1.8rem;
  line-height: 1;
  cursor: pointer;
  color: #888;
  padding: 5px;
}
.modal-close-button:hover {
  color: #333;
}

.modal-title {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 1.4rem; /* Adjusted size */
  color: #333;
  text-align: center;
  font-weight: 600;
}

.modal-bulk-actions {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: center;
  gap: 10px; /* Space between buttons */
}

.modal-slot-list {
  padding-left: 0; 
  list-style: none;
}

.modal-content .slot-item {
  margin-bottom: 12px; /* Increased margin for better separation */
  padding: 12px 15px; /* Slightly more padding */
}

.modal-no-events {
  text-align: center;
  color: #555;
  padding: 15px 0;
}

/* Ensure save button container is not affected by modal overlay */
.save-button-container {
  position: relative; /* Or z-index if needed, but should be fine if modal is fixed */
  z-index: 1; /* Lower than modal overlay */
}

.calendar-day-cell.no-slots-in-range-diagonal {
  background-image: linear-gradient(to right bottom, transparent 49.5%, rgb(219, 219, 219) 49.5%, rgb(219, 219, 219) 50.5%, transparent 50.5%);
}
</style>
