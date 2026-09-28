# Voyora

> Collaborative scheduling — find the dates that work for everyone in your group.

Coordinating dates within a group usually means an endless back-and-forth of messages. Voyora gives everyone a shared calendar where each person marks their availability, and the app surfaces the dates that overlap best for the whole group — in real time.

## Screenshots

<img width="500" height="683" alt="cap1" src="https://github.com/user-attachments/assets/4479c53a-8dd0-4266-85ec-f465a19e7542" />

## Features

- Create a group and invite members via shareable link
- Mark available / busy dates on a shared interactive calendar
- Visual overlap: instantly see which dates work for the most people
- Real-time updates — changes sync across all members instantly
- Multilingual (ES / EN)
- Works as a mobile app via Capacitor

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8 |
| Auth & Database | Supabase (PostgreSQL + Realtime) |
| Mobile | Capacitor 8 |
| i18n | i18next / react-i18next |
| Analytics | PostHog |
| CI/CD | GitHub Actions |
| Deploy | Vercel · [voyora.app](https://voyora.app) |
