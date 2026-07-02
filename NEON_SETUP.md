# Neon Database Setup

This project now uses Prisma with PostgreSQL, which works with Neon.

1. Create a Neon project.
2. Copy the pooled connection string from Neon.
3. Put it in `backend/.env` for local development:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require"
```

4. Put the same `DATABASE_URL` in Vercel project environment variables.
5. Push the Prisma schema to Neon:

```bash
npm run db:push
```

6. Redeploy on Vercel.

Do not use `localhost` in Vercel environment variables.
