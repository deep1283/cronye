# Landing (Next.js)

Run locally:

```bash
npm install
npm run dev
```

Default URL: `http://localhost:3000`

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
```

Optional signed license generation for success handoff:

```bash
CRONYE_LICENSE_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

If `CRONYE_LICENSE_PRIVATE_KEY_PEM` is missing, success flow generates a `plain:` dev token.
