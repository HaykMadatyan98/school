# School 78 — Yerevan

Portal for **Yerevan Basic School No. 78 after Hayrapet Hayrapetyan**.

Stack: **NestJS** + **Next.js** + **Prisma** + **MongoDB**.

## Features

- Armenian-first public site (EN/RU available in CMS)
- CMS pages for school sections (`/p/...`)
- Nested menu — editable in admin
- Staff cards, document links, site search
- Admin: JWT auth, pages, menu, posts, categories, users

## Quick start

```bash
npm run db:up
npm run db:setup
# clean mock content for visual review (recommended now)
npm run seed:mock -w api
npm run dev:api   # :3001
npm run dev:web   # :3000
```

- Site: http://localhost:3000
- Admin: http://localhost:3000/admin
- Swagger: http://localhost:3001/api/docs
- Login: `admin@school.local` / `admin123`

At this stage the site uses **mock data** (no blog posts yet, logo-only imagery).

## Contacts

- Address: 57/2 Marshal Baghramyan Ave., Yerevan
- Phone: +374 10 225836
- Email: school78@schools.am
