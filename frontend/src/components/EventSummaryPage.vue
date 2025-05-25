<template>
  <div class="container p-4">
    <header class="mb-6">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold text-indigo-700">{{ eventName }} - 出欠状況</h1>
        <button @click="goBack" class="button-secondary">一覧に戻る</button>
      </div>
      <p v-if="eventStartDate && eventEndDate" class="text-gray-600 text-sm mt-1">
        対象期間: {{ formatDateForDisplay(eventStartDate) }} 〜 {{ formatDateForDisplay(eventEndDate) }}
      </p>
    </header>

    <div v-if="loading" class="loading-message">
      <svg class="loading-spinner-large" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-lg text-gray-600 mt-4">集計情報を読み込み中...</p>
    </div>

    <div v-if="errorMessage" class="error-container">
      <p>{{ errorMessage }}</p>
    </div>

    <div v-if="!loading && !errorMessage && groupedTimeSlotsForTable.length > 0" class="summary-table-container">
      <table class="summary-table">
        <thead>
          <tr>
            <th class="sticky-col header-dategroup">日付/時間</th>
            <th v-for="user in allUsers" :key="user" class="header-username">{{ user }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groupedTimeSlotsForTable" :key="group.dateKey">
            <tr v-for="(slot, slotIdx) in group.slots" :key="group.dateKey + '-' + slot.fullUtc">
              <td class="sticky-col cell-dategroup">
                <div>
                  <span class="date-label">{{ group.dateLabel }}</span>
                  <span class="slot-time">{{ slot.timeLabel }}</span>
                </div>
              </td>
              <td v-for="user in allUsers" :key="user + '-' + slot.fullUtc"
                  :class="['cell-status', getStatusClass(userSelectionsMap[user]?.[slot.fullUtc])]"
                  :title="getStatusTitle(userSelectionsMap[user]?.[slot.fullUtc], user, slot.fullUtc)">
                {{ getStatusDisplay(userSelectionsMap[user]?.[slot.fullUtc]) }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div v-if="!loading && !errorMessage && groupedTimeSlotsForTable.length === 0 && allEventTimeSlotsUTC.length > 0" class="no-data-message">
       <p class="text-gray-600">集計可能な日時スロットがありませんでした。イベント期間を確認してください。</p>
    </div>
    <div v-if="!loading && !errorMessage && allEventTimeSlotsUTC.length === 0" class="no-data-message">
      <p class="text-gray-600">このイベントには利用可能な日時スロットが見つかりませんでした。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const errorMessage = ref('');
const eventName = ref('');
const eventStartDate = ref('');
const eventEndDate = ref('');
const allEventTimeSlotsUTC = ref([]);
const allUsers = ref([]);
const userSelectionsMap = ref({}); // { username: { utcDateTime: status } }

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const eventUrl = computed(() => {
  if (route.params.eventUrlProp) {
    return decodeURIComponent(route.params.eventUrlProp);
  }
  return '';
});

const groupedTimeSlotsForTable = computed(() => {
  if (!allEventTimeSlotsUTC.value || allEventTimeSlotsUTC.value.length === 0) {
    return [];
  }

  const groups = new Map(); // Key: 'YYYY-MM-DD' (JST), Value: { dateLabel: 'M月D日 (曜)', slots: [] }

  // JSTに変換して日付ごとにグループ化
  allEventTimeSlotsUTC.value.forEach(utcSlot => {
    const dateObj = new Date(utcSlot);
    
    // JSTでの日付文字列をキーとする (例: 2025-07-15)
    const jstDateKey = dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo' }).replace(/\//g, '-');
    // 表示用の日付ラベル (例: 7月15日 (火))
    const dateLabel = dateObj.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' });
    // 表示用の時間ラベル (例: 09:00)
    const timeLabel = dateObj.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });

    if (!groups.has(jstDateKey)) {
      groups.set(jstDateKey, { dateLabel: dateLabel, slots: [] });
    }
    groups.get(jstDateKey).slots.push({
      timeLabel: timeLabel,
      fullUtc: utcSlot
    });
  });

  // Mapを日付順にソートして配列に変換
  return Array.from(groups.entries())
    .sort(([dateKeyA], [dateKeyB]) => new Date(dateKeyA) - new Date(dateKeyB))
    .map(([dateKey, value]) => ({
      dateKey: dateKey,
      dateLabel: value.dateLabel,
      slots: value.slots.sort((s1, s2) => s1.timeLabel.localeCompare(s2.timeLabel)) // 各日付内のスロットも時間でソート
    }));
});

async function fetchSummary() {
  if (!eventUrl.value) {
    errorMessage.value = 'イベントURLが指定されていません。';
    loading.value = false;
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  try {
    const response = await fetch(`${API_BASE_URL}/events/${encodeURIComponent(eventUrl.value)}/summary`);
    console.log('Fetching event summary from:', `${API_BASE_URL}/events/${encodeURIComponent(eventUrl.value)}/summary`);
    console.log('Response status:', response.status);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: '集計データの取得に失敗しました。' }));
      throw new Error(errorData.error || errorData.message || `サーバーエラー (${response.status})`);
    }
    const data = await response.json();
    eventName.value = data.eventName;
    eventStartDate.value = data.eventStartDate;
    eventEndDate.value = data.eventEndDate;
    allEventTimeSlotsUTC.value = (data.allEventTimeSlotsUTC || []).sort(); // Sort UTC slots
    allUsers.value = data.allUsers || [];
    userSelectionsMap.value = data.userSelectionsMap || {};

  } catch (err) {
    console.error('Failed to fetch event summary:', err);
    errorMessage.value = `集計データの読み込みに失敗しました: ${err.message}`;
  } finally {
    loading.value = false;
  }
}

function formatDateForDisplay(dateString) { // Renamed from formatDate
  if (!dateString) return '';
  // JSTで表示 (YYYY年M月D日)
  const date = new Date(dateString + 'T00:00:00Z'); // UTCとして解釈
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' });
}

function formatDateTimeForHeader(utcDateTimeString) { // This is used in getStatusTitle, keep as is or make specific if needed
  if (!utcDateTimeString) return '';
  const date = new Date(utcDateTimeString);
  // JSTで表示 (M月D日 HH:mm)
  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
}

function getStatusDisplay(status) {
  switch (status) {
    case 'available':
    case 'going':
      return '〇';
    case 'maybe':
      return '△';
    case 'unavailable':
    case 'not_going':
      return '×';
    default:
      return '-';
  }
}

function getStatusClass(status) {
  switch (status) {
    case 'available':
    case 'going':
      return 'status-available';
    case 'maybe':
      return 'status-maybe';
    case 'unavailable':
    case 'not_going':
      return 'status-unavailable';
    default:
      return 'status-unknown';
  }
}

function getStatusTitle(status, username, slotUtc) {
    const userDisplay = username || '不明なユーザー';
    const timeDisplay = formatDateTimeForHeader(slotUtc); // Uses the original full UTC string for detailed title
    const statusText = getStatusDisplay(status);
    return `${userDisplay} - ${timeDisplay}: ${statusText}`;
}

function goBack() {
  router.push({ name: 'EventList' });
}

onMounted(() => {
  fetchSummary();
});
</script>

<style scoped>
.container {
  max-width: 100%; /* 横幅を広げる */
  padding-left: 1rem; /* 左右に少しパディング */
  padding-right: 1rem;
  margin-left: auto;
  margin-right: auto;
  background-color: #f9fafb; /* bg-gray-50 */
  min-height: 100vh;
}

.button-secondary {
  /* Tailwind: bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg shadow-sm hover:shadow-md transition-all text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 */
  background-color: #e5e7eb; /* bg-gray-200 */
  color: #374151; /* text-gray-700 */
  font-weight: 500; /* font-medium */
  padding: 0.5rem 1rem; /* py-2 px-4 */
  border-radius: 0.5rem; /* rounded-lg */
  box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); /* shadow-sm */
  transition: all 0.15s ease-in-out;
  font-size: 0.875rem; /* text-sm */
}
.button-secondary:hover {
  background-color: #d1d5db; /* hover:bg-gray-300 */
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); /* hover:shadow-md */
}
.button-secondary:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px #9ca3af; /* focus:ring-2 focus:ring-gray-400 */
}

.loading-message, .no-data-message {
  text-align: center;
  padding-top: 2.5rem;
  padding-bottom: 2.5rem;
}
.loading-spinner-large {
  animation: spin 1s linear infinite;
  margin-left: auto;
  margin-right: auto;
  height: 2.5rem;
  width: 2.5rem;
  color: #4f46e5;
}
.error-container {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #fee2e2;
  border: 1px solid #f87171;
  color: #b91c1c;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06);
}

.summary-table-container {
  overflow-x: auto; /* 横スクロールを可能に */
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
}

.summary-table {
  width: 100%;
  min-width: 600px; /* 最小幅を調整 */
  border-collapse: collapse;
  table-layout: fixed; /* 列幅の制御のため */
}

.summary-table th, .summary-table td {
  border: 1px solid #e5e7eb;
  padding: 0.5rem;
  text-align: center;
  font-size: 0.875rem;
}
.header-dategroup, .header-username {
  min-width: 120px;
  max-width: 180px;
  white-space: normal;
  vertical-align: middle;
  color: #1f2937; /* text-gray-800 */
  background: #f3f4f6; /* bg-gray-100 */
}
.cell-dategroup {
  font-weight: 500;
  color: #1f2937;
  background: #f9fafb;
  text-align: left;
  min-width: 120px;
}
.date-label {
  font-size: 0.95em;
  font-weight: bold;
  margin-right: 0.5em;
}
.slot-time {
  color: #4b5563;
  font-size: 0.9em;
}
.cell-status {
  min-width: 60px;
}


.sticky-col {
  position: sticky;
  left: 0;
  background-color: #f9fafb; /* Tailwind: bg-gray-50 or white for cells */
  /* z-index: 20; */ /* z-index調整 */
  width: 100px; /* ユーザー名列の幅を調整 */
  min-width: 80px;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.summary-table thead .sticky-col { /* ヘッダー行のユーザー名セル */
  background-color: #f3f4f6; /* th と同じ背景色 */
  z-index: 30; /* 通常のヘッダーよりさらに手前 */
}
.summary-table tbody .sticky-col { /* ボディ行のユーザー名セル */
   background-color: white;
   z-index: 20;
}

/* .header-datetime は削除またはコメントアウト */
/*
.header-datetime {
  min-width: 100px; 
}
*/


.slot-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.2rem 0.3rem;
  margin-bottom: 0.1rem;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  text-align: left; /* スロットエントリー内のテキストは左寄せ */
}
.slot-entry:last-child {
  margin-bottom: 0;
}

.slot-time {
  margin-right: 0.4em;
  color: #4b5563; /* text-gray-600 */
  white-space: nowrap;
}

.slot-status {
  font-weight: bold;
  white-space: nowrap;
}


.status-available {
  background-color: #d1fae5; /* Tailwind: bg-green-100 */
  color: #065f46; /* Tailwind: text-green-800 */
}
.status-maybe {
  background-color: #fef3c7; /* Tailwind: bg-yellow-100 */
  color: #92400e; /* Tailwind: text-yellow-800 */
}
.status-unavailable {
  background-color: #fee2e2; /* Tailwind: bg-red-100 */
  color: #991b1b; /* Tailwind: text-red-800 */
}
.status-unknown {
  background-color: #f3f4f6; /* Tailwind: bg-gray-100 */
  color: #4b5563; /* Tailwind: text-gray-600 */
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
