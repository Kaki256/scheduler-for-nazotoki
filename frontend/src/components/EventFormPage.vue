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
          <input
            type="url"
            id="eventUrl"
            v-model="event.eventUrl"
            placeholder="例: https://escape.id/org/tumbleweed/event/yawfwel/"
            class="form-input"
            :disabled="mode === 'edit'"
            required
            @blur="fetchLocationUid"
          />
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
    // required: true, // 'create' or 'edit' // requiredを削除
    default: '', // デフォルト値を設定して、未定義エラーを避ける
  },
  eventUrlProp: { // For edit mode, changed from eventUrlToEdit
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

// modeが渡されない場合、eventUrlPropの有無で推測する
const effectiveMode = computed(() => {
  if (props.mode) {
    return props.mode;
  }
  return props.eventUrlProp ? 'edit' : 'create';
});

const pageTitle = computed(() => effectiveMode.value === 'create' ? '新しいイベントを登録' : 'イベント情報を編集');
const pageSubtitle = computed(() => effectiveMode.value === 'create' ? 'イベントの情報を入力してください。' : 'イベントの情報を更新してください。');
const submitButtonText = computed(() => {
  if (loading.value) {
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

async function fetchLocationUid() {
  if (!event.eventUrl || effectiveMode.value === 'edit') {
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  event.locationUid = '';
  event.maxParticipants = null; // 初期化

  try {
    // バックエンドの /api/fetch-html エンドポイントを呼び出す
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
    
    let locationUid = null;
    let maxParticipants = null; // maxParticipants を宣言

    // propsDataの構造を元にlocation.uidとmaxParticipantsを探す
    if (propsData && propsData.info && Array.isArray(propsData.info) && propsData.info.length > 1) {
      const infoDetails = propsData.info[1]; 
      if (infoDetails.activeSlotGroups && Array.isArray(infoDetails.activeSlotGroups) && infoDetails.activeSlotGroups.length > 1) {
        const firstSlotGroupArray = infoDetails.activeSlotGroups[1];
        if (Array.isArray(firstSlotGroupArray) && firstSlotGroupArray.length > 0) {
          const firstSlotGroup = firstSlotGroupArray[0]; 
          if (firstSlotGroup && Array.isArray(firstSlotGroup) && firstSlotGroup.length > 1 && firstSlotGroup[1].location && Array.isArray(firstSlotGroup[1].location) && firstSlotGroup[1].location.length > 1 && firstSlotGroup[1].location[1].uid && Array.isArray(firstSlotGroup[1].location[1].uid) && firstSlotGroup[1].location[1].uid.length > 1) {
            locationUid = firstSlotGroup[1].location[1].uid[1];
          }
        }
      }
      
      if (!locationUid && infoDetails.visibleLocations && Array.isArray(infoDetails.visibleLocations) && infoDetails.visibleLocations.length > 1) {
        const firstVisibleLocationArray = infoDetails.visibleLocations[1];
        if (Array.isArray(firstVisibleLocationArray) && firstVisibleLocationArray.length > 0) {
          const firstVisibleLocationData = firstVisibleLocationArray[0]; 
          if (firstVisibleLocationData && Array.isArray(firstVisibleLocationData) && firstVisibleLocationData.length > 1 && firstVisibleLocationData[1].uid && Array.isArray(firstVisibleLocationData[1].uid) && firstVisibleLocationData[1].uid.length > 1) {
            locationUid = firstVisibleLocationData[1].uid[1];
          }
        }
      }

      // maxParticipants を infoDetails 直下から取得
      if (infoDetails.maxParticipants && Array.isArray(infoDetails.maxParticipants) && infoDetails.maxParticipants.length > 1) {
        maxParticipants = infoDetails.maxParticipants[1];
      }
    }

    if (locationUid) {
      event.locationUid = locationUid;
      console.log('取得したLocation UID:', locationUid);
      if (maxParticipants !== null) {
        event.maxParticipants = maxParticipants;
        console.log('取得したMax Participants:', maxParticipants);
      } else {
        console.warn('Max Participants は取得できませんでしたが、Location UID は取得できました。');
        // maxParticipants が必須でない場合はこのままでも良い
      }
    } else {
      throw new Error('Location UIDの抽出に失敗しました。データ構造を確認してください。');
    }

  } catch (err) {
    console.error('Location UIDの取得に失敗しました:', err);
    errorMessage.value = `Location UIDの取得エラー: ${err.message}`;
  } finally {
    loading.value = false;
  }
}


async function fetchEventDetails() {
  if (effectiveMode.value === 'edit' && props.eventUrlProp) {
    loading.value = true;
    errorMessage.value = '';
    try {
      const decodedEventUrl = decodeURIComponent(props.eventUrlProp);
      const response = await fetch(`${API_BASE_URL}/events/${encodeURIComponent(decodedEventUrl)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'イベント情報の取得に失敗しました。' }));
        throw new Error(errorData.error || `サーバーエラー (${response.status})`);
      }
      const foundEvent = await response.json();
      
      if (foundEvent) {
        event.eventUrl = foundEvent.event_url;
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
  errorMessage.value = '';

  if (new Date(event.startDate) > new Date(event.endDate)) {
    errorMessage.value = '終了日は開始日以降に設定してください。';
    loading.value = false;
    return;
  }

  const payload = {
    eventUrl: event.eventUrl,
    name: event.name || null,
    startDate: event.startDate,
    endDate: event.endDate,
    locationUid: event.locationUid || null,
    maxParticipants: event.maxParticipants,
  };

  try {
    let response;
    if (effectiveMode.value === 'create') { // props.mode を effectiveMode.value に変更
      response = await fetch(`${API_BASE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else { // edit mode
      response = await fetch(`${API_BASE_URL}/events/${encodeURIComponent(event.eventUrl)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), // eventUrlはpayloadに含まれるが、パスパラメータとしても使用
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '不明なエラーが発生しました。' }));
      throw new Error(errorData.error || `サーバーエラー (${response.status})`);
    }
    
    // 成功したらイベント一覧ページに遷移
    router.push({ name: 'EventList' });

  } catch (err) {
    console.error('Failed to save event:', err);
    errorMessage.value = err.message || (effectiveMode.value === 'create' ? 'イベントの登録に失敗しました。' : 'イベントの更新に失敗しました。'); // props.mode を effectiveMode.value に変更
  } finally {
    loading.value = false;
  }
}

function cancel() {
  router.push({ name: 'EventList' });
}

onMounted(() => {
  if (effectiveMode.value === 'edit') { // props.mode を effectiveMode.value に変更
    fetchEventDetails();
  } else {
    // 新規作成時はデフォルト値を設定 (例: 今日から7日後など)
    const today = new Date();
    const defaultStartDate = new Date(today);
    const defaultEndDate = new Date(today);
    defaultEndDate.setDate(today.getDate() + 6);
    event.startDate = formatDateForInput(defaultStartDate.toISOString());
    event.endDate = formatDateForInput(defaultEndDate.toISOString());
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
</style>
