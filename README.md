# Mealprepper

```bash
bun install          # deps
bun run dev          # http://localhost:3000
bun run build        # production
bun run preview      # local prod preview
```

Libelle recipe URL import uses Playwright (Chromium):

```bash
# one-time local setup
bunx playwright install chromium

# CI/Linux servers (ensures required OS libs are installed)
bunx playwright install --with-deps chromium
```

[Nuxt deployment](https://nuxt.com/docs/getting-started/deployment)
