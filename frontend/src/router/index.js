import { createRouter, createWebHistory } from 'vue-router';
import EventListPage from '../components/EventListPage.vue';
import SchedulePage from '../components/SchedulePage.vue';
import EventFormPage from '../components/EventFormPage.vue';
import EventSummaryPage from '../components/EventSummaryPage.vue';
import MyCalendarPage from '../components/MyCalendarPage.vue'; // 追加

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
    name: 'CreateEvent',
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
    name: 'EventSummary',
    component: EventSummaryPage, 
    props: true
  },
  {
    path: '/my-calendar',
    name: 'MyCalendar',
    component: MyCalendarPage,
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
