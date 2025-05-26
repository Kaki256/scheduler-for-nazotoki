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
    path: '/events/new',
    name: 'NewEvent',
    component: EventFormPage,
    props: { mode: 'create' }
  },
  {
    path: '/events/edit/:orgSlugProp/:eventSlugProp',
    name: 'EditEvent',
    component: EventFormPage,
    props: route => ({ 
      mode: 'edit', 
      orgSlugProp: route.params.orgSlugProp, 
      eventSlugProp: route.params.eventSlugProp 
    })
  },
  {
    path: '/summary/:orgSlug/:eventSlug',
    name: 'EventSummary', // EventSummaryPage.vue で使用されている名前に合わせる
    component: () => import('../components/EventSummaryPage.vue'), 
    props: true
  }
  // ★ END: イベント作成・編集ルート ★
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
