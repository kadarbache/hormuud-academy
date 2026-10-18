@AGENTS.md

# Hormuud Academy

- Read CONTEXT.md before naming anything. The college says "class" for a room, but the app doesn't keep rooms: a class time is a skill, a name, hours, days and a teacher. A class is never a group of students.
- Verify with `pnpm lint` and `pnpm build`, not only `pnpm typecheck`. A `"use server"` file may export only async functions, and only the build catches a violation.
- The local database is `prisma dev` (`pnpm db:local`). It takes one connection at a time, so keep `DATABASE_POOL_MAX=1` locally, and `prisma migrate dev` needs `SHADOW_DATABASE_URL` (port 51215).
- Never commit `.env`. `.env.example` is the committed placeholder.
