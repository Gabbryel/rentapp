This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## New features

- Contracts list filtering by upcoming rent indexing dates: 15 or 60 days (toggle above the list)
- Basic authentication: register and login with email/password (MongoDB-backed sessions)
- Email alarm endpoint for upcoming indexings: `/api/cron/indexing?range=15|60`

### Environment variables

Add these to `.env.local` (Mongo is required for auth and email recipients; SMTP is optional in dev):

```bash
MONGODB_URI="mongodb://localhost:27017"
MONGODB_DB="rentapp"

# Optional SMTP for sending emails; if missing, emails are logged to console
SMTP_HOST="smtp.yourhost.com"
SMTP_PORT="587"
SMTP_USER="smtp-user"
SMTP_PASS="smtp-pass"
SMTP_FROM="noreply@yourdomain.com"
```

### Seeding and users

- Seed contracts: `npm run db:seed:mongo`
- Register a user at `/register`, then login at `/login`

### Trigger email alarms

- Manually: open `/api/cron/indexing?range=15` or `?range=60`
- Scheduling (Vercel): add to `vercel.json` crons, e.g.

```json
{
	"crons": [
		{ "path": "/api/cron/indexing?range=15", "schedule": "0 7 * * *" },
		{ "path": "/api/cron/indexing?range=60", "schedule": "0 7 * * 1" }
	]
}
```

Notes: Passwords are hashed (sha256+salt) for demo purposes. For production, switch to bcrypt or argon2 and enforce HTTPS.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
