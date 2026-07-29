# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Production build
npm run lint     # Run ESLint
npm start        # Start production server
```

No test suite configured.

## Architecture

**Climbing Crew** ("아득바득") is a Next.js 16 App Router app for climbing crew attendance tracking, backed entirely by Supabase (PostgreSQL + Auth).

### Route Structure

- `/login` — Google OAuth login
- `/auth/callback` — OAuth code exchange
- `/app` — Lists user's crews, redirects to crew dashboard
- `/join?code=...` — Join a crew via invitation code
- `/[crewId]/dashboard` — Attendance stats table (main feature)
- `/[crewId]/events` — Event calendar
- `/[crewId]/stats` — Event statistics
- `/[crewId]/admin/*` — Admin-only: join requests, member management, removed members

### Data Access Pattern

All database access goes through Supabase RPC calls — no direct table queries from client code. Two clients exist:

- `src/lib/supabase/server.ts` — Server components & route handlers (cookie-based session)
- `src/lib/supabase/client.ts` — Client components (browser session)

Key RPCs: `get_crew_dashboard`, `get_crew_members_admin`, `is_crew_admin`, `get_my_crew_role`, `request_join_crew`, `get_crew_events_by_date`.

### Auth Flow

Google OAuth → `/auth/callback` (exchanges code for session) → cookies set → middleware at `middleware.ts` refreshes session on every request.

### State Management

No external state library. Server components fetch via `supabaseServer()` and render directly. Client components use `useState`/`useEffect` with `supabaseBrowser()`. `useMemo` for expensive computations (calendar generation, lookup maps).

### Key Components

- `DashboardClient` — Main attendance table with PNG export (`html-to-image`)
- `CrewCalendar` — Month/day event picker
- `CrewNav` — Hamburger nav drawer with role-based menu items
- `CrewManagementClient` — Admin member table (approve/remove/temporary members)
- `ExportableView` — Wrapper for PNG screenshot export

### TypeScript & Styling

- Path alias: `@/*` → `./src/*`
- Tailwind CSS v4 (PostCSS plugin)
- React Compiler enabled in `next.config.ts`
- Strict TypeScript mode

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
