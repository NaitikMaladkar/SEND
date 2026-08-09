import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

function getImapConfig() {
  return {
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT) || 143,
    secure: process.env.IMAP_TLS === 'true',
    logger: false,
  };
}

function getSmtpConfig(overrides = {}) {
  const authEnabled = process.env.SMTP_AUTH_ENABLED === 'true';
  const config = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_TLS === 'true',
    ...overrides,
  };

  if (authEnabled && process.env.SMTP_USER && process.env.SMTP_PASS) {
    config.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    };
  }

  return config;
}

/**
 * Authenticate against IMAP to verify credentials.
 * Returns true on success, throws on failure.
 */
export async function verifyImapCredentials(email, password) {
  const client = new ImapFlow({
    ...getImapConfig(),
    user: email,
    pass: password,
  });
  try {
    await client.connect();
    return true;
  } finally {
    await client.logout().catch(() => {});
  }
}

/**
 * Fetch all messages from the INBOX.
 * Returns an array of email objects sorted newest-first.
 */
export async function fetchInbox(email, password) {
  const client = new ImapFlow({
    ...getImapConfig(),
    user: email,
    pass: password,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const totalMessages = client.mailbox.exists;
      if (!totalMessages || totalMessages === 0) {
        return [];
      }

      // Fetch the last 100 messages by UID
      const lastUid = client.mailbox.uidNext - 1;
      const startUid = Math.max(1, lastUid - 99);
      const range = `${startUid}:${lastUid}`;

      const messages = [];

      for await (const message of client.fetch(range, {
        envelope: true,
        flags: true,
        source: {
          start: 0,
          end: 0,
        },
      })) {
        const envelope = message.envelope;
        const from = envelope.from[0];
        const sender = from
          ? `${from.name ? from.name + ' ' : ''}<${from.address}>`.trim()
          : 'Unknown Sender';

        const subject = envelope.subject || '(No Subject)';
        const date = envelope.date;

        // Parse plain-text body from the raw source
        let body = '';
        if (message.source && message.source.size > 0) {
          const raw = message.source.toString('utf-8');
          body = extractPlainText(raw);
        }

        messages.push({
          id: String(message.uid),
          sender,
          subject,
          date: date instanceof Date ? date.toISOString() : new Date(date).toISOString(),
          body,
          flags: message.flags || [],
        });
      }

      // Sort newest first by date
      messages.sort((a, b) => new Date(b.date) - new Date(a.date));
      return messages;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

/**
 * Fetch a single email by UID.
 */
export async function fetchEmailByUid(email, password, uid) {
  const client = new ImapFlow({
    ...getImapConfig(),
    user: email,
    pass: password,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const message = await client.fetchOne(uid, {
        envelope: true,
        flags: true,
        source: true,
      });

      if (!message) return null;

      const from = message.envelope.from[0];
      const sender = from
        ? `${from.name ? from.name + ' ' : ''}<${from.address}>`.trim()
        : 'Unknown Sender';

      const subject = message.envelope.subject || '(No Subject)';
      const date = message.envelope.date;

      let body = '';
      if (message.source && message.source.size > 0) {
        const raw = message.source.toString('utf-8');
        body = extractPlainText(raw);
      }

      return {
        id: String(message.uid),
        sender,
        subject,
        date: date instanceof Date ? date.toISOString() : new Date(date).toISOString(),
        body,
        flags: message.flags || [],
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

/**
 * Extract plain text from a raw MIME message.
 */
function extractPlainText(raw) {
  // Find boundary for multipart messages
  const boundaryMatch = raw.match(
    /Content-Type:\s*multipart\/[^;]+;\s*boundary="?([^"]+)"?/i
  );

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = splitMimeParts(raw, boundary);

    // Prefer text/plain
    for (const part of parts) {
      if (part.headers['content-type']?.match(/text\//i)) {
        if (
          part.headers['content-type']?.match(/text\/plain/i)
        ) {
          return decodeBody(part.body, part.headers['content-transfer-encoding']);
        }
      }
    }

    // Fallback: strip HTML from text/html part
    for (const part of parts) {
      if (part.headers['content-type']?.match(/text\/html/i)) {
        const html = decodeBody(
          part.body,
          part.headers['content-transfer-encoding']
        );
        return stripHtml(html);
      }
    }

    return '';
  }

  // Non-multipart: determine content type from headers
  const headerEnd = raw.indexOf('\r\n\r\n');
  if (headerEnd === -1) return raw.trim();

  const headersRaw = raw.substring(0, headerEnd);
  const body = raw.substring(headerEnd + 4);
  const contentType = getHeaderValue(headersRaw, 'content-type') || '';
  const encoding = getHeaderValue(headersRaw, 'content-transfer-encoding');

  if (contentType.match(/text\/html/i)) {
    return stripHtml(decodeBody(body, encoding));
  }

  return decodeBody(body, encoding).trim();
}

/**
 * Split raw MIME text into parts using the boundary.
 */
function splitMimeParts(raw, boundary) {
  const parts = [];
  const delimiter = `--${boundary}`;
  const segments = raw.split(delimiter);

  // segments[0] is the preamble (before first boundary), skip it
  // segments[last] is the epilogue (after closing boundary), skip it
  for (let i = 1; i < segments.length - 1; i++) {
    const segment = segments[i].replace(/^\r\n/, '').replace(/\r\n$/, '');
    const partHeaderEnd = segment.indexOf('\r\n\r\n');
    if (partHeaderEnd === -1) continue;

    const partHeadersRaw = segment.substring(0, partHeaderEnd);
    const partBody = segment.substring(partHeaderEnd + 4);

    const headers = {};
    const headerLines = partHeadersRaw.split('\r\n');
    for (const line of headerLines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.substring(0, colonIdx).trim().toLowerCase();
      const value = line.substring(colonIdx + 1).trim();
      headers[key] = headers[key]
        ? `${headers[key]}, ${value}`
        : value;
    }

    parts.push({ headers, body: partBody });
  }

  return parts;
}

/**
 * Decode a body based on its transfer encoding.
 */
function decodeBody(body, encoding) {
  if (!encoding) return body;

  switch (encoding.trim().toLowerCase()) {
    case 'quoted-printable':
      return decodeQuotedPrintable(body);
    case 'base64':
      return decodeBase64(body);
    default:
      return body;
  }
}

function decodeQuotedPrintable(str) {
  return str
    .replace(/=\r\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

function decodeBase64(str) {
  try {
    return Buffer.from(str.replace(/\s/g, ''), 'base64').toString('utf-8');
  } catch {
    return str;
  }
}

function getHeaderValue(headersRaw, name) {
  const match = headersRaw.match(
    new RegExp(`^${name}:\s*(.+)$`, 'mi')
  );
  return match ? match[1].trim() : null;
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?\>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n  * ')
    .replace(/<hr[^>]*>/gi, '\n---\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Send an email via SMTP.
 */
export async function sendEmail(from, to, subject, body) {
  const transporter = nodemailer.createTransport(getSmtpConfig());

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text: body,
  });

  return info;
}
