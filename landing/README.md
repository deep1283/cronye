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
- Pricing (`$9` lifetime)
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
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

Required signed license generation for checkout success handoff:

```bash
CRONYE_LICENSE_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

`CRONYE_LICENSE_PRIVATE_KEY_PEM` is required. If missing, payment may succeed but no license key will be issued.

Google recovery flow:
- checkout can attach purchase intent to Google identity (`google_sub`)
- `/recover` lets users sign in again and fetch paid license keys
- for legacy purchases, first recovery can backfill Google ownership by matching paid email

Optional download link shown on landing (macOS Apple Silicon MVP):

```bash
NEXT_PUBLIC_RELEASES_URL=https://github.com/deep1283/cronye/releases/tag/v0.1.5
NEXT_PUBLIC_DOWNLOAD_URL_MAC=/api/download/macos
```

For private GitHub repos, the landing app can proxy release assets:

```bash
GITHUB_RELEASE_TOKEN=github_pat_xxx
GITHUB_RELEASE_OWNER=deep1283
GITHUB_RELEASE_REPO=cronye
GITHUB_RELEASE_TAG=v0.1.5
GITHUB_RELEASE_ASSET_MACOS=cronye-macos.dmg
```

Build the macOS asset expected by `GITHUB_RELEASE_ASSET_MACOS` from repo root:

```bash
CRONYE_LICENSE_PUBLIC_KEY=<base64-ed25519-public-key> make package-macos-dmg VERSION=0.1.5
```

Then upload:

- `dist/release/0.1.5-darwin-arm64/cronye-macos.dmg`

to the GitHub release tag configured in `GITHUB_RELEASE_TAG`.

Webhook endpoint for Dodo:

`POST /api/dodo/webhook`

Set this URL in Dodo dashboard for your environment, for example:

- local dev via tunnel: `https://<ngrok>.ngrok.io/api/dodo/webhook`
- deployed: `https://<your-domain>/api/dodo/webhook`
