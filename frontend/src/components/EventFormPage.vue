<template>
  <div class="container p-4">
    <header class="mb-8 text-center">
      <h1 class="text-4xl font-bold text-indigo-700">{{ pageTitle }}</h1>
      <p class="text-gray-600 mt-2">{{ pageSubtitle }}</p>
    </header>

    <div class="form-container">
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="eventUrl" class="form-label">イベントURL:</label>
          <div class="flex items-center">
            <input
              type="url"
              id="eventUrl"
              v-model="event.eventUrl"
              placeholder="例: https://escape.id/org/tumbleweed/event/yawfwel/"
              class="form-input flex-grow"
              :disabled="mode === 'edit'"
              required
            />
            <button
              type="button"
              @click="fetchEventDataFromUrl"
              v-if="event.eventUrl && effectiveMode === 'create'"
              class="button-fetch-data ml-2"
              :disabled="loading"
            >
              <svg v-if="loading && fetchOperationLoading" class="loading-spinner-button" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span v-if="loading && fetchOperationLoading">取得中...</span>
              <span v-if="!(loading && fetchOperationLoading)">情報を取得</span>
            </button>
          </div>
          <p v-if="mode === 'edit'" class="form-help-text">イベントURLは編集できません。</p>
        </div>

        <div class="form-group">
          <label for="eventName" class="form-label">イベント名 (任意):</label>
          <input
            type="text"
            id="eventName"
            v-model="event.name"
            placeholder="例: 初めての謎解き"
            class="form-input"
          />
        </div>

        <div class="form-grid">
          <div>
            <label for="startDate" class="form-label">開始日:</label>
            <input
              type="date"
              id="startDate"
              v-model="event.startDate"
              class="form-input"
              required
            />
          </div>
          <div>
            <label for="endDate" class="form-label">終了日:</label>
            <input
              type="date"
              id="endDate"
              v-model="event.endDate"
              class="form-input"
              required
            />
          </div>
        </div>
        
        <div v-if="errorMessage" class="error-message-container">
          {{ errorMessage }}
        </div>

        <div class="form-actions">
          <button
            type="button"
            @click="cancel"
            class="button-cancel"
          >
            キャンセル
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="button-submit"
          >
            <svg v-if="loading" class="loading-spinner-button" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ submitButtonText }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
  mode: {
    type: String,
    default: '', 
  },
  orgSlugProp: { // For edit mode, to construct the event URL
    type: String,
    default: null,
  },
  eventSlugProp: { // For edit mode, to construct the event URL
    type: String,
    default: null,
  },
});

const router = useRouter();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const event = reactive({
  eventUrl: '',
  name: '',
  startDate: '',
  endDate: '',
  locationUid: '',
  maxParticipants: null, // maxParticipants を追加
});

const loading = ref(false);
const errorMessage = ref('');
const fetchOperationLoading = ref(false); // ローディング状態を分ける

const effectiveMode = computed(() => {
  if (props.mode) {
    return props.mode;
  }
  // If orgSlugProp and eventSlugProp are provided, assume edit mode
  return props.orgSlugProp && props.eventSlugProp ? 'edit' : 'create';
});

const pageTitle = computed(() => effectiveMode.value === 'create' ? '新しいイベントを登録' : 'イベント情報を編集');
const pageSubtitle = computed(() => effectiveMode.value === 'create' ? 'イベントの情報を入力してください。' : 'イベントの情報を更新してください。');
const submitButtonText = computed(() => {
  if (loading.value && !fetchOperationLoading.value) { // fetchOperationLoadingでない場合のみ
    return effectiveMode.value === 'create' ? '登録中...' : '更新中...';
  }
  return effectiveMode.value === 'create' ? '登録する' : '更新する';
});

// 日付を YYYY-MM-DD 形式にフォーマットするヘルパー
const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch (e) {
    return ''; // 不正な日付の場合は空文字
  }
};

async function fetchEventDataFromUrl() { // Renamed from fetchLocationUid and extended
  if (!event.eventUrl || effectiveMode.value === 'edit') {
    return;
  }
  loading.value = true;
  fetchOperationLoading.value = true;
  errorMessage.value = '';
  // Initialize fields that will be fetched from URL
  event.name = '';
  event.startDate = '';
  event.endDate = '';
  event.locationUid = '';
  event.maxParticipants = null;

  try {
    const backendResponse = await fetch(`${API_BASE_URL}/fetch-html`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: event.eventUrl }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => null);
      throw new Error(errorData?.error || `HTMLの取得に失敗しました: ${backendResponse.status}`);
    }

    const { html: htmlText } = await backendResponse.json();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    
    const astroIslandElement = doc.querySelector('astro-island[component-export="EventInitializer"]');
    if (!astroIslandElement) {
      throw new Error('EventInitializerコンポーネントが見つかりませんでした。');
    }

    const propsString = astroIslandElement.getAttribute('props');
    if (!propsString) {
      throw new Error('props属性が見つかりませんでした。');
    }

    const propsData = JSON.parse(propsString);
    const infoDetails = propsData?.info?.[1];

    if (!infoDetails) {
      throw new Error('イベント情報の主要な構造(info[1])が見つかりませんでした。');
    }

    // Event Name
    if (infoDetails.eventName?.[1]) {
      event.name = infoDetails.eventName[1];
      console.log('取得したイベント名:', event.name);
    } else {
      console.warn('イベント名は取得できませんでした。');
    }

    // Start Date and End Date
    let earliestFirstStartTime = null;
    let latestLastEndTime = null;

    const processDateValue = (dateValue, isStartTime) => {
      if (!dateValue || typeof dateValue !== 'string') return;
      try {
        const currentDate = new Date(dateValue);
        if (isNaN(currentDate.getTime())) return; // Invalid date

        if (isStartTime) {
          if (!earliestFirstStartTime || currentDate < earliestFirstStartTime) {
            earliestFirstStartTime = currentDate;
          }
        } else { // isEndTime
          if (!latestLastEndTime || currentDate > latestLastEndTime) {
            latestLastEndTime = currentDate;
          }
        }
      } catch (e) {
        console.warn('日付文字列の処理中にエラー:', dateValue, e);
      }
    };

    const scheduleDataSources = [];
    // activeSlotGroups からスケジュール情報を収集
    if (infoDetails.activeSlotGroups && Array.isArray(infoDetails.activeSlotGroups[1])) {
      infoDetails.activeSlotGroups[1].forEach(groupEntry => {
        if (groupEntry && Array.isArray(groupEntry) && groupEntry.length > 1 && groupEntry[1]) {
          scheduleDataSources.push(groupEntry[1]);
        }
      });
    }
    // visibleLocations からスケジュール情報を収集
    if (infoDetails.visibleLocations && Array.isArray(infoDetails.visibleLocations[1])) {
      infoDetails.visibleLocations[1].forEach(locationEntry => {
        if (locationEntry && Array.isArray(locationEntry) && locationEntry.length > 1 && locationEntry[1]) {
          // activeSlotGroupsで既に同じ場所の情報が処理されている可能性を考慮
          // ここでは単純に追加し、min/maxロジックで重複を処理する
          scheduleDataSources.push(locationEntry[1]);
        }
      });
    }

    scheduleDataSources.forEach(source => {
      if (source.firstStartTime && Array.isArray(source.firstStartTime) && source.firstStartTime.length > 1) {
        processDateValue(source.firstStartTime[1], true);
      }
      if (source.lastEndTime && Array.isArray(source.lastEndTime) && source.lastEndTime.length > 1) {
        processDateValue(source.lastEndTime[1], false);
      }
    });

    if (earliestFirstStartTime) {
      event.startDate = formatDateForInput(earliestFirstStartTime.toISOString());
      console.log('設定された最も早い開始日:', event.startDate, earliestFirstStartTime);
    } else {
      console.warn('有効な開始日は見つかりませんでした。');
    }

    if (latestLastEndTime) {
      event.endDate = formatDateForInput(latestLastEndTime.toISOString());
      console.log('設定された最も遅い終了日:', event.endDate, latestLastEndTime);
    } else {
      console.warn('有効な終了日は見つかりませんでした。');
    }
    
    // Location UID
    let extractedLocationUid = null;
    // Attempt to get UID from activeSlotGroups first
    if (infoDetails.activeSlotGroups?.[1]?.[0]?.[1]?.location?.[1]?.uid?.[1]) {
        extractedLocationUid = infoDetails.activeSlotGroups[1][0][1].location[1].uid[1];
    } 
    // If not found in activeSlotGroups, try visibleLocations second
    else if (infoDetails.visibleLocations?.[1]?.[0]?.[1]?.uid?.[1]) {
        // The structure for visibleLocations seems to be infoDetails.visibleLocations[1][0][1] as the location object itself
        extractedLocationUid = infoDetails.visibleLocations[1][0][1].uid[1];
    }
    
    if (extractedLocationUid) {
        event.locationUid = extractedLocationUid;
        console.log('取得したLocation UID:', event.locationUid);
    } else {
        console.warn('Location UIDの抽出に失敗しました。');
    }

    // Max Participants
    if (infoDetails.maxParticipants?.[1] !== undefined) {
      event.maxParticipants = infoDetails.maxParticipants[1];
      console.log('取得したMax Participants:', event.maxParticipants);
    } else {
      console.warn('Max Participants は取得できませんでした。');
    }

    if (!event.name && !event.startDate && !event.endDate && !event.locationUid) {
        errorMessage.value = '主要なイベント情報（名前、開始/終了日、場所ID）の取得に失敗しました。URLを確認するか、手動で入力してください。';
    } else if (!event.locationUid) {
        // locationUid は登録に必須の可能性があるので、取得できなかった場合は警告を出す
        errorMessage.value = 'Location UIDが取得できませんでした。イベントURLが正しいか、またはページの構造を確認してください。手動での入力が必要な場合があります。';
    }


  } catch (err) {
    console.error('イベントデータの取得に失敗しました:', err);
    errorMessage.value = `情報取得エラー: ${err.message}`;
  } finally {
    loading.value = false;
    fetchOperationLoading.value = false;
  }
}


async function fetchEventDetails() {
  if (effectiveMode.value === 'edit' && props.orgSlugProp && props.eventSlugProp) {
    loading.value = true;
    errorMessage.value = '';
    try {
      // Reconstruct the event URL from slugs, ensuring it ends with a slash
      const reconstructedEventUrl = `https://escape.id/org/${props.orgSlugProp}/event/${props.eventSlugProp}/`;
      console.log('[EventFormPage] Reconstructed event URL for fetching details:', reconstructedEventUrl);
      
      const response = await fetch(`${API_BASE_URL}/events/${encodeURIComponent(reconstructedEventUrl)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'イベント情報の取得に失敗しました。' }));
        throw new Error(errorData.error || `サーバーエラー (${response.status})`);
      }
      const foundEvent = await response.json();
      
      if (foundEvent) {
        event.eventUrl = foundEvent.event_url; // Store the normalized URL from backend
        event.name = foundEvent.name || '';
        event.startDate = formatDateForInput(foundEvent.startDate);
        event.endDate = formatDateForInput(foundEvent.endDate);
        event.locationUid = foundEvent.locationUid || '';
        event.maxParticipants = foundEvent.maxParticipants !== undefined ? foundEvent.maxParticipants : null; // 編集時にもmaxParticipantsをセット
      } else {
        errorMessage.value = '編集対象のイベントが見つかりませんでした。';
      }
    } catch (err) {
      console.error('Failed to fetch event details:', err);
      errorMessage.value = err.message || 'イベント詳細の読み込み中にエラーが発生しました。';
    } finally {
      loading.value = false;
    }
  }
}

async function handleSubmit() {
  loading.value = true;
  fetchOperationLoading.value = false; // submit時は fetchOperationLoading は false
  errorMessage.value = '';

  if (new Date(event.startDate) > new Date(event.endDate)) {
    errorMessage.value = '終了日は開始日以降に設定してください。';
    loading.value = false;
    return;
  }

  const payload = {
    eventUrl: event.eventUrl, // This should be the full, normalized URL
    name: event.name || null,
    startDate: event.startDate,
    endDate: event.endDate,
    locationUid: event.locationUid || null,
    maxParticipants: event.maxParticipants,
  };

  try {
    let response;
    if (effectiveMode.value === 'create') { 
      response = await fetch(`${API_BASE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else { // edit mode
      // For PUT requests, the event URL in the path should be the one originally used to fetch the event.
      // The payload.eventUrl might be different if normalization changed it, but the path param must match the existing record.
      // However, our current setup normalizes on creation and expects normalized URLs for lookup.
      // So, we use the (potentially already normalized) event.eventUrl from the form, which was set during fetchEventDetails.
      const eventUrlForPath = encodeURIComponent(event.eventUrl); 
      response = await fetch(`${API_BASE_URL}/events/${eventUrlForPath}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), // payload contains all fields, including eventUrl which is not typically updated but good to be consistent.
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '不明なエラーが発生しました。' }));
      throw new Error(errorData.error || `サーバーエラー (${response.status})`);
    }
    
    // 成功したらイベント一覧ページに遷移
    router.push('/events');
  } catch (err) {
    console.error('Submit failed:', err);
    errorMessage.value = err.message || (effectiveMode.value === 'create' ? '登録に失敗しました。' : '更新に失敗しました。');
  } finally {
    loading.value = false;
  }
}

function cancel() {
  router.push('/events');
}

// Load event details if in edit mode
onMounted(() => {
  if (effectiveMode.value === 'edit') {
    fetchEventDetails();
  } else {
    // Create mode: initialize with defaults or leave blank
    event.eventUrl = '';
    event.name = '';
    event.startDate = '';
    event.endDate = '';
    event.locationUid = '';
    event.maxParticipants = null;
  }
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
  -moz-osx-font-smoothing: grayscale;
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

.form-container {
  /* Tailwind: max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-xl */
  max-width: 42rem; /* max-w-2xl */
  margin-left: auto;
  margin-right: auto;
  background-color: #ffffff; /* bg-white */
  padding: 2rem; /* p-8 */
  border-radius: 0.75rem; /* rounded-xl */
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); /* shadow-xl */
}

.form-group {
  /* Tailwind: mb-6 */
  margin-bottom: 1.5rem;
}

.form-label {
  /* Tailwind: block text-lg font-semibold text-gray-800 mb-2 */
  display: block;
  font-size: 1.125rem; /* text-lg */
  line-height: 1.75rem;
  font-weight: 600; /* font-semibold */
  color: #1f2937; /* text-gray-800 */
  margin-bottom: 0.5rem; /* mb-2 */
}

.form-input {
  /* Tailwind: w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 text-gray-700 */
  width: 100%;
  padding: 0.75rem 1rem; /* px-4 py-3 */
  border: 1px solid #d1d5db; /* border-gray-300 */
  border-radius: 0.5rem; /* rounded-lg */
  box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); /* shadow-sm */
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  color: #374151; /* text-gray-700 */
  font-size: 1rem;
  background-color: #ffffff; /* 明示的に背景を白に設定 */
  box-sizing: border-box; /* paddingとborderを幅に含める */
}
.form-input::placeholder {
  color: #6b7280; /* text-gray-500 プレースホルダーの文字色を設定 */
}
.form-input:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  border-color: #6366f1; /* focus:border-indigo-500 */
  box-shadow: 0 0 0 2px #6366f1; /* focus:ring-2 focus:ring-indigo-500 */
}
.form-input:disabled {
  background-color: #e5e7eb; /* Tailwind like bg-gray-200 for disabled */
  cursor: not-allowed;
}

.form-help-text {
  /* Tailwind: text-sm text-gray-500 mt-1 */
  font-size: 0.875rem; /* text-sm */
  color: #6b7280; /* text-gray-500 */
  margin-top: 0.25rem; /* mt-1 */
}

.form-grid {
  /* Tailwind: grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 */
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 1.5rem; /* gap-6 */
  margin-bottom: 2rem; /* mb-8 */
}

@media (min-width: 640px) { /* sm */
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.error-message-container {
  /* Tailwind: mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg */
  margin-bottom: 1rem; /* mb-4 */
  padding: 0.75rem; /* p-3 */
  background-color: #fee2e2; /* bg-red-100 */
  border: 1px solid #f87171; /* border-red-400 */
  color: #b91c1c; /* text-red-700 */
  border-radius: 0.5rem; /* rounded-lg */
}

.form-actions {
  /* Tailwind: flex justify-end space-x-4 */
  display: flex;
  justify-content: flex-end;
}
.form-actions > button:not(:last-child) {
    margin-right: 1rem; /* space-x-4 */
}

.button-cancel {
  /* Tailwind: bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition duration-150 ease-in-out */
  background-color: #d1d5db; /* bg-gray-300 */
  color: #1f2937; /* text-gray-800 */
  font-weight: 600; /* font-semibold */
  padding: 0.75rem 1.5rem; /* py-3 px-6 */
  border-radius: 0.5rem; /* rounded-lg */
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); /* shadow-md */
  transition: background-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}
.button-cancel:hover {
  background-color: #9ca3af; /* hover:bg-gray-400 */
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); /* hover:shadow-lg */
}
.button-cancel:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px #6b728080; /* focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 */
}

.button-submit {
  /* Tailwind: bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center */
  background-color: #4f46e5; /* bg-indigo-600 */
  color: #ffffff; /* text-white */
  font-weight: 600; /* font-semibold */
  padding: 0.75rem 1.5rem; /* py-3 px-6 */
  border-radius: 0.5rem; /* rounded-lg */
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); /* shadow-md */
  transition: background-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out, opacity 0.15s ease-in-out;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.button-submit:hover {
  background-color: #4338ca; /* hover:bg-indigo-700 */
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -1px rgba(0,0,0,0.05); /* hover:shadow-lg */
}
.button-submit:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px #6366f180; /* focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 */
}
.button-submit:disabled {
  opacity: 0.5; /* disabled:opacity-50 */
  cursor: not-allowed; /* disabled:cursor-not-allowed */
}

.loading-spinner-button {
  /* Tailwind: animate-spin -ml-1 mr-3 h-5 w-5 text-white */
  animation: spin 1s linear infinite;
  margin-left: -0.25rem; /* -ml-1 */
  margin-right: 0.75rem; /* mr-3 */
  height: 1.25rem; /* h-5 */
  width: 1.25rem; /* w-5 */
  color: #ffffff; /* text-white */
}

/* 既存の scoped style */
/* 必要に応じてスタイルを追加 */

/* Add styles for the fetch button */
.button-fetch-data {
  /* Tailwind: px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 flex items-center justify-center text-sm */
  padding-left: 0.75rem; /* px-3 */
  padding-right: 0.75rem; /* px-3 */
  padding-top: 0.5rem; /* py-2 */
  padding-bottom: 0.5rem; /* py-2 */
  background-color: #3b82f6; /* bg-blue-500 */
  color: white;
  border-radius: 0.375rem; /* rounded */
  font-size: 0.875rem; /* text-sm */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap; /* prevent text wrapping */
}
.button-fetch-data:hover {
  background-color: #2563eb; /* bg-blue-600 */
}
.button-fetch-data:disabled {
  opacity: 0.5;
}
.button-fetch-data .loading-spinner-button {
  width: 1em; /* Adjust spinner size to be relative to button font size */
  height: 1em;
  margin-right: 0.5em; /* Space between spinner and text */
}

.form-input.flex-grow {
  min-width: 0; /* Allows input to shrink properly in flex container */
}
</style>
