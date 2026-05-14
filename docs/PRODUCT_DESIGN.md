# Product Design

## Overview

A schedule coordination and team building application for puzzle events. It fetches event schedules from ticketing sites and suggests optimal team combinations based on participants' availability.

## UI/UX Guidelines

- **Technology Stack:** Vue.js 3 + Vite + Vue Router.
- **Interface:** Intuitive calendar-based operation, visualizing availability in real-time.
- **Responsiveness:** Optimized for Mobile, Tablet, and Desktop environments.

## Core Features

1. **Event Management:** Auto-fetch event details by providing a URL (escape.id, LivePocket, Yodaka).
2. **Schedule Input:** Calendar UI for individuals to input their availability (Available, Maybe, Unavailable).
3. **Team Building:** Automatically calculates the best team combinations based on availability scores and allows fixing specific members in the same team.
   - *Performance Note:* To handle combinatorial explosions for large groups (20-30+ users), the calculation is performed on the backend using a time-boxed best-effort algorithm (max 5 seconds) to ensure system stability and a responsive UX.
