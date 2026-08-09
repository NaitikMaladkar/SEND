# SEND — Webmail on Vercel

A Gmail-inspired webmail application that gives you `username@send.dedyn.io` email addresses.
Built with **Next.js**, deployed on **Vercel**, powered by **Supabase** (auth + database), **Resend** (sending), and **Mailgun** (receiving).

No mail server required. No VPS needed. Everything runs on serverless.

---

## Architecture

```
Someone sends email
        │
        ▼
  DNS MX record
  (deSEC)
        │
        ▼
  Mailgun receives
  the email
        │
        ▼  (webhook POST)
  Vercel /api/receive
        │
        ▼
  Supabase database
  (stores the email)
        │
        ▼
  User opens inbox
  (Next.js on Vercel)


User composes email
        │
        ▼
  Vercel /api/emails
        │
        ▼
  Resend API
  (sends the email)
        │
        ▼
  Recipient's inbox
```

---

## Prerequisites — Free Accounts Needed

You need to create **four** free accounts:

| Service | Purpose | URL | Free Tier |
|---------|---------|-----|----------|
| **Supabase** | Database + User Auth | https://supabase.com | 500MB DB, 50K auth users |
| **Resend** | Sending emails | https://resend.com | 100 emails/day, 3,000/month |
| **Mailgun** | Receiving emails via webhook | https://mailgun.com | 1,000 incoming emails/month |
| **Vercel** | Hosting the website | https://vercel.com | 100GB bandwidth |
| **deSEC** | DNS for send.dedyn.io | https://desec.io | Free DNS hosting |

---

## Step-by-Step Setup

### Step 1: Supabase Setup

1. Go to https://supabase.com and sign in (GitHub login works).
2. Click **"New Project"**.
3. Fill in:
   - **Name**: `send-webmail`
   - **Database Password**: Generate a strong password and **save it**.
   - **Region**: Choose closest to your users.
4. Wait for the project to be created.

#### 1a. Get your API keys

Go to **Settings → API** and note down:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** secret → `SUPABASE_SERVICE_ROLE_KEY`

#### 1b. Disable email confirmation

Go to **Authentication → Providers → Email** and:
- Turn **OFF** "Confirm email"
- Turn **OFF** "Secure email change"

This lets users log in immediately after registering.

#### 1c. Create the database tables

Go to **SQL Editor** and paste the entire contents of `supabase/schema.sql`, then click **Run**.

This creates:
- `profiles` table (linked to Supabase Auth users)
- `emails` table (inbox, sent, trash)
- `contacts` table (address book)
- Row Level Security policies (users can only see their own data)
- A trigger that auto-creates a profile when a user signs up

---

### Step 2: Resend Setup (Sending Emails)

1. Go to https://resend.com and sign in.
2. Go to **Domains** → **Add Domain**.
3. Enter: `send.dedyn.io`
4. Resend will show you **4 DNS records** to add. **Don't add them yet** — we'll add all DNS records together in Step 5.

You'll need from Resend:
- **API Key**: Go to **API Keys** → Create API Key → copy it → `RESEND_API_KEY`
- **DNS records**: From the domain verification page (SPF, DKIM CNAME records)

---

### Step 3: Mailgun Setup (Receiving Emails)

1. Go to https://mailgun.com and sign up.
2. Add a domain: `send.dedyn.io`
3. Select the free plan (Flex).
4. Mailgun will show you **DNS records** to add. **Don't add them yet** — we'll add all DNS records together in Step 5.
5. Note down:
   - **Signing Key**: Go to your domain settings → Webhooks → note the **Signing Key** → `MAILGUN_WEBHOOK_SIGNING_KEY`

#### 3a. Configure the Mailgun webhook

After deploying to Vercel (Step 6), come back here:

1. In Mailgun, go to your domain → **Receiving**.
2. Set the route:
   - **Match Recipient**: `*@send.dedyn.io`
   - **Forward To**: `https://send.dedyn.io/api/receive`
   - **Priority**: 0
   - **Description**: `Forward to SEND webapp`
3. Make sure the route is **Active**.

> **Important**: If you haven't deployed yet, use your Vercel URL (`https://your-project.vercel.app/api/receive`) first, then update it after adding the custom domain.

---

### Step 4: Vercel Setup

#### 4a. Deploy

1. Push this repo to GitHub.
2. Go to https://vercel.com → **Add New Project** → Import the `SEND` repo.
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `.` (default)
   - Don't build yet — add environment variables first.

#### 4b. Environment Variables

In Vercel → your project → **Settings → Environment Variables**, add ALL of these:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `RESEND_API_KEY` | Your Resend API key (`re_...`) |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | Your Mailgun signing key |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL (e.g. `https://send.vercel.app`) |
| `NEXT_PUBLIC_MAIL_DOMAIN` | `send.dedyn.io` |

#### 4c. Deploy

Click **Deploy**. Wait for it to finish.

#### 4d. Add Custom Domain

1. In Vercel → your project → **Settings → Domains**.
2. Add: `send.dedyn.io`
3. Vercel will show you DNS records to add. **We'll add them in Step 5.**

---

### Step 5: deSEC DNS Setup (All Records at Once)

Now go to https://desec.io and log in to manage your `send.dedyn.io` zone.

Add the following records in the deSEC dashboard (or via API). Replace placeholder values with the ones shown in your Resend, Mailgun, and Vercel dashboards.

#### A Records (Vercel)

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `76.76.21.21` | 3600 |

> `76.76.21.21` is Vercel's default IP. If Vercel shows a different IP or asks for a CNAME, use that instead.

#### MX Records (Mailgun — for receiving email)

| Type | Name | Value | Priority |
|------|------|-------|----------|
| MX | `@` | `mxa.mailgun.org` | 10 |
| MX | `@` | `mxb.mailgun.org` | 10 |

#### TXT Records (SPF + Resend verification)

| Type | Name | Value |
|------|------|-------|
| TXT | `@` | `v=spf1 include:mg.send.dedyn.io include:resend.com ~all` |

> The `mg.send.dedyn.io` part is shown in Mailgun's DNS setup page. The `include:resend.com` part enables Resend to send on your behalf.

#### TXT Record (Mailgun domain verification)

| Type | Name | Value |
|------|------|-------|
| TXT | `mg` | (value from Mailgun's DNS page — looks like `v=spf1 include:mailgun.org ~all`) |

#### CNAME Records (DKIM — Resend + Mailgun)

Add these CNAME records exactly as shown in your **Resend** domain verification page and **Mailgun** DNS page:

**For Resend (sending verification):**

| Type | Name | Value |
|------|------|-------|
| CNAME | `resend._domainkey` | (value from Resend — like `customdomain.dkim.resend.com`) |

**For Mailgun (receiving verification):**

| Type | Name | Value |
|------|------|-------|
| CNAME | `email` | `mailgun.org` |
| CNAME | `mx._domainkey.mg` | (value from Mailgun's DKIM CNAME) |

#### DMARC Record

| Type | Name | Value |
|------|------|-------|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:postmaster@send.dedyn.io` |

#### Summary Checklist

- [ ] A record `@` → Vercel IP
- [ ] MX records `@` → Mailgun
- [ ] TXT `@` → SPF (Mailgun + Resend)
- [ ] TXT `mg` → Mailgun verification
- [ ] CNAME `resend._domainkey` → Resend DKIM
- [ ] CNAME `email` → mailgun.org
- [ ] CNAME `mx._domainkey.mg` → Mailgun DKIM
- [ ] TXT `_dmarc` → DMARC policy

After adding all records, wait 5-30 minutes for DNS propagation. Then:
- Go to **Resend** → Domains → click **Verify DNS**
- Go to **Mailgun** → Domains → it should auto-verify
- Go to **Vercel** → Domains → it should auto-verify

---

### Step 6: Final Configuration

1. **Update Mailgun Webhook URL**: Now that your custom domain is live, update the Mailgun receiving route to point to `https://send.dedyn.io/api/receive` (replace with your actual domain if different).

2. **Update Vercel env var**: Set `NEXT_PUBLIC_APP_URL` to `https://send.dedyn.io` in Vercel settings, then redeploy.

3. **Test the full flow**:
   - Open `https://send.dedyn.io`
   - Register a new account (e.g. username `alice`)
   - Log in
   - Compose an email to an external address (your personal Gmail)
   - Check your Gmail — you should receive it from `alice@send.dedyn.io`
   - Reply to that email (or send from Gmail to `alice@send.dedyn.io`)
   - Refresh your SEND inbox — the reply should appear

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (for webhook) |
| `RESEND_API_KEY` | Yes | Resend API key |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | Yes | Mailgun webhook signing key |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of your app |
| `NEXT_PUBLIC_MAIL_DOMAIN` | Yes | Your email domain (`send.dedyn.io`) |

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Register a new user |
| POST | `/api/auth/logout` | Yes | Log out |
| GET | `/api/emails?folder=inbox` | Yes | List emails (inbox/sent/trash) |
| POST | `/api/emails` | Yes | Send an email |
| PATCH | `/api/emails/[id]` | Yes | Mark read/unread, trash, restore |
| DELETE | `/api/emails/[id]` | Yes | Permanently delete (from trash) |
| POST | `/api/receive` | Mailgun | Webhook for incoming emails |
| GET | `/api/contacts` | Yes | List contacts |
| POST | `/api/contacts` | Yes | Add a contact |
| DELETE | `/api/contacts/[id]` | Yes | Delete a contact |

---

## Features

- **User Registration** — anyone can create `username@send.dedyn.io`
- **Send Email** — to any address worldwide (via Resend)
- **Receive Email** — from anyone worldwide (via Mailgun webhook)
- **Inbox / Sent / Trash** — folder-based email management
- **Address Book** — save and manage contacts
- **Mobile Responsive** — works on phones, tablets, and desktops
- **Real-time UI** — compose modal, reading pane, reply, trash/restore
- **Secure** — JWT auth, Row Level Security, webhook signature verification

---

## Project Structure

```
.
├── app/
│   ├── layout.js               # Root layout
│   ├── page.js                 # Redirect to /login
│   ├── globals.css             # Tailwind + custom styles
│   ├── login/page.js           # Login page
│   ├── register/page.js        # Registration page
│   ├── inbox/page.js           # Main webmail interface
│   └── api/
│       ├── auth/
│       │   ├── register/route.js
│       │   └── logout/route.js
│       ├── emails/
│       │   ├── route.js         # GET list, POST send
│       │   └── [id]/route.js    # PATCH, DELETE
│       ├── receive/route.js    # Mailgun webhook
│       └── contacts/
│           ├── route.js         # GET, POST
│           └── [id]/route.js    # DELETE
├── components/
│   ├── ComposeModal.js
│   └── AddressBookModal.js
├── lib/
│   ├── supabase/
│   │   ├── client.js           # Browser Supabase client
│   │   └── server.js           # Server Supabase client + auth helper
│   ├── resend.js               # Resend email client
│   └── utils.js                # Helpers (DNS, HTML stripping, signature verify)
├── supabase/
│   └── schema.sql              # Database schema (run in Supabase SQL Editor)
├── middleware.js                # Next.js middleware (auth, session refresh)
├── jsconfig.json                # Path aliases
├── package.json
├── next.config.js
├── postcss.config.js
├── .env.example
└── README.md
```

---

## How Email Receiving Works

1. Someone sends an email to `alice@send.dedyn.io`.
2. DNS MX records route it to Mailgun's servers.
3. Mailgun receives the email, parses it, and sends a webhook POST to `https://send.dedyn.io/api/receive`.
4. The `/api/receive` endpoint verifies the Mailgun signature (HMAC-SHA256) to prevent spoofing.
5. It extracts the recipient username (`alice`), looks up the user in the Supabase `profiles` table.
6. If the user exists, the email is stored in the `emails` table with `folder='inbox'`.
7. When Alice opens her inbox, the email appears.

---

## How Email Sending Works

1. Alice composes an email in the web UI.
2. The frontend sends a POST to `/api/emails` with `{ to, subject, body }`.
3. The API route verifies Alice's auth (Supabase JWT), then calls the Resend API.
4. Resend sends the email from `alice@send.dedyn.io` to the recipient.
5. A copy is saved in Alice's "sent" folder in the database.
6. SPF, DKIM, and DMARC DNS records ensure the email passes spam checks.

---

## Troubleshooting

### Emails not arriving in inbox
- Check Mailgun logs: Mailgun dashboard → your domain → Logs
- Verify the webhook URL is correct and accessible
- Check Vercel function logs: Vercel dashboard → your project → Logs
- Ensure the MX records are properly set in deSEC

### Emails not sending / going to spam
- Verify Resend domain is verified (green checkmark)
- Check SPF, DKIM, DMARC records are all set
- Use https://www.mail-tester.com to test your spam score
- Check Resend dashboard → Logs for errors

### DNS not propagating
- DNS changes can take 5 minutes to 48 hours
- Use `dig send.dedyn.io MX` or https://mxtoolbox.com to check
- deSEC usually propagates quickly (within minutes)

### Registration fails
- Ensure email confirmation is disabled in Supabase
- Check the `profiles` table and trigger exist (re-run schema.sql)
- Check Supabase logs: Dashboard → Auth → Logs

### Vercel deployment fails
- Ensure all environment variables are set
- Check the build logs in Vercel dashboard
- Ensure `node_modules` is in `.gitignore`

### Webhook returns 401
- Ensure `MAILGUN_WEBHOOK_SIGNING_KEY` is set in Vercel env vars
- The signing key changes if you regenerate it in Mailgun

---

## Security

- **Authentication**: Supabase Auth with JWT tokens, refreshed via middleware
- **Authorization**: Row Level Security (RLS) ensures users only see their own data
- **Webhook Security**: Mailgun HMAC-SHA256 signature verification on `/api/receive`
- **No passwords in browser**: Supabase handles auth server-side
- **No raw HTML in emails**: All email HTML is stripped to plain text before rendering
- **Input validation**: All API inputs are validated and sanitized

---

## Limitations (Free Tier)

| Service | Limit |
|---------|-------|
| Vercel | 100GB bandwidth, 10s serverless timeout (60s Pro) |
| Supabase | 500MB database, 50K monthly active users |
| Resend | 100 emails/day, 3,000/month |
| Mailgun | 1,000 incoming emails/month |

For production use, consider upgrading to paid plans.

---

## License

MIT