@AGENTS.md

# College System

- Read CONTEXT.md before naming anything. The screens say "Class" for a room; the code calls it `Classroom` so it can't be mistaken for a group of students.
- Verify with `pnpm lint` and `pnpm build`, not only `pnpm typecheck`. A `"use server"` file may export only async functions, and only the build catches a violation.
- The local database is `prisma dev` (`pnpm db:local`). It takes one connection at a time, so keep `DATABASE_POOL_MAX=1` locally, and `prisma migrate dev` needs `SHADOW_DATABASE_URL` (port 51215).
- Never commit `.env`. `.env.example` is the committed placeholder.
