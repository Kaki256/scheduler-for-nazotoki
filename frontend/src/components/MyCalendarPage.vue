<template>
  <div class="my-calendar-container">
    <div class="calendar-header">
      <h1>マイカレンダー</h1>
      <button @click="handleGoogleImport" class="button-google-import">Googleカレンダーからインポート</button>
    </div>
    <p>自分の予定を登録して、謎解きイベントの出欠入力に活用しましょう。</p>
    <FullCalendar :options="calendarOptions" />
    <ScheduleModal
      v-if="isModalOpen"
      :event="selectedEvent"
      @close="closeModal"
      @save="saveEvent"
      @delete="deleteEvent"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import jaLocale from '@fullcalendar/core/locales/ja';
import axios from 'axios';
import ScheduleModal from './ScheduleModal.vue';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const isModalOpen = ref(false);
const selectedEvent = ref({});

const calendarOptions = ref({
  plugins: [dayGridPlugin, interactionPlugin, timeGridPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  },
  locale: jaLocale,
  events: [],
  editable: true,
  selectable: true,
  dateClick: (info) => {
    selectedEvent.value = { start: info.dateStr + 'T12:00', end: info.dateStr + 'T13:00' };
    isModalOpen.value = true;
  },
  eventClick: (info) => {
    selectedEvent.value = {
      id: info.event.id,
      title: info.event.title,
      start: info.event.startStr.slice(0, 16),
      end: info.event.endStr.slice(0, 16),
    };
    isModalOpen.value = true;
  },
});

const fetchSchedules = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/my-calendar`);
    calendarOptions.value.events = response.data.map(event => ({
      id: event.id,
      title: event.title,
      start: event.start_datetime,
      end: event.end_datetime,
    }));
  } catch (error) {
    console.error('スケジュールの取得に失敗しました:', error);
    alert('スケジュールの取得に失敗しました。');
  }
};

const handleGoogleImport = async () => {
  try {
    // 1. Get auth URL from backend
    const response = await axios.get(`${API_BASE_URL}/auth/google`);
    const { authorizationUrl } = response.data;
    // 2. Redirect user to Google's auth page
    window.location.href = authorizationUrl;
  } catch (error) {
    console.error('Google認証の開始に失敗しました:', error);
    alert('Google認証の開始に失敗しました。');
  }
};

const importFromGoogle = async () => {
  try {
    const response = await axios.post(`${API_BASE_URL}/my-calendar/import-google`);
    alert(response.data.message || 'インポートが完了しました。');
    await fetchSchedules(); // Refresh calendar
  } catch (error) {
    console.error('Googleカレンダーからのインポートに失敗しました:', error);
    alert(error.response?.data?.error || 'Googleカレンダーからのインポートに失敗しました。');
  }
};

const closeModal = () => {
  isModalOpen.value = false;
};

const saveEvent = async (event) => {
  const payload = {
    title: event.title,
    start_datetime: event.start,
    end_datetime: event.end,
  };

  try {
    if (event.id) {
      await axios.put(`${API_BASE_URL}/my-calendar/${event.id}`, payload);
    } else {
      await axios.post(`${API_BASE_URL}/my-calendar`, payload);
    }
    closeModal();
    fetchSchedules();
  } catch (error) {
    console.error('スケジュールの保存に失敗しました:', error);
    alert('スケジュールの保存に失敗しました。');
  }
};

const deleteEvent = async (eventId) => {
  if (!confirm('この予定を削除しますか？')) return;

  try {
    await axios.delete(`${API_BASE_URL}/my-calendar/${eventId}`);
    closeModal();
    fetchSchedules();
  } catch (error) {
    console.error('スケジュールの削除に失敗しました:', error);
    alert('スケジュールの削除に失敗しました。');
  }
};

onMounted(() => {
  fetchSchedules();
  // Check for query params from Google OAuth redirect
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('google_auth') === 'success') {
    alert('Googleアカウントの連携に成功しました。カレンダーをインポートします。');
    importFromGoogle();
    // Clean up URL
    window.history.replaceState({}, document.title, "/my-calendar");
  } else if (urlParams.get('google_auth') === 'error') {
    alert('Googleアカウントの連携に失敗しました。');
    window.history.replaceState({}, document.title, "/my-calendar");
  }
});

</script>

<style scoped>
.my-calendar-container {
  padding: 2rem;
  max-width: 1000px;
  margin: 0 auto;
}
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.button-google-import {
  background-color: #4285F4;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}
.button-google-import:hover {
  background-color: #357ae8;
}
</style>
