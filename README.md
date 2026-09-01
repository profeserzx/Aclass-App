# Aclass — Landing Page

Next.js 14 + TypeScript + Tailwind CSS landing page for Aclass.

## Run it in VS Code

1. Unzip this folder and open it in VS Code.
2. Open a terminal (``Ctrl+` `` / ``Cmd+` ``) and run:
   ```bash
   npm install
   npm run dev
   ```
3. Open http://localhost:3000 in your browser.

## Project structure

```
app/
  layout.tsx      # global HTML shell, fonts, metadata
  page.tsx         # the landing page itself (hero, features, pricing, CTA)
  globals.css      # Tailwind + custom animations
tailwind.config.ts  # color palette (edit accent colors here)
```

## Next steps (once you're happy with the look)

- Swap the placeholder pricing/copy for your real numbers.
- Point "Book a demo" at a real form or Calendly link.
- This project is intentionally just the marketing site — the actual
  multi-tenant app (auth, database, dashboards) will live in a separate
  `app`/`api` structure we build next, so this landing page stays fast
  and simple.
