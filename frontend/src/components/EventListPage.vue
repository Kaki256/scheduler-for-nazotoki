<template>
  <div class="container p-4">
    <header class="mb-8 text-center">
      <h1 class="text-4xl font-bold text-indigo-700">イベント一覧</h1>
      <p class="text-gray-600 mt-2">参加したいイベントを選択するか、新しいイベントを登録しましょう。</p>
    </header>

    <!-- TODO: 後で消す -->
    <div class="mb-6 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
      <label for="username-input" class="block text-sm font-medium text-yellow-800 mb-1">仮ユーザー名:</label>
      <div class="flex items-center gap-2">
        <input type="text" id="username-input" v-model="currentUsername" class="input-field flex-grow" placeholder="ユーザー名を入力 (例: user1)">
        <button @click="fetchEventsWithNewUser" class="button-secondary py-2 px-3 text-sm">ユーザー名で再取得</button>
      </div>
      <p class="text-xs text-yellow-700 mt-1">これは、イベントの参加状況表示とソートのテスト用です。</p>
    </div>

    <div class="mb-6 text-right">
      <button
        @click="navigateToCreateEvent"
        class="button-create-event"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="button-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        新しいイベントを登録
      </button>
    </div>

    <div v-if="loading && events.length === 0" class="loading-message">
      <svg class="loading-spinner-large" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-lg text-gray-600 mt-4">イベント情報を読み込み中...</p>
    </div>

    <div v-if="errorMessage" class="error-container">
      <p>{{ errorMessage }}</p>
    </div>

    <div v-if="!loading && sortedEvents.length === 0 && !errorMessage" class="no-events-container">
      <svg class="no-events-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2zm3-8V3m12 4h-3" />
      </svg>
      <h3 class="mt-2 text-lg font-medium text-gray-900">登録されているイベントがありません</h3>
      <p class="mt-1 text-sm text-gray-500">上のボタンから新しいイベントを登録できます。</p>
    </div>

    <div v-if="sortedEvents.length > 0" class="events-grid">
      <div v-for="event in sortedEvents" :key="event.eventUrl"
          class="event-card">
        <div class="event-card-content">
          <div class="flex justify-between items-start mb-2">
            <h2 class="event-card-title flex-grow" :title="event.name || extractEventName(event.eventUrl)">
              {{ event.name || extractEventName(event.eventUrl) }}
            </h2>
            <span v-if="event.hasCurrentUserSubmittedStatus === false" class="status-badge status-badge-unsubmitted ml-2 flex-shrink-0">⚠️ 未入力</span>
            <span v-else-if="event.hasCurrentUserSubmittedStatus === true" class="status-badge status-badge-submitted ml-2 flex-shrink-0">✅ 入力済み</span>
          </div>
          <p class="event-card-details"><strong>対象期間:</strong> {{ formatDate(event.startDate) }} 〜 {{ formatDate(event.endDate) }}</p>
          <p class="event-card-url">
            <strong>URL:</strong> <a :href="event.eventUrl" target="_blank" @click.stop class="event-url-link">{{ event.eventUrl }}</a>
          </p>
          <p v-if="typeof event.submittedUsersCount === 'number'" class="text-sm text-gray-600 mt-1">
            👤 {{ event.submittedUsersCount }} 人が入力済み
          </p>
        </div>
        <div class="event-card-actions">
          <button @click="navigateToSchedule(event.eventUrl, event.startDate, event.endDate, event.locationUid, event.name || extractEventName(event.eventUrl))"
                  class="button-primary">
            日程を見る
          </button>
          <button @click="navigateToSummary(event.eventUrl)" class="button-secondary">
            出欠確認
          </button>
          <div class="action-buttons-group">
            <button @click="navigateToEditEvent(event.eventUrl)"
                    class="button-edit">
              編集
            </button>
            <button @click="deleteEvent(event.eventUrl, event.name || extractEventName(event.eventUrl))"
                    :disabled="loading"
                    class="button-delete">
              削除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';

const events = ref([]);
const loading = ref(true);
const errorMessage = ref('');
const router = useRouter();
const currentUsername = ref('test-user'); // 仮のユーザー名

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// 日付フォーマット関数 (SchedulePage.vue から拝借、共通化も検討)
function formatDate(dateString) {
  if (!dateString) return '未設定';
  try {
    const date = new Date(dateString + 'T00:00:00Z'); // UTCとして解釈
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${year}年${month}月${day}日`;
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return dateString;
  }
}

// URLからイベント名を抽出する簡単なヘルパー (より堅牢な方法が必要な場合あり)
function extractEventName(url) {
  try {
    const pathSegments = new URL(url).pathname.split('/');
    // 例: /org/tumbleweed/event/yawfwel/ -> yawfwel
    const eventSegment = pathSegments.filter(Boolean).pop();
    if (eventSegment) {
      return eventSegment.replace(/-/g, ' ').replace(/_/g, ' ');
    }
    return 'イベント';
  } catch (e) {
    return 'イベント';
  }
}

async function fetchEvents() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const headers = {};
    if (currentUsername.value) {
      headers['X-Forwarded-User'] = currentUsername.value;
    }
    const response = await fetch(`${API_BASE_URL}/events`, { headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "イベントリストの取得に失敗しました。" }));
      throw new Error(errorData.message || `サーバーエラー (${response.status})`);
    }
    const data = await response.json();
    events.value = data.map(event => ({
        ...event,
        eventUrl: event.event_url,
        locationUid: event.location_uid,
        hasCurrentUserSubmittedStatus: event.hasCurrentUserSubmittedStatus,
        submittedUsersCount: event.submittedUsersCount,
    }));

    if (events.value.length === 0 && !errorMessage.value) {
      console.log("No events found from API.");
    }
  } catch (err) {
    console.error('Failed to fetch events:', err);
    errorMessage.value = `イベントの読み込みに失敗しました: ${err.message}`;
    events.value = []; // エラー時はリストを空にする
  } finally {
    loading.value = false;
  }
}

const fetchEventsWithNewUser = () => {
  if (!currentUsername.value) {
    alert("ユーザー名を入力してください。");
    return;
  }
  fetchEvents(); // 新しいユーザー名でイベントを再取得
};

const sortedEvents = computed(() => {
  return [...events.value].sort((a, b) => {
    // 1. 未入力のイベントを優先 (false が先)
    if (a.hasCurrentUserSubmittedStatus === false && b.hasCurrentUserSubmittedStatus !== false) {
      return -1;
    }
    if (a.hasCurrentUserSubmittedStatus !== false && b.hasCurrentUserSubmittedStatus === false) {
      return 1;
    }

    // 2. 開始日の降順 (新しいものが先)
    const dateA = a.startDate ? new Date(a.startDate) : null;
    const dateB = b.startDate ? new Date(b.startDate) : null;
    if (dateA && dateB) {
      if (dateA > dateB) return -1;
      if (dateA < dateB) return 1;
    } else if (dateA) { // b.startDate が null の場合、a を先に
      return -1;
    } else if (dateB) { // a.startDate が null の場合、b を先に
      return 1;
    }

    // 3. イベント名の昇順
    const nameA = (a.name || extractEventName(a.eventUrl) || '').toLowerCase();
    const nameB = (b.name || extractEventName(b.eventUrl) || '').toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;

    return 0;
  });
});

// frontend/src/components/EventListPage.vue (script setup部分)
function navigateToSchedule(eventUrl, startDate, endDate, locationUid, eventDisplayName) { // eventDisplayName を引数で受け取る
  console.log('Navigating to schedule with locationUid:', locationUid, 'and eventDisplayName:', eventDisplayName); // ★ ログで確認
  router.push({
    name: 'SchedulePage',
    params: { eventUrlProp: encodeURIComponent(eventUrl) },
    query: { 
        startDate, 
        endDate,
        locationUid: locationUid || '', // locationUid をクエリパラメータに追加
        eventDisplayName: eventDisplayName // eventDisplayName をクエリパラメータに追加
    }
  });
}

function navigateToCreateEvent() {
  router.push({ name: 'CreateEvent' });
}

function navigateToEditEvent(eventUrl) {
  router.push({ name: 'EditEvent', params: { eventUrlProp: encodeURIComponent(eventUrl) } });
}

function navigateToSummary(eventUrl) {
  router.push({ name: 'EventSummaryPage', params: { eventUrlProp: encodeURIComponent(eventUrl) } });
}

async function deleteEvent(eventUrl, eventName) {
  if (!confirm(`イベント「${eventName || eventUrl}」を削除してもよろしいですか？この操作は元に戻せません。`)) {
    return;
  }
  loading.value = true; // 全体ローディングでも良いし、対象カードのみローディングでも良い
  errorMessage.value = '';
  try {
    const response = await fetch(`${API_BASE_URL}/events/${encodeURIComponent(eventUrl)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      let errorDetail = '不明なエラー';
      if (response.status !== 204) { // 204 No Content 以外はエラー詳細があるかも
        const errorData = await response.json().catch(() => null);
        errorDetail = errorData?.error || `サーバーエラー (${response.status})`;
      }
      throw new Error(errorDetail);
    }
    // 成功したらイベントリストを再読み込み
    await fetchEvents(); 
    alert(`イベント「${eventName || eventUrl}」を削除しました。`);
  } catch (err) {
    console.error('Failed to delete event:', err);
    errorMessage.value = `イベントの削除に失敗しました: ${err.message}`;
  } finally {
    loading.value = false;
  }
}


onMounted(() => {
  fetchEvents();
});
</script>

<style scoped>
.container {
  /* Tailwind: container mx-auto p-4 font-sans antialiased bg-gray-100 min-h-screen */
  margin-left: auto;
  margin-right: auto;
  padding: 1rem; /* p-4 */
  font-family: sans-serif; /* font-sans */
  -webkit-font-smoothing: antialiased; /* antialiased */
  -moz-osx-font-smoothing: grayscale; /* antialiased */
  background-color: #f3f4f6; /* bg-gray-100 */
  min-height: 100vh;
}

.header {
  /* Tailwind: mb-8 text-center */
  margin-bottom: 2rem;
  text-align: center;
}

.title {
  /* Tailwind: text-4xl font-bold text-indigo-700 */
  font-size: 2.25rem; /* text-4xl */
  line-height: 2.5rem;
  font-weight: 700; /* font-bold */
  color: #4338ca; /* text-indigo-700 */
}

.subtitle {
  /* Tailwind: text-gray-600 mt-2 */
  color: #4b5563; /* text-gray-600 */
  margin-top: 0.5rem;
}

.create-button-container {
  /* Tailwind: mb-6 text-right */
  margin-bottom: 1.5rem;
  text-align: right;
}

.button-create-event {
  /* Tailwind: bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 */
  background-color: #10b981; /* bg-green-500 */
  color: #ffffff; /* text-white */
  font-weight: 600; /* font-semibold */
  padding: 0.5rem 1.25rem; /* py-2 px-5 */
  border-radius: 0.5rem; /* rounded-lg */
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); /* shadow-md */
  transition: background-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out, transform 0.15s ease-in-out;
  display: inline-flex; /* For icon alignment */
  align-items: center;
}
.button-create-event:hover {
  background-color: #059669; /* hover:bg-green-600 */
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); /* hover:shadow-lg */
  transform: scale(1.05);
}
.button-create-event:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px #10b98180; /* focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 */
}

.button-icon {
  /* Tailwind: h-5 w-5 inline-block mr-2 -mt-0.5 */
  height: 1.25rem; /* h-5 */
  width: 1.25rem; /* w-5 */
  display: inline-block;
  margin-right: 0.5rem; /* mr-2 */
  margin-top: -0.125rem; /* -mt-0.5 */
}

.loading-message {
  /* Tailwind: text-center py-10 */
  text-align: center;
  padding-top: 2.5rem;
  padding-bottom: 2.5rem;
}

.loading-spinner-large {
  /* Tailwind: animate-spin mx-auto h-10 w-10 text-indigo-600 */
  animation: spin 1s linear infinite;
  margin-left: auto;
  margin-right: auto;
  height: 2.5rem; /* h-10 */
  width: 2.5rem; /* w-10 */
  color: #4f46e5; /* text-indigo-600 */
}

.error-container {
  /* Tailwind: mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow */
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #fee2e2; /* bg-red-100 */
  border: 1px solid #f87171; /* border-red-400 */
  color: #b91c1c; /* text-red-700 */
  border-radius: 0.5rem; /* rounded-lg */
  box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06); /* shadow */
}

.no-events-container {
  /* Tailwind: text-center py-12 bg-white rounded-xl shadow-xl p-6 */
  text-align: center;
  padding-top: 3rem; /* py-12 */
  padding-bottom: 3rem;
  background-color: #ffffff; /* bg-white */
  border-radius: 0.75rem; /* rounded-xl */
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); /* shadow-xl */
  padding: 1.5rem; /* p-6 */
}

.no-events-icon {
  /* Tailwind: mx-auto h-12 w-12 text-gray-400 */
  margin-left: auto;
  margin-right: auto;
  height: 3rem; /* h-12 */
  width: 3rem; /* w-12 */
  color: #9ca3af; /* text-gray-400 */
}

.events-grid {
  /* Tailwind: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 */
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 1.5rem;
}

@media (min-width: 768px) { /* md */
  .events-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) { /* lg */
  .events-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.event-card {
  /* Tailwind: bg-white rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden flex flex-col */
  background-color: #ffffff; /* bg-white */
  border-radius: 0.75rem; /* rounded-xl */
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -1px rgba(0,0,0,0.05); /* shadow-lg */
  transition: box-shadow 0.3s ease-in-out;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.event-card:hover {
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); /* hover:shadow-2xl */
}

.event-card-content {
  /* Tailwind: p-6 flex-grow */
  padding: 1.5rem; /* p-6 */
  flex-grow: 1;
}

.event-card-title {
  /* Tailwind: text-2xl font-semibold text-indigo-600 mb-2 truncate */
  font-size: 1.5rem; /* text-2xl */
  line-height: 2rem;
  font-weight: 600; /* font-semibold */
  color: #4f46e5; /* text-indigo-600 */
  margin-bottom: 0.5rem; /* mb-2 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-card-details {
  /* Tailwind: text-sm text-gray-500 mb-1 */
  font-size: 0.875rem; /* text-sm */
  color: #6b7280; /* text-gray-500 */
  margin-bottom: 0.25rem; /* mb-1 */
}

.event-card-url {
  /* Tailwind: text-sm text-gray-500 mb-3 break-all */
  font-size: 0.875rem; /* text-sm */
  color: #6b7280; /* text-gray-500 */
  margin-bottom: 0.75rem; /* mb-3 */
  word-break: break-all;
}

.event-url-link {
  /* Tailwind: text-blue-500 hover:underline */
  color: #3b82f6; /* text-blue-500 */
  text-decoration: none;
}
.event-url-link:hover {
  text-decoration: underline;
}

.event-card-actions {
  /* Tailwind: p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center */
  padding: 1rem; /* p-4 */
  background-color: #f9fafb; /* bg-gray-50 */
  border-top: 1px solid #e5e7eb; /* border-t border-gray-200 */
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.button-primary {
  /* Tailwind: bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-2 px-4 rounded-lg shadow-sm hover:shadow-md transition-all transform hover:scale-105 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 */
  background-color: #6366f1; /* bg-indigo-500 */
  color: #ffffff; /* text-white */
  font-weight: 500; /* font-medium */
  padding: 0.5rem 1rem; /* py-2 px-4 */
  border-radius: 0.5rem; /* rounded-lg */
  box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); /* shadow-sm */
  transition: all 0.15s ease-in-out;
  font-size: 0.875rem; /* text-sm */
  margin-right: 0.5rem; /* 他のボタンとの間隔 */
}
.button-primary:hover {
  background-color: #4f46e5; /* hover:bg-indigo-600 */
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); /* hover:shadow-md */
  transform: scale(1.05);
}
.button-primary:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px #818cf8; /* focus:ring-2 focus:ring-indigo-400 */
}

.action-buttons-group {
  /* Tailwind: space-x-2 */
  display: flex;
  /* margin-left: auto; */ /* 右寄せにする場合 */
}
.action-buttons-group > button:not(:last-child) {
    margin-right: 0.5rem; /* space-x-2 */
}

.button-edit {
  /* Tailwind: text-sm bg-yellow-400 hover:bg-yellow-500 text-yellow-800 font-medium py-2 px-3 rounded-lg shadow-sm hover:shadow-md transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-300 */
  font-size: 0.875rem; /* text-sm */
  background-color: #facc15; /* bg-yellow-400 */
  color: #854d0e; /* text-yellow-800 */
  font-weight: 500; /* font-medium */
  padding: 0.5rem 0.75rem; /* py-2 px-3 */
  border-radius: 0.5rem; /* rounded-lg */
  box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); /* shadow-sm */
  transition: all 0.15s ease-in-out;
}
.button-edit:hover {
  background-color: #eab308; /* hover:bg-yellow-500 */
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); /* hover:shadow-md */
  transform: scale(1.05);
}
.button-edit:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px #fde047; /* focus:ring-2 focus:ring-yellow-300 */
}

.button-secondary {
 /* Tailwind: bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-3 rounded-lg shadow-sm hover:shadow-md transition-all text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 */
  background-color: #e5e7eb; /* bg-gray-200 */
  color: #374151; /* text-gray-700 */
  font-weight: 500; /* font-medium */
  padding: 0.5rem 0.75rem; /* py-2 px-3 */
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

.button-delete {
  /* Tailwind: text-sm bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-3 rounded-lg shadow-sm hover:shadow-md transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-60 */
  font-size: 0.875rem; /* text-sm */
  background-color: #ef4444; /* bg-red-500 */
  color: #ffffff; /* text-white */
  font-weight: 500; /* font-medium */
  padding: 0.5rem 0.75rem; /* py-2 px-3 */
  border-radius: 0.5rem; /* rounded-lg */
  box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); /* shadow-sm */
  transition: all 0.15s ease-in-out;
}
.button-delete:hover {
  background-color: #dc2626; /* hover:bg-red-600 */
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); /* hover:shadow-md */
  transform: scale(1.05);
}
.button-delete:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px #f87171; /* focus:ring-2 focus:ring-red-400 */
}
.button-delete:disabled {
  opacity: 0.6; /* disabled:opacity-60 */
  cursor: not-allowed;
}

.event-card {
  background-color: #ffffff;
  border-radius: 12px; /* 少し丸みを強く */
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1); /* 影を少し強調 */
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  overflow: hidden; /* Ensure content respects border radius */
}
.event-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

.event-card-content {
  padding: 20px; /* パディングを少し増やす */
}

.event-card-title {
  font-size: 1.35em; /* 少し大きく */
  font-weight: 700; /* 太く */
  color: #334155; /* Tailwind slate-700 */
  margin-bottom: 10px; /* 少しマージン調整 */
  line-height: 1.3;
  /* 長いタイトルがカード幅を超えるのを防ぐ */
  word-break: break-word;
  overflow-wrap: break-word;
}


.event-card-details,
.event-card-url {
  font-size: 0.9em;
  color: #475569; /* Tailwind slate-600 */
  margin-bottom: 8px;
  line-height: 1.5;
}

.event-card-url strong,
.event-card-details strong {
  color: #334155; /* Tailwind slate-700 */
}

.event-url-link {
  color: #4f46e5; /* Tailwind indigo-600 */
  text-decoration: none;
  word-break: break-all; /* URLが長い場合に改行 */
}

.event-url-link:hover {
  text-decoration: underline;
  color: #3730a3; /* Tailwind indigo-800 */
}

.event-card-actions {
  background-color: #f8fafc; /* Tailwind slate-50 */
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0; /* Tailwind slate-200 */
  display: flex;
  flex-wrap: wrap; /* ボタンが多い場合に折り返す */
  gap: 10px; /* ボタン間のスペース */
  justify-content: flex-start; /* ボタンを左寄せに */
}

.button-primary,
.button-secondary,
.button-edit,
.button-delete,
.button-create-event {
  padding: 10px 18px; /* パディング調整 */
  border-radius: 8px;
  font-weight: 500;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
  border: none;
  cursor: pointer;
  font-size: 0.9em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.button-icon {
  width: 1.2em;
  height: 1.2em;
  margin-right: 0.5em;
}


.button-primary {
  background-color: #4f46e5; /* Tailwind indigo-600 */
  color: white;
}
.button-primary:hover {
  background-color: #3730a3; /* Tailwind indigo-800 */
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
}

.button-secondary {
  background-color: #64748b; /* Tailwind slate-500 */
  color: white;
}
.button-secondary:hover {
  background-color: #475569; /* Tailwind slate-600 */
  box-shadow: 0 2px 8px rgba(100, 116, 139, 0.3);
}

.button-edit {
  background-color: #f59e0b; /* Tailwind amber-500 */
  color: white;
}
.button-edit:hover {
  background-color: #d97706; /* Tailwind amber-600 */
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.button-delete {
  background-color: #ef4444; /* Tailwind red-500 */
  color: white;
}
.button-delete:hover {
  background-color: #dc2626; /* Tailwind red-600 */
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}
.button-delete:disabled {
  background-color: #9ca3af; /* Tailwind gray-400 */
  cursor: not-allowed;
}

.status-badge {
  padding: 1.2em 0.8em;
  border-radius: 0.375rem; /* rounded-md */
  font-size: 0.8em;
  font-weight: 600;
  white-space: nowrap; /* Ensure badge text stays on one line */
}

.status-badge-unsubmitted {
  background-color: #fffbeb; /* Tailwind yellow-50 */
  color: #b45309; /* Tailwind yellow-700 */
  border: 1px solid #fef3c7; /* Tailwind yellow-200 */
}

.status-badge-submitted {
  background-color: #ecfdf5; /* Tailwind green-50 */
  color: #065f46; /* Tailwind green-700 */
  border: 1px solid #d1fae5; /* Tailwind green-200 */
}

.input-field {
  /* Tailwind: shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md */
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid #d1d5db; /* border-gray-300 */
  border-radius: 0.375rem; /* rounded-md */
  padding: 0.5rem 0.75rem; /* py-2 px-3 */
  font-size: 0.875rem; /* sm:text-sm */
  line-height: 1.25rem;
  width: 100%; /* block w-full */
}
.input-field:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  border-color: #6366f1; /* focus:border-indigo-500 */
  box-shadow: 0 0 0 2px #6366f180; /* focus:ring-indigo-500 (with opacity) */
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .events-grid {
    grid-template-columns: 1fr; /* 1列表示 */
  }
  .event-card-actions {
    flex-direction: column; /* ボタンを縦積みに */
    align-items: stretch; /* ボタン幅をカードに合わせる */
  }
  .action-buttons-group {
    margin-left: 0;
    width: 100%;
    display: flex;
    justify-content: space-between; /* 編集と削除を両端に */
  }
  .action-buttons-group > .button-edit,
  .action-buttons-group > .button-delete {
    flex-grow: 1; /* ボタンがスペースを分け合う */
  }
}
</style>
