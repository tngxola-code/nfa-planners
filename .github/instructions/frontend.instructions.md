# Frontend Engineering Instructions

Applies to:

- src/app/**
- src/components/**

## Principles

- Prefer React Server Components.
- Use Client Components only when browser APIs, local interaction state or client-only libraries are required.
- Keep business logic out of React components.
- Keep infrastructure and external API access out of UI code.
- Design mobile-first.
- Maintain WCAG 2.2 AA accessibility.
- Provide loading, empty, error and success states.
- Never expose server secrets to client code.
- Keep components focused and composable.
- Prefer explicit types over `any`.

## Console

Console routes live under:

/console

Expected routes:

- /console/dashboard
- /console/opportunities
- /console/opportunities/[slug]
- /console/notifications
- /console/login

The public website and console remain part of the same Next.js application.
