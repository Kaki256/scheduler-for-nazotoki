<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="header-inner">
        <router-link to="/events" class="brand">謎解きスケジューラー</router-link>
        <nav class="nav-links" aria-label="Primary">
          <router-link to="/events" class="nav-link">イベント一覧</router-link>
          <router-link to="/events/new" class="nav-link nav-cta">新規イベント登録</router-link>
          <router-link to="/my-calendar" class="nav-link">マイカレンダー</router-link>
        </nav>
      </div>
    </header>

    <main class="app-main">
      <router-view />
    </main>

    <footer class="app-footer">
      <div class="footer-inner">
        <p class="footer-text">
          イベント選択 → 参加入力 → 結果確認 → マイカレンダー の流れをサポートします。
        </p>
        <div class="footer-links">
          <router-link to="/events" class="footer-link">イベント一覧</router-link>
          <router-link to="/events/new" class="footer-link">新規登録</router-link>
          <router-link to="/my-calendar" class="footer-link">マイカレンダー</router-link>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  color: #0f172a;
  font-family:
    'Inter',
    'Noto Sans JP',
    system-ui,
    -apple-system,
    sans-serif;
}

.app-header {
  border-bottom: 1px solid #e2e8f0;
  background: #ffffffcc;
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.brand {
  font-weight: 800;
  letter-spacing: -0.01em;
  color: #4338ca;
  text-decoration: none;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.nav-link {
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  color: #0f172a;
  text-decoration: none;
  font-weight: 600;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.nav-link:hover,
.nav-link.router-link-active {
  background: #eef2ff;
  color: #3730a3;
}

.nav-cta {
  background: #4f46e5;
  color: #ffffff;
  box-shadow: 0 6px 20px rgba(79, 70, 229, 0.16);
}

.nav-cta:hover,
.nav-cta.router-link-active {
  background: #4338ca;
  color: #ffffff;
}

.app-main {
  flex: 1;
  min-height: 0;
}

.app-footer {
  border-top: 1px solid #e2e8f0;
  background: #ffffff;
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 1.25rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.footer-text {
  margin: 0;
  color: #475569;
  font-size: 0.95rem;
}

.footer-links {
  display: flex;
  gap: 0.75rem;
}

.footer-link {
  color: #4338ca;
  text-decoration: none;
  font-weight: 600;
}

.footer-link:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .header-inner,
  .footer-inner {
    padding: 0.75rem 1rem;
  }

  .nav-links {
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .nav-link {
    padding: 0.4rem 0.6rem;
  }
}
</style>
