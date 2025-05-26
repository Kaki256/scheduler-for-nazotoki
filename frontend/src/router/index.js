import { createRouter, createWebHistory } from 'vue-router';
import EventListPage from '../components/EventListPage.vue';
import SchedulePage from '../components/SchedulePage.vue';
import EventFormPage from '../components/EventFormPage.vue';

const routes = [
  {
    path: '/',
    redirect: '/events',
  },
  {
    path: '/events',
    name: 'EventList',
    component: EventListPage,
  },
  {
    path: '/schedule/:orgSlug/:eventSlug',
    name: 'SchedulePage',
    component: SchedulePage,
    props: true
  },
  {
    path: '/create-event',
    name: 'CreateEvent',
    component: EventFormPage,
    props: { mode: 'create' } // 作成モード
  },
  {
    path: '/edit-event/:eventUrlProp(.*)',
    name: 'EditEvent',
    component: EventFormPage,
    props: true // ルートパラメータをpropsとして渡す
  },
  {
    path: '/event/:eventUrlProp/summary',
    name: 'EventSummaryPage',
    component: () => import('../components/EventSummaryPage.vue'), // 遅延読み込み
    props: true
  }
  // ★ END: イベント作成・編集ルート ★
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
