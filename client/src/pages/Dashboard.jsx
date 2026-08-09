import { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Plus,
  LogOut,
  RefreshCw,
  Send,
  X,
  Loader2,
  Inbox,
  Menu,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { fetchInbox, sendEmail, logout } from '../api';

const MAIL_DOMAIN = import.meta.env.VITE_MAIL_DOMAIN || 'send.dedyn.io';

export default function Dashboard({ email, onLogout }) {
  const [emails, setEmails] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeError, setComposeError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const messages = await fetchInbox();
      setEmails(messages);
    } catch (err) {
      const msg =
        err.response?.data?.error || 'Failed to load inbox.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  async function handleLogout() {
    await logout();
    onLogout();
  }

  function openCompose() {
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setComposeError('');
    setSendSuccess(false);
    setComposeOpen(true);
  }

  function closeCompose() {
    setComposeOpen(false);
  }

  async function handleSend(e) {
    e.preventDefault();
    setComposeError('');
    setSendSuccess(false);

    const to = composeTo.trim();
    const subject = composeSubject.trim();
    const body = composeBody.trim();

    if (!to) {
      setComposeError('Recipient is required.');
      return;
    }
    if (to.includes('@')) {
      setComposeError('Enter only the username. The domain is added automatically.');
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(to)) {
      setComposeError(
        'Invalid username. Use only letters, numbers, dots, hyphens, and underscores.'
      );
      return;
    }
    if (!subject) {
      setComposeError('Subject is required.');
      return;
    }
    if (!body) {
      setComposeError('Message body is required.');
      return;
    }

    setSending(true);
    try {
      await sendEmail(to, subject, body);
      setSendSuccess(true);
      setTimeout(() => {
        closeCompose();
      }, 1200);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to send email.';
      setComposeError(msg);
    } finally {
      setSending(false);
    }
  }

  const selectedEmail = emails.find((m) => m.id === selectedId) || null;

  function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
  }

  function formatFullDate(isoString) {
    return new Date(isoString).toLocaleString([], {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getPreview(body) {
    if (!body) return '';
    const line = body.split('\n')[0];
    return line.length > 100 ? line.substring(0, 100) + '...' : line;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-gray-200 bg-white transition-transform lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Mail className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-gray-900">SEND</span>
        </div>

        {/* Compose Button */}
        <div className="p-4">
          <button
            onClick={openCompose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Compose
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3">
          <button
            onClick={() => {
              setSelectedId(null);
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              !selectedId
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Inbox className="h-4 w-4" />
            Inbox
            {emails.length > 0 && (
              <span className="ml-auto text-xs font-medium text-gray-500">
                {emails.length}
              </span>
            )}
          </button>
        </nav>

        {/* User Info + Logout */}
        <div className="border-t border-gray-200 p-4">
          <p className="mb-3 truncate text-xs text-gray-500" title={email}>
            {email}
          </p>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col min-w-0">
        {/* Top Bar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          <button
            onClick={loadInbox}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </header>

        {/* Content Area */}
        <div className="flex flex-1 min-h-0">
          {/* Email List */}
          <div
            className={`
              w-full border-r border-gray-200 bg-white sm:w-96 lg:w-[420px] shrink-0
              ${selectedEmail ? 'hidden sm:block' : 'block'}
            `}
          >
            {loading && (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading messages...
              </div>
            )}

            {error && !loading && (
              <div className="flex flex-col items-center justify-center gap-4 py-20 px-6">
                <AlertCircle className="h-10 w-10 text-red-400" />
                <p className="text-sm text-red-600 text-center">{error}</p>
                <button
                  onClick={loadInbox}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && emails.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-6">
                <Inbox className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">Your inbox is empty.</p>
              </div>
            )}

            {!loading && !error && emails.length > 0 && (
              <div className="email-list h-full overflow-y-auto">
                {emails.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => setSelectedId(msg.id)}
                    className={`
                      w-full text-left px-4 py-3 border-b border-gray-100 transition-colors
                      ${
                        selectedId === msg.id
                          ? 'bg-indigo-50 border-l-2 border-l-indigo-600'
                          : 'hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm truncate ${
                          selectedId === msg.id
                            ? 'font-semibold text-gray-900'
                            : 'font-medium text-gray-800'
                        }`}
                      >
                        {msg.sender}
                      </p>
                      <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                        {formatDate(msg.date)}
                      </span>
                    </div>
                    <p
                      className={`text-sm truncate mt-0.5 ${
                        selectedId === msg.id
                          ? 'font-medium text-gray-900'
                          : 'text-gray-700'
                      }`}
                    >
                      {msg.subject}
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {getPreview(msg.body)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reading Pane */}
          <div
            className={`
              flex-1 bg-white overflow-y-auto
              ${selectedEmail ? 'block' : 'hidden sm:flex'}
              ${!selectedEmail ? 'items-center justify-center' : ''}
            `}
          >
            {selectedEmail ? (
              <div className="p-6">
                {/* Back button (mobile) */}
                <button
                  onClick={() => setSelectedId(null)}
                  className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 sm:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to inbox
                </button>

                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedEmail.subject}
                </h2>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                  <span>
                    <span className="font-medium text-gray-700">From:</span>{' '}
                    {selectedEmail.sender}
                  </span>
                  <span>{formatFullDate(selectedEmail.date)}</span>
                </div>

                <hr className="my-5 border-gray-200" />

                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {selectedEmail.body || 'No content.'}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400">
                <Mail className="h-12 w-12 mb-3" />
                <p className="text-sm">Select a message to read</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Compose Modal */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeCompose}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                New Message
              </h3>
              <button
                onClick={closeCompose}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSend} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto">
                {/* To field with hardcoded domain suffix */}
                <div className="flex items-center border-b border-gray-200">
                  <label
                    htmlFor="compose-to"
                    className="px-5 py-3 text-sm font-medium text-gray-500 shrink-0"
                  >
                    To
                  </label>
                  <div className="flex flex-1 items-center py-3 pr-5">
                    <input
                      id="compose-to"
                      type="text"
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      placeholder="username"
                      autoComplete="off"
                      className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                    <span className="text-sm text-gray-400 shrink-0">
                      @{MAIL_DOMAIN}
                    </span>
                  </div>
                </div>

                {/* Subject */}
                <div className="border-b border-gray-200">
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Subject"
                    className="w-full px-5 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  />
                </div>

                {/* Body */}
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your message..."
                  rows={8}
                  className="w-full resize-none px-5 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                />
              </div>

              {/* Error / Success */}
              {composeError && (
                <div className="mx-5 mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {composeError}
                </div>
              )}
              {sendSuccess && (
                <div className="mx-5 mt-3 rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-700">
                  Email sent successfully!
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sending ? 'Sending...' : 'Send'}
                </button>
                <button
                  type="button"
                  onClick={closeCompose}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Discard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
