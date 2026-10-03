# BabySteps Parent Hub

Create a mobile-first, clean, modern parenting web app in Hebrew (RTL support) called "BabySteps".

Core Requirements for Phase 1:

1. Authentication & Family Sharing:

   - Users can sign up via Email.

   - Onboarding: Create a baby profile (Name, Birthdate, Gender).

   - "Family Invite" feature: Generate a simple 6-character code or invite link so both parents can link to the same baby profile and share data in real-time.

2. Main Dashboard (Mobile-first, clean UI):

   - Header: Baby name, current age in weeks/months, and a toggle for "Night Mode" (ultra-dark OLED theme with minimal light).

   - "Last Status" Cards:

     * Last Feeding: e.g., "1 hour 45 min ago (90 ml)"

     * Last Diaper: e.g., "3 hours ago (Wet + Dirty)"

     * Sleep Status: Timer if currently sleeping, or "Awake for 1h 15m"

   - Quick Action Buttons (Big, tap-friendly, accessible with one hand):

     * Diaper: Quick modal with options: Wet (פיפי), Dirty (קקי), Both (שניהם).

     * Feeding: Bottle (selectable ml: 60, 90, 120, 150ml) or Breastfeeding (Left/Right side duration).

     * Sleep: Toggle button (Start Sleep / Wake Up).

3. Daily Timeline View:

   - Chronological list of today's logged events with timestamp and badge showing who logged it (e.g., "אבא", "אמא").

   - Option to edit or delete mistakenly logged events.

4. Database (Supabase):

   - Create tables: `babies`, `family_members`, and `events` (using a JSONB field for event details).

   - Enable Supabase Realtime so that when one parent logs an event, it instantly updates on the other parent's screen.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/81b2dc18-cd09-4f89-b04b-a64f3d6aa3aa).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
