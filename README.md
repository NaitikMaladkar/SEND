# SEND — Webmail Application

A Gmail-inspired webmail application with a React frontend and Node.js/Express backend. Connects to an existing local Docker Mailserver (Postfix + Dovecot) for sending and receiving email.

## Architecture Overview

```
┌─────────────┐      HTTP/REST       ┌──────────────────┐      IMAP (143)      ┌───────────┐
│   Browser   │ ◄──────────────────► │   Express API    │ ◄──────────────────► │  Dovecot  │
│  (React)    │   Axios + JWT Bearer │   (Node.js)      │                      │   (IMAP)  │
└─────────────┘                      └──────────────────┘                      └───────────┘
                                             │
                                             │  SMTP (587)
                                             ▼
                                      ┌───────────┐
                                      │  Postfix  │
                                      │  (SMTP)   │
                                      └───────────┘
```

**Key principle:** The browser never handles email credentials directly. All IMAP/SMTP operations happen server-side.

## Requirements

- **Node.js** 18 or later
- **npm** 9 or later
- A running **Docker Mailserver** instance with:
  - Postfix (SMTP) on `127.0.0.1:587`
  - Dovecot (IMAP) on `127.0.0.1:143`
  - At least one user account (e.g. `john@send.dedyn.io`)

## Docker Mailserver Assumptions

This application is designed to work with [docker-mailserver](https://github.com/docker-mailserver/docker-mailserver) (DMS). It assumes:

- IMAP is available on port 143 (plain or STARTTLS)
- SMTP is available on port 587
- User accounts are managed by the mail server (not by this application)
- The mail domain is `send.dedyn.io` (configurable via `MAIL_DOMAIN`)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/SEND.git
cd SEND
```

### 2. Backend setup

```bash
cd server
cp .env.example .env
# Edit .env — set JWT_SECRET to a long random string
npm install
```

### 3. Frontend setup

```bash
cd ../client
cp .env.example .env
npm install
```

### 4. Start both servers

Terminal 1 — Backend:
```bash
cd server
npm run dev
```

Terminal 2 — Frontend:
```bash
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Environment Variables

### Server (`server/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP port for the API server | `5000` |
| `CLIENT_URL` | Allowed CORS origin (frontend URL) | `http://localhost:5173` |
| `JWT_SECRET` | Secret for signing JWTs (REQUIRED — use a long random string) | — |
| `JWT_EXPIRES_IN` | JWT expiration time | `1h` |
| `IMAP_HOST` | IMAP server hostname | `127.0.0.1` |
| `IMAP_PORT` | IMAP server port | `143` |
| `IMAP_TLS` | Use TLS for IMAP connection (`true`/`false`) | `false` |
| `SMTP_HOST` | SMTP server hostname | `127.0.0.1` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_TLS` | Use TLS for SMTP connection (`true`/`false`) | `false` |
| `SMTP_AUTH_ENABLED` | Enable SMTP authentication | `false` |
| `SMTP_USER` | SMTP username (if auth enabled) | — |
| `SMTP_PASS` | SMTP password (if auth enabled) | — |
| `MAIL_DOMAIN` | The email domain for all users | `send.dedyn.io` |
| `SESSION_TTL_MS` | Server-side session lifetime in ms | `1800000` (30 min) |
| `SESSION_CLEANUP_INTERVAL_MS` | Session cleanup interval in ms | `300000` (5 min) |

### Client (`client/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:5000/api` |
| `VITE_MAIL_DOMAIN` | Mail domain shown in the compose UI | `send.dedyn.io` |

## How Authentication Works

1. The user submits their email and password to `POST /api/auth/login`.
2. The backend attempts an IMAP login against Dovecot using `imapflow`.
3. If IMAP authentication succeeds:
   - A **server-side session** is created (an in-memory `Map` keyed by a random 32-byte hex ID). This session stores the user's email and password temporarily.
   - A **JWT** is issued containing `{ email, sessionId }`. **The password is never included in the JWT or sent back to the browser.**
4. The browser stores only the JWT in `localStorage`.
5. Subsequent API requests include the JWT as a `Bearer` token.
6. The `authMiddleware` verifies the JWT and checks that the server-side session still exists.
7. When the backend needs to access IMAP (e.g. to fetch the inbox), it retrieves the credentials from the server-side session using the `sessionId` from the JWT.

### Why Not Store the Password in the JWT?

Placing a plaintext password inside a JWT is a serious security risk. JWTs are base64-encoded (not encrypted) and can be decoded by anyone who intercepts them. Even if stored in `httpOnly` cookies, the password would be present in server-side logs, debug output, and token inspection tools.

Instead, SEND uses a short-lived server-side session store:

- The password is held only in Node.js memory (never persisted to disk, never sent to the browser).
- Sessions expire after 30 minutes of inactivity (configurable).
- A background cleanup task purges expired sessions every 5 minutes.
- When a session expires, the user must re-authenticate (re-enter their password).

This design means that even if a JWT is stolen, the attacker cannot access the user's IMAP account once the server-side session expires.

## How IMAP Works

The backend uses [imapflow](https://github.com/postalsys/imapflow) to communicate with Dovecot:

- **Authentication:** `client.connect()` with the user's email and password.
- **Inbox access:** `client.getMailboxLock('INBOX')` to lock the mailbox, then `client.fetch()` to retrieve messages.
- **Message parsing:** Raw MIME source is parsed to extract plain-text content. HTML parts are stripped to plain text as a fallback. Quoted-printable and base64 transfer encodings are handled.
- **Connection cleanup:** Every IMAP client is logged out in a `finally` block to prevent connection leaks.

The browser never connects to the IMAP server directly.

## How SMTP Works

The backend uses [nodemailer](https://nodemailer.com/) to send emails through Postfix:

- A transporter is created per send request using the configured SMTP host and port.
- If `SMTP_AUTH_ENABLED=true`, SMTP authentication credentials are read from `SMTP_USER` and `SMTP_PASS`.
- The sender address is always derived from the authenticated JWT identity — never from the client request.
- The recipient is validated to ensure it belongs to `MAIL_DOMAIN` before sending.

## Internal-Only Sending Enforcement

SEND enforces a strict security policy: **users can only send email to addresses within the configured mail domain.**

This is enforced at multiple levels:

1. **Frontend UI:** The compose modal only accepts a username (e.g. `jane`) and appends `@send.dedyn.io` as a non-editable suffix.
2. **Frontend validation:** The React code rejects input containing `@` symbols or invalid characters.
3. **Backend validation (CRITICAL):** The email route:
   - Accepts either a bare username or a full email address.
   - If a full address is provided, parses it and validates the domain.
   - If a bare username is provided, appends `MAIL_DOMAIN`.
   - **Rejects any recipient whose domain does not match `MAIL_DOMAIN` with a `403 Forbidden` response.**
   - Uses proper email parsing rather than simple string matching.

The frontend validation is a convenience only. The backend is the authoritative enforcer.

## API Endpoints

### `GET /api/health`
Health check endpoint.

```bash
curl http://localhost:5000/api/health
# { "status": "ok" }
```

### `POST /api/auth/login`
Authenticate against Dovecot IMAP and receive a JWT.

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john@send.dedyn.io", "password": "yourpassword"}'
# { "token": "eyJhbG...", "user": { "email": "john@send.dedyn.io" } }
```

### `POST /api/auth/logout`
Invalidate the server-side session.

```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer <token>"
# { "message": "Logged out successfully." }
```

### `GET /api/emails/inbox`
Fetch all inbox messages. Requires authentication.

```bash
curl http://localhost:5000/api/emails/inbox \
  -H "Authorization: Bearer <token>"
# { "messages": [...] }
```

### `POST /api/emails/send`
Send an email to an internal recipient. Requires authentication.

```bash
curl -X POST http://localhost:5000/api/emails/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"to": "jane", "subject": "Hello", "body": "How are you?"}'
# { "message": "Email sent successfully" }
```

## Building the Frontend for Production

```bash
cd client
npm run build
```

The built files are output to `client/dist/`. Serve them with any static file server. You may need to configure your reverse proxy to handle client-side routing (fallback to `index.html` for non-file routes).

## Production Considerations

This application is designed for local development but is structured to be deployable:

- **HTTPS:** Use a reverse proxy (nginx, Caddy) to terminate TLS. Never expose HTTP or plain IMAP/SMTP directly to the internet.
- **CORS:** Set `CLIENT_URL` to your production frontend URL. Do not use `*`.
- **JWT Secret:** Use a cryptographically random secret (at least 64 characters). Rotate it periodically.
- **IMAP/SMTP TLS:** Set `IMAP_TLS=true` and/or `SMTP_TLS=true` if your mail server supports STARTTLS or implicit TLS.
- **SMTP Authentication:** If your Postfix requires authentication for sending, set `SMTP_AUTH_ENABLED=true` and provide `SMTP_USER`/`SMTP_PASS`.
- **Session Storage:** The in-memory session store does not survive server restarts. For production, consider replacing it with Redis.
- **Reverse Proxy:** Configure your proxy to forward `/api/*` to the Express server and serve the frontend static files for all other routes.
- **Rate Limiting:** The default limits (200 requests/15min, 20 login attempts/15min) should be adjusted based on your needs.
- **Logging:** The server logs minimal information. For production, integrate a structured logging library and ensure no credentials appear in logs.

## Security Considerations

- **Passwords are never stored** in any database, JWT, or browser storage.
- **Passwords are never logged.**
- **Passwords are never returned** to the client in any API response.
- **The sender address is derived from the JWT**, not from the client request body. The frontend cannot spoof the sender.
- **External recipients are rejected** by the backend with `403 Forbidden`, regardless of what the frontend sends.
- **JWT expiration** is set to 1 hour by default. Server-side sessions expire after 30 minutes of inactivity.
- **Helmet** adds security headers to all responses.
- **Rate limiting** protects against brute-force attacks on login and API abuse.
- **Input validation** is performed on all API endpoints.
- **Error responses** never contain stack traces, credentials, or internal details.
- **HTML email content** is stripped to plain text before being sent to the frontend. No raw HTML is rendered.

## Troubleshooting

### IMAP connection refused
- Verify Dovecot is running: `docker ps` or `systemctl status dovecot`
- Check IMAP port: `telnet 127.0.0.1 143`
- Verify `IMAP_HOST` and `IMAP_PORT` in `.env`

### SMTP connection refused
- Verify Postfix is running: `docker ps` or `systemctl status postfix`
- Check SMTP port: `telnet 127.0.0.1 587`
- Verify `SMTP_HOST` and `SMTP_PORT` in `.env`

### Login fails with "Invalid credentials"
- Test IMAP login manually: `openssl s_client -connect 127.0.0.1:143` then `a1 LOGIN john@send.dedyn.io password`
- Verify the user account exists in your mail server
- Ensure the email belongs to the configured `MAIL_DOMAIN`

### "Session expired" errors
- Server-side sessions expire after 30 minutes of inactivity (configurable via `SESSION_TTL_MS`)
- Restarting the Node.js server clears all sessions
- Log in again to create a new session

### CORS errors in the browser
- Verify `CLIENT_URL` in `server/.env` matches your frontend URL (e.g. `http://localhost:5173`)
- Ensure the Vite dev server is running on the expected port

### Emails not appearing in inbox
- Check that the sending server is delivering to the correct Dovecot instance
- Verify IMAP mailbox names match (the app uses `INBOX`)
- Check Dovecot logs for delivery errors

## Project Structure

```
webmail/
├── server/
│   ├── server.js            # Express entry point
│   ├── package.json
│   ├── .env.example
│   ├── .gitignore
│   ├── middleware/
│   │   └── auth.js          # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js          # Login / logout endpoints
│   │   └── emails.js        # Inbox / send endpoints
│   └── utils/
│       ├── mail.js           # IMAP & SMTP helpers
│       └── sessionStore.js   # In-memory session store
├── client/
│   ├── package.json
│   ├── .env.example
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx          # React entry point
│       ├── App.jsx           # Route definitions
│       ├── api.js            # Axios instance + API functions
│       ├── index.css         # Tailwind imports
│       └── pages/
│           ├── Login.jsx     # Login page
│           └── Dashboard.jsx # Inbox, reading pane, compose
└── README.md
```

## License

MIT