#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/tngxola/WebstormProjects/nfa-planners-web"
cd "$ROOT"

echo "== NFA platform restructure =="

if [ ! -d ".git" ]; then
  echo "ERROR: $ROOT is not a git repository."
  exit 1
fi

# Ensure a clean working tree before structural moves.
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree is not clean."
  echo "Commit or stash your current changes, then run again."
  git status --short
  exit 1
fi

# Safety branch before moving the existing website scaffold.
git branch backup/pre-monorepo-structure 2>/dev/null || true

mkdir -p apps/web apps/console/src/app/{login,dashboard,opportunities,notifications}
mkdir -p apps/console/src/app/opportunities/'[slug]'
mkdir -p apps/console/src/{components/{auth,dashboard,opportunities,notifications,layout},lib/{auth,opportunities,notifications},types}
mkdir -p services/opportunity-intelligence/{src/{sources,ingestion,normalization,deduplication,matching,scoring,change-detection,persistence,notifications/email,scheduler},tests}
mkdir -p packages/{ui,types,validation,config}
mkdir -p docs/{architecture,engineering}

# Move the existing public Next.js app into apps/web.
for item in \
  src public \
  next.config.ts next-env.d.ts \
  eslint.config.mjs postcss.config.mjs tsconfig.json
do
  if [ -e "$item" ]; then
    mv "$item" apps/web/
  fi
done

# Move package files for the existing web app.
for item in package.json package-lock.json; do
  if [ -e "$item" ]; then
    mv "$item" apps/web/
  fi
done

cat > package.json <<'JSON'
{
  "name": "nfa-platform",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "services/*"
  ],
  "scripts": {
    "dev:web": "npm --workspace apps/web run dev",
    "dev:console": "npm --workspace apps/console run dev",
    "build:web": "npm --workspace apps/web run build",
    "build:console": "npm --workspace apps/console run build",
    "lint": "npm run lint --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  }
}
JSON

cat > apps/console/package.json <<'JSON'
{
  "name": "@nfa/console",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^16.0.0",
    "typescript": "^5.8.0"
  }
}
JSON

cat > apps/console/tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
JSON

cat > apps/console/next.config.ts <<'TS'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false
};

export default nextConfig;
TS

cat > apps/console/next-env.d.ts <<'TS'
/// <reference types="next" />
/// <reference types="next/image-types/global" />
TS

cat > apps/console/src/app/globals.css <<'CSS'
:root {
  --nfa-ink: #0d2340;
  --nfa-green: #2f7d32;
  --nfa-orange: #f47a16;
  --nfa-bg: #f5f7f8;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--nfa-bg);
  color: var(--nfa-ink);
  font-family: Arial, Helvetica, sans-serif;
}
a { color: inherit; }
CSS

cat > apps/console/src/app/layout.tsx <<'TSX'
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NFA Opportunity Intelligence",
  description: "Internal NFA tender opportunity intelligence console"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
TSX

cat > apps/console/src/app/page.tsx <<'TSX'
import { redirect } from "next/navigation";

export default function ConsoleHome() {
  redirect("/login");
}
TSX

cat > apps/console/src/app/login/page.tsx <<'TSX'
export default function LoginPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 420, background: "#fff", padding: 32, borderRadius: 18 }}>
        <p style={{ color: "#2f7d32", fontWeight: 700, letterSpacing: ".08em" }}>
          NFA OPPORTUNITY INTELLIGENCE
        </p>
        <h1>Sign in</h1>
        <p>Access active tender opportunities and notifications.</p>
        <form>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              style={{ display: "block", width: "100%", marginTop: 8, padding: 12 }}
            />
          </label>
          <label style={{ display: "block", marginTop: 16 }}>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              style={{ display: "block", width: "100%", marginTop: 8, padding: 12 }}
            />
          </label>
          <button
            type="submit"
            style={{ width: "100%", marginTop: 20, padding: 13, background: "#0d2340", color: "#fff", border: 0, borderRadius: 8 }}
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
TSX

cat > apps/console/src/app/dashboard/page.tsx <<'TSX'
const cards = [
  ["14", "Active opportunities"],
  ["3", "New today"],
  ["2", "Briefings next 7 days"],
  ["5", "Closing next 14 days"]
];

export default function DashboardPage() {
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: 32 }}>
      <p style={{ color: "#2f7d32", fontWeight: 700 }}>NFA OPPORTUNITY INTELLIGENCE</p>
      <h1>Dashboard</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
        {cards.map(([value, label]) => (
          <article key={label} style={{ background: "#fff", padding: 24, borderRadius: 16 }}>
            <div style={{ fontSize: 38, fontWeight: 800 }}>{value}</div>
            <div>{label}</div>
          </article>
        ))}
      </div>
    </main>
  );
}
TSX

cat > apps/console/src/app/opportunities/page.tsx <<'TSX'
export default function OpportunitiesPage() {
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: 32 }}>
      <h1>Active opportunities</h1>
      <p>Only tenders whose closing date has not passed will appear here.</p>
    </main>
  );
}
TSX

cat > "apps/console/src/app/opportunities/[slug]/page.tsx" <<'TSX'
export default async function OpportunityPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 32 }}>
      <p style={{ color: "#2f7d32", fontWeight: 700 }}>NFA OPPORTUNITY INTELLIGENCE</p>
      <h1>Opportunity</h1>
      <p>{slug}</p>
      <p>This route will render the persisted tender record and its NFA capability match.</p>
    </main>
  );
}
TSX

cat > apps/console/src/app/notifications/page.tsx <<'TSX'
export default function NotificationsPage() {
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: 32 }}>
      <h1>Notifications</h1>
      <p>New tender, briefing, closing-date and tender-update notifications will appear here.</p>
    </main>
  );
}
TSX

cat > docs/architecture/platform-structure.md <<'MD'
# NFA Platform Structure

## Product surfaces

- `apps/web` — public NFA website (`nfaplanners.com`)
- `apps/console` — internal Opportunity Intelligence console (`console.nfaplanners.com`)
- `services/opportunity-intelligence` — tender ingestion, normalization, matching, persistence and notifications
- `packages/*` — shared types, validation, configuration and UI primitives

## Console MVP

1. Login
2. Dashboard
3. Active opportunities
4. Opportunity detail
5. Notifications

Only opportunities whose closing date has not passed are shown by default.

Email deep links preserve their requested destination:

`email -> /opportunities/{slug} -> login -> returnTo -> opportunity`

## Delivery order

1. Console shell
2. Authentication
3. Opportunity persistence/query layer
4. Email notifications
5. OCDS ingestion and capability matching
6. Near-real-time scanning and change detection
MD

# Ensure IDE/build output remains local.
cat >> .gitignore <<'EOF'

# IDE
.idea/

# Next.js
.next/

# dependencies
node_modules/

# local secrets
.env
.env.local
.env.*.local
EOF

npm install

git add .
git commit -m "chore: restructure NFA repository as platform monorepo"

# Ensure main exists remotely first.
git push -u origin main

# Create planned branches from the same baseline.
branches=(
  "feat/001-opportunity-console"
  "feat/002-console-auth"
  "feat/003-opportunity-persistence"
  "feat/004-email-notifications"
  "feat/005-ocds-ingestion"
  "feat/006-realtime-opportunity-alerts"
  "feat/007-notification-centre"
  "chore/008-engineering-governance"
)

for branch in "${branches[@]}"; do
  if ! git show-ref --verify --quiet "refs/heads/$branch"; then
    git branch "$branch" main
  fi
  git push -u origin "$branch"
done

# Start with console first.
git switch feat/001-opportunity-console

echo
echo "Done."
echo "Current branch: $(git branch --show-current)"
echo "Next: implement console shell on feat/001-opportunity-console"