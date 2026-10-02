[<img alt="Spliit" height="60" src="https://github.com/spliit-app/spliit/blob/main/public/logo-with-text.png?raw=true" />](https://spliit.app)

Spliit is a free and open source alternative to Splitwise. You can either use the official instance at [Spliit.app](https://spliit.app), or deploy your own instance:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fspliit-app%2Fspliit&project-name=my-spliit-instance&repository-name=my-spliit-instance&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D&)

## Features

- [x] Create a group and share it with friends
- [x] Create expenses with description
- [x] Display group balances
- [x] Create reimbursement expenses
- [x] Progressive Web App
- [x] Select all/no participant for expenses
- [x] Split expenses unevenly [(#6)](https://github.com/spliit-app/spliit/issues/6)
- [x] Mark a group as favorite [(#29)](https://github.com/spliit-app/spliit/issues/29)
- [x] Tell the application who you are when opening a group [(#7)](https://github.com/spliit-app/spliit/issues/7)
- [x] Assign a category to expenses [(#35)](https://github.com/spliit-app/spliit/issues/35)
- [x] Search for expenses in a group [(#51)](https://github.com/spliit-app/spliit/issues/51)
- [x] Upload and attach images to expenses [(#63)](https://github.com/spliit-app/spliit/issues/63)
- [x] Create expense by scanning a receipt [(#23)](https://github.com/spliit-app/spliit/issues/23)
- [x] List the items an expense is made up of, and split it by them — fork only, see [Expense items](#expense-items)
- [x] Read receipts with Google Gemini as well as OpenAI — fork only, see [Reading receipts with Gemini instead](#reading-receipts-with-gemini-instead)

### Possible incoming features

- [ ] Ability to create recurring expenses [(#5)](https://github.com/spliit-app/spliit/issues/5)
- [ ] Import expenses from Splitwise [(#22)](https://github.com/spliit-app/spliit/issues/22)

## Stack

- [Next.js](https://nextjs.org/) for the web application
- [TailwindCSS](https://tailwindcss.com/) for the styling
- [shadcn/UI](https://ui.shadcn.com/) for the UI components
- [Prisma](https://prisma.io) to access the database
- [Vercel](https://vercel.com/) for hosting (application and database)

## Contribute

The project is open to contributions. Feel free to open an issue or even a pull-request! 
Join the discussion in [the Spliit Discord server](https://discord.gg/YSyVXbwvSY).

### Contribute financially

Spliit is free, open source, and has no ads. Hosting, database and API costs are
paid for by donations. If you want to help keep it that way, you can:

- 🧡 [Support us on Open Collective](https://opencollective.com/spliit) — recurring or one-time,
  with a public and transparent ledger of what comes in and what it is spent on, or
- 💜 [Sponsor me (Sebastien)](https://github.com/sponsors/scastiel).

Contributions of any size are appreciated, and so is simply telling people about
the project.

### Translation

The project's translations are managed using [our Weblate project](https://hosted.weblate.org/projects/spliit/spliit/). 
You can easily add missing translations to the project or even add a new language!
Here is the current state of translation:

<a href="https://hosted.weblate.org/engage/spliit/">
<img src="https://hosted.weblate.org/widget/spliit/spliit/multi-auto.svg" alt="Translation status" />
</a>

## Run locally

1. Clone the repository (or fork it if you intend to contribute)
2. Start a PostgreSQL server. You can run `./scripts/start-local-db.sh` if you don’t have a server already.
3. Copy the file `.env.example` as `.env`
4. Run `npm install` to install dependencies. This will also apply database migrations and update Prisma Client.
5. Run `npm run dev` to start the development server

## End-to-end tests

The Playwright suite in `e2e/` drives a real browser against the app running in
Docker, so it exercises the same image users deploy. It needs Docker and a free
port 3000, and nothing else — the stack builds itself from your checkout and
throws its database away afterwards.

```sh
npm run e2e
```

That builds the image, starts app + PostgreSQL from `compose.e2e.yaml`, waits
for `/api/health/readiness`, runs the suite and tears everything down. It never
touches your development stack or `./postgres-data`.

While writing tests it is quicker to keep the stack up:

```sh
npm run e2e:up                  # build and start, then leave it running
npm run e2e:test -- --ui        # iterate (also --headed, --grep, --debug)
npm run e2e:report              # open the HTML report of the last run
npm run e2e:down                # stop and delete the test database
```

`--ui` opens Playwright's UI mode, where you can pick tests, watch them run and
step through a trace. It does not start the stack itself, so run `npm run e2e:up`
first.

If port 3000 is already taken — by `npm run dev`, for instance — set
`E2E_HOST_PORT` on every command of the session, including the test run:

```sh
E2E_HOST_PORT=3100 npm run e2e             # one-shot
E2E_HOST_PORT=3100 npm run e2e:up          # or, for the iteration loop
E2E_HOST_PORT=3100 npm run e2e:test -- --ui
E2E_HOST_PORT=3100 npm run e2e:down
```

The same suite runs in GitHub Actions from the **E2E** workflow, which can be
triggered manually and runs automatically on release tags.

## Run in a container

1. Run `npm run build-image` to build the docker image from the Dockerfile
2. Copy the file `container.env.example` as `container.env`
3. Run `npm run start-container` to start the postgres and the spliit2 containers
4. You can access the app by browsing to http://localhost:3000

## Run with Docker compose

This is a sample `docker-compose.yml` file that you can use to deploy this web app.

```yaml
name: spliit

services:
  app:
    image: ghcr.io/spliit-app/spliit:latest
    user: "1000:1000" # change to your user id or remove if you want root
    ports:
      - "8080:3000/tcp"
    environment:
      POSTGRES_PRISMA_URL: postgresql://spliit:spliit@database:5432/spliit
      POSTGRES_URL_NON_POOLING: postgresql://spliit:spliit@database:5432/spliit
    volumes:
      - ./app/cache:/usr/app/.next/cache
    depends_on:
      - database
    networks:
      - spliit

  database:
    image: postgres:17.3
    user: "1000:1000" # same as above
    environment:
      POSTGRES_USER: spliit
      POSTGRES_PASSWORD: spliit
      POSTGRES_DB: spliit
    volumes:
      - ./database/data:/var/lib/postgresql/data
    networks:
      - spliit

networks:
  spliit:
```

The web app will then be available on your host at http://localhost:8080/.

You can use named volumes in place of bind mounts if you prefer not having
data stored inside local directories.

## Health check

The application has a health check endpoint that can be used to check if the application is running and if the database is accessible.

- `GET /api/health/readiness` or `GET /api/health` - Check if the application is ready to serve requests, including database connectivity.
- `GET /api/health/liveness` - Check if the application is running, but not necessarily ready to serve requests.

## Configuration

Every variable below is read at runtime. For a container deployment, set them in
`container.env` or pass them with `docker run -e`; no rebuild is required, which
means the published image can be configured by whoever runs it.

### Application URL

Set `BASE_URL` to the public URL your instance is reachable at. It is used for
metadata, the sitemap, `robots.txt`, and to accept server actions sent to that
host.

```.env
BASE_URL=https://spliit.example.com
```

Defaults to `http://localhost:3000`.

### Default currency

Set `DEFAULT_CURRENCY_CODE` to pre-select a currency on the new-group form.

```.env
DEFAULT_CURRENCY_CODE=EUR
```

Defaults to `USD`.

### Migrating from the `NEXT_PUBLIC_*` variables

Earlier versions used `NEXT_PUBLIC_`-prefixed variables for the settings above
and for the opt-in feature flags below. Next.js **inlines those into the app at
build time**, so in a prebuilt image — like the published one — they are frozen
at whatever the release build used and setting them at runtime does nothing. The
runtime variables replace them:

| Old (build-time)                       | New (runtime)              |
| -------------------------------------- | -------------------------- |
| `NEXT_PUBLIC_BASE_URL`                 | `BASE_URL`                 |
| `NEXT_PUBLIC_DEFAULT_CURRENCY_CODE`    | `DEFAULT_CURRENCY_CODE`    |
| `NEXT_PUBLIC_ENABLE_EXPENSE_DOCUMENTS` | `ENABLE_EXPENSE_DOCUMENTS` |
| `NEXT_PUBLIC_ENABLE_RECEIPT_EXTRACT`   | `ENABLE_RECEIPT_EXTRACT`   |
| `NEXT_PUBLIC_ENABLE_CATEGORY_EXTRACT`  | `ENABLE_CATEGORY_EXTRACT`  |

**The old variables still work** — the runtime variant simply takes precedence
when both are set, so there is nothing you have to change immediately. They
remain the right choice if you build your own image and want a setting baked in.
To migrate, drop the `NEXT_PUBLIC_` prefix and set the variable wherever your
container gets its environment.

## Opt-in features

### Expense documents

Spliit offers users to upload images (to an AWS S3 bucket) and attach them to expenses. To enable this feature:

- Follow the instructions in the _S3 bucket_ and _IAM user_ sections of [next-s3-upload](https://next-s3-upload.codingvalue.com/setup#s3-bucket) to create and set up an S3 bucket where images will be stored.
- Update your environments variables with appropriate values:

```.env
ENABLE_EXPENSE_DOCUMENTS=true
S3_UPLOAD_KEY=AAAAAAAAAAAAAAAAAAAA
S3_UPLOAD_SECRET=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
S3_UPLOAD_BUCKET=name-of-s3-bucket
S3_UPLOAD_REGION=us-east-1
```

You can also use other S3 providers by providing a custom endpoint:

```.env
S3_UPLOAD_ENDPOINT=http://localhost:9000
```

### Create expense from receipt

You can offer users to create expense by uploading a receipt. The scan reads the total, the date, a title, a category and the receipt's individual line items, which are filled into the new expense (see _Expense items_ below). It relies on a vision-capable model and a public S3 storage endpoint.

To enable the feature:

- You must enable expense documents feature as well (see section above). That might change in the future, but for now we need to store images to make receipt scanning work.
- Get an API key for a vision-capable model, either from [OpenAI](https://platform.openai.com/docs/guides/vision) or from [Google AI Studio](https://aistudio.google.com/apikey) (you might need to buy credits in advance).
- Update your environment variables with appropriate values:

```.env
ENABLE_RECEIPT_EXTRACT=true
OPENAI_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

The model defaults to `gpt-5-nano` and can be changed with the optional `OPENAI_MODEL_RECEIPT_EXTRACT` variable — a larger model reads poor-quality photos more reliably, at a higher price per scan.

#### Reading receipts with Gemini instead

Receipts can also be read by Google's [Gemini API](https://ai.google.dev/gemini-api/docs), which has a free tier. **`ENABLE_RECEIPT_EXTRACT` is satisfied by either key**, so an instance that only scans receipts needs no OpenAI account at all.

To set it up:

- Enable expense documents, as for any receipt scanning (see above) — the image still has to be stored somewhere.
- Create a key at [Google AI Studio](https://aistudio.google.com/apikey). The free tier is rate-limited but needs no card; a paid key is the same variable.
- Set the two variables, and no OpenAI ones:

```.env
ENABLE_EXPENSE_DOCUMENTS=true
ENABLE_RECEIPT_EXTRACT=true
GEMINI_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

- Optionally pick a different model with `GEMINI_MODEL_RECEIPT_EXTRACT`. It defaults to `gemini-3.1-flash-lite`; any vision-capable Gemini model works, and a larger one reads poor-quality photos more reliably.

Things worth knowing:

- **`GEMINI_API_KEY` wins.** If both keys are set, receipts go to Gemini and the OpenAI key is only used for _Deduce category from title_, which has no Gemini path. Set `GEMINI_API_KEY` only if that is what you want.
- **The app downloads the image.** Unlike OpenAI, Gemini does not fetch the receipt URL itself, so the server pulls it from your S3 storage and sends it inline. Images over 10 MB are refused.
- **`OPENAI_BASE_URL` does not apply.** It configures the OpenAI client only; the Gemini path always talks to `generativelanguage.googleapis.com`.
- **Schema rejection is handled.** If the model rejects the JSON schema with a 400, the request is retried once without it, since the prompt alone still names every field.

### Expense items

Every expense can list the items it was made up of — what each line was, what it cost, and which participants share it. Items are optional and need no configuration: an expense without them behaves exactly as before.

Ticking **Split by items** turns those assignments into the expense's split: each item's price goes to the participants who share it, and anything the items do not account for — tax, a tip, a discount, a line nobody claimed — is shared evenly between them. The shares always add up to the expense amount to the minor unit, and they are saved as an ordinary _by amount_ split, so balances, totals and the CSV export need to know nothing about items.

Receipt scanning fills the items in automatically when the feature above is enabled.

### Deduce category from title

You can offer users to automatically deduce the expense category from the title. Since this feature relies on a OpenAI subscription, follow the signup instructions above and configure the following environment variables:

```.env
ENABLE_CATEGORY_EXTRACT=true
OPENAI_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

The model defaults to `gpt-5-nano` and can be changed with the optional `OPENAI_MODEL_CATEGORY_EXTRACT` variable.

### Using another OpenAI-compatible provider

Both AI features above talk to the official OpenAI API by default — except receipt reading when `GEMINI_API_KEY` is set, which bypasses the OpenAI client entirely and ignores everything in this section. Set the optional `OPENAI_BASE_URL` variable to point them at a self-hosted or alternative provider instead:

```.env
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL_RECEIPT_EXTRACT=name-of-a-vision-model
OPENAI_MODEL_CATEGORY_EXTRACT=name-of-a-text-model
```

Whichever provider you choose has to support the `json_schema` response format ([structured outputs](https://platform.openai.com/docs/guides/structured-outputs)), and the receipt feature additionally needs image input. If a response does not match the expected schema, the app reports that nothing could be extracted rather than filling the form with guesses.

If your environment file was created on Windows, make sure it uses **LF line endings**. A trailing carriage return makes `OPENAI_API_KEY` or `GEMINI_API_KEY` fail authentication and silently switches feature flags off.

### Analytics

Spliit can report anonymous usage events to an analytics service. **It is disabled by default**: nothing is loaded and nothing is sent unless you select a provider.

Select one with `ANALYTICS_PROVIDER`. The variables are read on the server, so a single Docker image can be configured when the container starts.

Several providers can be listed, comma-separated, and every event is reported to each of them. That is how to try a new service next to the one you already use, or to watch what is sent while keeping the real one:

```.env
ANALYTICS_PROVIDER=plausible,umami
```

#### `console` — see what would be reported

Logs every event to the browser console and sends nothing anywhere. Useful while developing, and the shortest example of what a provider looks like.

```.env
ANALYTICS_PROVIDER=console
```

#### `plausible`

Reports to [Plausible](https://plausible.io), a privacy-friendly, cookie-free analytics service. No extra dependency is installed: the provider is a script tag and a function call.

```.env
ANALYTICS_PROVIDER=plausible
PLAUSIBLE_DOMAIN=your-domain.com
```

For a self-hosted Plausible instance, point at it with `PLAUSIBLE_HOST`:

```.env
PLAUSIBLE_HOST=https://plausible.your-domain.com
```

Ad blockers drop requests to known analytics hosts. To avoid that, serve the script and the event endpoint from your own origin by adding [rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites) in `next.config.mjs` and pointing the provider at them:

```.env
PLAUSIBLE_SCRIPT_URL=/js/script.manual.js
PLAUSIBLE_API_URL=/proxy/api/event
```

#### `umami`

Reports to [Umami](https://umami.is), a privacy-friendly, cookie-free analytics service that is open source and runs on PostgreSQL if you self-host it. Like the Plausible provider, it is a script tag and a function call: no dependency is installed. Umami's tracker would also send the page title and same-origin referrers, which on group pages carry the group name and possibly a group ID; the provider drops both.

```.env
ANALYTICS_PROVIDER=umami
UMAMI_WEBSITE_ID=your-website-id
```

The script is loaded from Umami Cloud by default. For a self-hosted instance, point at its script:

```.env
UMAMI_SCRIPT_URL=https://umami.your-domain.com/script.js
```

To serve the script and the event endpoint from your own origin (see the Plausible section for why), add the rewrites and tell the tracker where events go — `UMAMI_HOST_URL` is the base the tracker appends `/api/send` to:

```.env
UMAMI_SCRIPT_URL=/js/umami.js
UMAMI_HOST_URL=/proxy/umami
```

```js
// next.config.mjs — with your own instance in place of cloud.umami.is if you self-host
async rewrites() {
  return [
    { source: '/js/umami.js', destination: 'https://cloud.umami.is/script.js' },
    { source: '/proxy/umami/api/send', destination: 'https://cloud.umami.is/api/send' },
  ]
},
```

#### What is reported

Pageviews for a handful of pages, and one event per significant action: creating and updating a group, creating, updating and deleting an expense, attaching a document, scanning a receipt, and exporting expenses.

**Group and expense IDs are never sent.** They are the capability to read someone's group, so `/groups/<id>/expenses` is reported as `/groups/[groupId]/expenses`. Anonymization happens in one place, `anonymizePath` in `src/lib/analytics/`, between the call sites and every provider, and the event types forbid properties that are not explicitly declared — so leaking an ID is a compile error rather than a review question.

Pages are tracked explicitly, with `<TrackPage path="…" />`. A new route reports nothing until someone adds it, which keeps that a deliberate decision.

This is unrelated to the group activity log (the _Activity_ tab), which is stored in your own database and is a product feature rather than analytics.

#### Adding a provider

Providers live in `src/lib/analytics/providers/`. Copy `console.tsx`, then register the new one in three places: `provider-ids.ts`, `registry.ts`, and `config.ts` (to map its environment variables to options). The last two are type-checked against the first, so `npm run check-types` tells you exactly what is missing.

A provider supplies a transport — where events go — and optionally a `Script` component if it needs to load an SDK.

## Maintaining this fork

This repository is a fork of [spliit-app/spliit](https://github.com/spliit-app/spliit) that adds two things of its own: [expense items](#expense-items) and [reading receipts with Gemini](#reading-receipts-with-gemini-instead). Everything else is upstream, and the point of this section is to keep it that way — upstream stays pullable, and the fork's changes stay a small, reviewable diff on top.

### Branch model

`main` is a pure mirror of `upstream/main`. **Nothing is ever committed to it.** The fork's own commits live on one long-lived branch, `mkloouo-spliit-fork`, which is what releases are tagged from.

One-time setup:

```bash
git remote add upstream https://github.com/spliit-app/spliit.git
git fetch upstream
```

### Pulling from upstream

```bash
# 1. fast-forward the mirror
git checkout main
git pull upstream main
git push origin main

# 2. replay the fork's commits on top
git checkout mkloouo-spliit-fork
git rebase main
# ...resolve conflicts, then...

# 3. verify before pushing
npm ci --ignore-scripts && npx prisma generate
npm run check-types && npm test && npm run check-formatting

git push --force-with-lease origin mkloouo-spliit-fork
```

`npm ci --ignore-scripts` is deliberate: the repo's `postinstall` runs `prisma migrate deploy`, which needs a reachable database. `npx prisma generate` then produces the client in `src/generated/prisma`, which `npm run check-types` needs.

**Rebase rather than merge.** The fork's commits replay on top of upstream, so every conflict reads as "my hunk versus the new upstream version of that hunk" instead of a three-way tangle, and `git diff main...mkloouo-spliit-fork` is always exactly the fork's feature set and nothing else. The cost is rewritten history, which means an existing release tag keeps pointing at the commit it was cut from — correct behaviour for a release, so not really a cost.

### Where conflicts land

Upstream commits touching each file in the last twelve months, against what the fork changes in it:

| File                           | Upstream commits | The fork's footprint                                                      |
| ------------------------------ | ---------------- | ------------------------------------------------------------------------- |
| `expense-form.tsx`             | 18               | three `defaultValues` blocks, two lines in `submit()`, one effect, one `<Card>`, two `disabled={}` |
| `messages/en-US.json`          | 11               | `ExpenseForm.ItemsField`, two `CreateFromReceipt` keys                    |
| `api.ts`, `env.ts`, `schemas.ts` | 5 each         | small and localized                                                       |
| `prisma/schema.prisma`         | 2                | three additions                                                           |
| `gemini.ts`, `items.ts`, `expense-items-input.tsx`, `receipt-items.ts`, the migration | — | new files, so they can never conflict |

That distribution is deliberate, and worth preserving when adding to the fork:

- **The logic lives in new files.** Deriving a split from items is `src/lib/items.ts`, with its own tests, rather than code inside the form. If upstream rewrites `expense-form.tsx` wholesale, you re-apply a handful of small hunks and never the algorithm.
- **Nothing downstream of the split was touched.** "Split by items" saves an ordinary `BY_AMOUNT` split, so `balances.ts`, `totals.ts`, `shares.ts` and the CSV export — all files upstream does change — needed no modification at all.
- **Translations cannot break.** `src/i18n/request.ts` deepmerges every locale over `en-US`, so upstream's constant Weblate updates are safe: a string the fork added simply renders in English until someone translates it.

### One hazard: migration ordering

The fork's migration is `prisma/migrations/20261002000000_add_expense_items`. If upstream later adds a migration dated *earlier* than that, a fresh database applies upstream's first while an existing one applied the fork's first. That is harmless here, because the fork's migration only creates new tables, but keep it in mind for anything less self-contained.

**Do not rename that directory once it has been deployed.** Prisma records applied migrations by name in `_prisma_migrations`, and a rename reads as one migration having vanished and an unknown one having appeared.

## Deploying this fork

Pushing a tag runs [`.github/workflows/cd.yml`](.github/workflows/cd.yml), which builds `linux/amd64` and `linux/arm64` images and publishes them to `ghcr.io/mkloouo/spliit` under both the tag and `latest`.

### With Docker compose

The `compose.yaml` in this repository builds from source, which is what you want for development. On a server, run the published image instead:

```yaml
services:
  app:
    image: ghcr.io/mkloouo/spliit:v1.0.0 # pin the tag; `latest` moves under you
    restart: unless-stopped
    ports:
      - 3000:3000
    env_file:
      - container.env
    depends_on:
      db:
        condition: service_healthy
    networks: [spliit_network]

  db:
    image: postgres:latest
    restart: unless-stopped
    expose: [5432]
    env_file:
      - container.env
    volumes:
      - spliit-db:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5
    networks: [spliit_network]

volumes:
  spliit-db:

networks:
  spliit_network:
    driver: bridge
```

Start from [`container.env.example`](./container.env.example), and add the fork's own variables for receipt scanning:

```.env
ENABLE_EXPENSE_DOCUMENTS=true # receipts need S3; set the S3_* variables too
ENABLE_RECEIPT_EXTRACT=true
GEMINI_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Expense items need no configuration or feature flag; only reading receipts does.

Three things to know before the first deploy:

- **The package is private by default.** Either run `docker login ghcr.io -u <your-github-username>` on the server with a personal access token scoped `read:packages`, or make the package public under GitHub → Packages → spliit → Package settings.
- **Migrations run themselves.** [`scripts/container-entrypoint.sh`](./scripts/container-entrypoint.sh) runs `prisma migrate deploy` before starting the server, so the `ExpenseItem` tables are created on the first boot of a new image. There is no manual step — but back the database up first anyway, because it is a schema change.
- **A named volume, not `./postgres-data`.** The volume in this repository's `compose.yaml` is a bind mount into the working copy, which is fine for throwaway local data and wrong for a server.

### Building on the server instead

If you would rather not involve the registry, clone the repository on the server and swap `image:` for `build: .`. That needs no tag and no login, at the cost of a few minutes and roughly a gigabyte of build space on every update.

## License

MIT, see [LICENSE](./LICENSE).
