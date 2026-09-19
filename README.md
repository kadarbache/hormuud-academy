# College System

Student registration and skills for one college with several branches.

Phase 1 covers branches, the skill catalog, teachers, classes, staff accounts, student registration and enrollments. Fees, attendance, exams, salaries, expenses and reports come in later phases.

- [CONTEXT.md](CONTEXT.md) defines the words this project uses: skill, branch skill, class, enrollment and the rest.
- [docs/adr](docs/adr) records the two decisions everything else depends on.

## Stack

Next.js 16 (App Router and server actions), Prisma 7 on Postgres, Better Auth (email and password, with the admin plugin for staff accounts), shadcn/ui, and Cloudinary for student photos. Production runs on Vercel with a Neon database.

## Run it locally

You need Node 20 or later and pnpm. The local database runs inside the Prisma CLI, so Docker isn't needed.

```bash
pnpm install
cp .env.example .env
pnpm db:local
```

`pnpm db:local` starts a Postgres server in the background. Fill in `.env`:

```bash
DATABASE_URL="postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"
DIRECT_URL="postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"
DATABASE_POOL_MAX="1"
SHADOW_DATABASE_URL="postgres://postgres:postgres@localhost:51215/template1?sslmode=disable"
BETTER_AUTH_SECRET="<run the command in .env.example to make one>"
SEED_ADMIN_EMAIL="you@example.com"
SEED_ADMIN_PASSWORD="<at least 8 characters>"
```

Then create the tables and the first admin, and start the app:

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000 and log in as the admin. To try the app with sample branches, skills, teachers and students, run `pnpm db:demo` on an empty database. It prints a login for a branch staff account.

## Student photos

Photo upload stays off until `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are set. The keys are on the Cloudinary dashboard.

## Deploy

1. Push the repo to GitHub and import it into Vercel. A paying college needs Vercel's Pro plan; the free Hobby plan is for non-commercial use.
2. Add Neon from the Vercel Marketplace. It sets `DATABASE_URL` for the app and `DATABASE_URL_UNPOOLED` for migrations.
3. In the Vercel project settings, set `BETTER_AUTH_SECRET` (a new one, not the local one), `BETTER_AUTH_URL` (the production address) and the three Cloudinary keys.
4. From your machine, with the production database URL in your environment, run `pnpm db:deploy` to create the tables, then `pnpm db:seed` with the real admin's email and password.

Leave `DATABASE_POOL_MAX` and `SHADOW_DATABASE_URL` unset in production.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the app on port 3000 |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check |
| `pnpm db:local` | Starts the local database in the background |
| `pnpm db:migrate` | Applies migrations, or creates one after a schema change |
| `pnpm db:deploy` | Applies migrations in production |
| `pnpm db:seed` | Creates the first admin and the starting categories |
| `pnpm db:demo` | Adds sample data to an empty local database |
| `pnpm db:studio` | Opens Prisma Studio to browse the data |

## Where things are

- `prisma/schema.prisma` has the data model.
- `src/app/(app)/students` has the student list, registration, profile and edit screens.
- `src/app/(app)/admin` has the setup screens: branches, skills, categories, teachers, classes and staff accounts.
- `src/app/(app)/students/access.ts` decides which students and enrollments each staff member can see.
- `src/lib` holds auth, the signed-in user checks, date helpers (dates follow East Africa Time) and formatting.
