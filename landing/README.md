# Landing (Next.js)

Run locally:

```bash
npm install
npm run dev
```

Default URL: `http://localhost:3000`

If you ever hit a Next.js missing-chunk runtime error (for example `Cannot find module './638.js'`), stop any running dev server and run:

```bash
npm run dev:clean
```

Included sections:

- Hero
- Features
- Performance
- Pricing (`$39` lifetime)
- FAQ
- CTA

SEO basics:

- Metadata + OpenGraph/Twitter cards
- Dynamic OG image route (`/opengraph-image`)
- FAQ structured data (JSON-LD)
- `sitemap.xml` and `robots.txt`

## Dodo test checkout setup

Create `.env.local` in `landing/`:

```bash
DODO_PAYMENTS_ENVIRONMENT=test_mode
DODO_PAYMENTS_API_KEY=dp_test_xxx
DODO_PRODUCT_ID=pdt_xxx
DODO_RETURN_URL_BASE=http://localhost:3000
DODO_WEBHOOK_SECRET=whsec_xxx
```

Required signed license generation for checkout success handoff:

```bash
CRONYE_LICENSE_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

`CRONYE_LICENSE_PRIVATE_KEY_PEM` is required. If missing, payment may succeed but no license key will be issued.

Optional OS-specific download links shown on landing:

```bash
NEXT_PUBLIC_RELEASES_URL=https://github.com/deep1283/cronye/releases/tag/v0.1.5
NEXT_PUBLIC_DOWNLOAD_URL_MAC=/api/download/macos
NEXT_PUBLIC_DOWNLOAD_URL_WINDOWS=/api/download/windows
NEXT_PUBLIC_DOWNLOAD_URL_LINUX=/api/download/linux
```

For private GitHub repos, the landing app can proxy release assets:

```bash
GITHUB_RELEASE_TOKEN=github_pat_xxx
GITHUB_RELEASE_OWNER=deep1283
GITHUB_RELEASE_REPO=cronye
GITHUB_RELEASE_TAG=v0.1.5
GITHUB_RELEASE_ASSET_MACOS=cronye-macos.dmg
GITHUB_RELEASE_ASSET_WINDOWS=cronye-windows-x64.exe
GITHUB_RELEASE_ASSET_LINUX=cronye-linux-x64.tar.gz
```

Webhook endpoint for Dodo:

`POST /api/dodo/webhook`

Set this URL in Dodo dashboard for your environment, for example:

- local dev via tunnel: `https://<ngrok>.ngrok.io/api/dodo/webhook`
- deployed: `https://<your-domain>/api/dodo/webhook`
