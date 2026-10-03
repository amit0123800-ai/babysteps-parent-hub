<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Agent rules

- Family data access is gated by `public.is_family_member(baby_id)` in RLS; baby creation and joining go through `create_baby` / `join_family` security-definer functions — keeps membership writes atomic and safe.
- Events store type-specific data in a `details` JSONB column; an open sleep is a `sleep` event with `ended_at` null.
- The single `/` page switches between auth, onboarding and dashboard on the client, because the session lives in browser storage.
- Live updates come from a realtime subscription on `events` filtered by baby_id inside the dashboard effect.
- Night mode is a `.night` class on <html> overriding design tokens in styles.css.
