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
- Open-source
- FAQ
- CTA

SEO basics:

- Metadata + OpenGraph/Twitter cards
- Dynamic OG image route (`/opengraph-image`)
- FAQ structured data (JSON-LD)
- `sitemap.xml` and `robots.txt`

## Download Setup

Landing download button (macOS Apple Silicon MVP):

```bash
NEXT_PUBLIC_DOWNLOAD_URL_MAC=/api/download/macos
# Optional support link override (default is one-click /api/support/checkout)
NEXT_PUBLIC_SUPPORT_URL=/api/support/checkout
```

Optional support checkout via Dodo API (used by `/api/support/checkout`):

```bash
DODO_PAYMENTS_ENVIRONMENT=test_mode
DODO_PAYMENTS_API_KEY=dp_test_xxx
DODO_PRODUCT_ID=pdt_xxx
DODO_RETURN_URL_BASE=http://localhost:3000
SUPPORT_CHECKOUT_EMAIL_DOMAIN=cronye.app
```

For private GitHub repos, the landing app can proxy release assets:

```bash
GITHUB_RELEASE_TOKEN=github_pat_xxx
GITHUB_RELEASE_OWNER=deep1283
GITHUB_RELEASE_REPO=cronye
GITHUB_RELEASE_TAG=v0.1.6
GITHUB_RELEASE_ASSET_MACOS=cronye-macos.dmg
```

Build the macOS asset expected by `GITHUB_RELEASE_ASSET_MACOS` from repo root:

```bash
make package-macos-dmg VERSION=0.1.6
```

Then upload:

- `dist/release/0.1.6-darwin-arm64/cronye-macos.dmg`

to the GitHub release tag configured in `GITHUB_RELEASE_TAG`.
