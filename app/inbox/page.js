'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import ComposeModal from '@/components/ComposeModal';
import AddressBookModal from '@/components/AddressBookModal';
import {
  Mail, Plus, LogOut, RefreshCw, Trash2, RotateCcw,
  Inbox, Send as SendIcon, BookUser, Menu, ArrowLeft,
  AlertCircle, Loader2, Search,
} from 'lucide-react';
import { getMailDomain } from '@/lib/utils';

const FOLDERS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'sent', label: 'Sent', icon: SendIcon },
  { id: 'trash', label: 'Trash', icon: Trash2 },
];

export default function InboxPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const mailDomain = getMailDomain();

  const [username, setUsername] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [emails, setEmails] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [folder, setFolder] = useState('inbox');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDefaultTo, setComposeDefaultTo] = useState('');
  const [contactsOpen, setContactsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Check auth
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, email')
        .eq('id', user.id)
        .single();
      if (profile) {
        setUsername(profile.username);
        setUserEmail(profile.email);
      }
    }
    checkAuth();
  }, [router, supabase]);

  // Load emails
  const loadEmails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/emails?folder=${folder}`);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load emails.');
        return;
      }
      setEmails(data.emails || []);
      const unread = (data.emails || []).filter((e) => !e.is_read && folder === 'inbox').length;
      setUnreadCount(unread);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }, [folder, router]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  // Listen for auth changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login');
      }
    });
    return () => subscription.unsubscribe();
  }, [router, supabase]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function markAsRead(id) {
    await fetch(`/api/emails/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'read' }),
    });
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, is_read: true } : e)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function moveToTrash(id) {
    await fetch(`/api/emails/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trash' }),
    });
    setEmails((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  async function restoreEmail(id) {
    await fetch(`/api/emails/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore' }),
    });
    setEmails((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  async function deletePermanently(id) {
    await fetch(`/api/emails/${id}`, { method: 'DELETE' });
    setEmails((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function openCompose(toEmail) {
    setComposeDefaultTo(toEmail || '');
    setComposeOpen(true);
  }

  function handleContactSelect(email) {
    setComposeDefaultTo(email);
    setComposeOpen(true);
  }

  function switchFolder(newFolder) {
    setFolder(newFolder);
    setSelectedId(null);
    setSidebarOpen(false);
  }

  const selectedEmail = emails.find((m) => m.id === selectedId) || null;

  function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function formatFullDate(iso) {
    return new Date(iso).toLocaleString([], {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function getPreview(text) {
    if (!text) return '';
    const line = text.split('\n')[0];
    return line.length > 100 ? line.substring(0, 100) + '...' : line;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-gray-200 bg-white transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Mail className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-gray-900">SEND</span>
        </div>

        <div className="p-4">
          <button onClick={() => openCompose()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors">
            <Plus className="h-4 w-4" /> Compose
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {FOLDERS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => switchFolder(id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${folder === id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Icon className="h-4 w-4" />
              {label}
              {id === 'inbox' && unreadCount > 0 && (
                <span className="ml-auto rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">{unreadCount}</span>
              )}
              {id !== 'inbox' && emails.length > 0 && (
                <span className="ml-auto text-xs text-gray-400">{emails.length}</span>
              )}
            </button>
          ))}

          <div className="pt-2 border-t border-gray-100 mt-2">
            <button onClick={() => setContactsOpen(true)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              <BookUser className="h-4 w-4" /> Contacts
            </button>
          </div>
        </nav>

        <div className="border-t border-gray-200 p-4">
          <p className="mb-3 truncate text-xs text-gray-500" title={userEmail}>{userEmail}</p>
          <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden" aria-label="Open sidebar">
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-semibold text-gray-700 capitalize">{folder}</h2>
          <div className="flex-1" />
          <button onClick={loadEmails} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* Email List */}
          <div className={`w-full border-r border-gray-200 bg-white sm:w-96 lg:w-[420px] shrink-0 ${selectedEmail ? 'hidden sm:block' : 'block'}`}>
            {loading && (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading messages...
              </div>
            )}
            {error && !loading && (
              <div className="flex flex-col items-center justify-center gap-4 py-20 px-6">
                <AlertCircle className="h-10 w-10 text-red-400" />
                <p className="text-sm text-red-600 text-center">{error}</p>
                <button onClick={loadEmails} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Try again
                </button>
              </div>
            )}
            {!loading && !error && emails.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-6">
                <Inbox className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">
                  {folder === 'inbox' ? 'Your inbox is empty.' : `No ${folder} messages.`}
                </p>
                {folder === 'inbox' && (
                  <button onClick={() => openCompose()} className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500">
                    Compose your first email
                  </button>
                )}
              </div>
            )}
            {!loading && !error && emails.length > 0 && (
              <div className="email-scroll h-full overflow-y-auto">
                {emails.map((msg) => (
                  <button key={msg.id} onClick={() => { setSelectedId(msg.id); if (!msg.is_read && folder === 'inbox') markAsRead(msg.id); }} className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${selectedId === msg.id ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : 'hover:bg-gray-50'} ${!msg.is_read ? 'bg-gray-50/80' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm truncate ${!msg.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>
                        {folder === 'sent' ? msg.recipient_email : msg.sender_name || msg.sender_email}
                      </p>
                      <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{formatDate(msg.created_at)}</span>
                    </div>
                    <p className={`text-sm truncate mt-0.5 ${!msg.is_read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{msg.subject}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{getPreview(msg.body_text)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reading Pane */}
          <div className={`flex-1 bg-white overflow-y-auto ${selectedEmail ? 'block' : 'hidden sm:flex'} ${!selectedEmail ? 'items-center justify-center' : ''}`}>
            {selectedEmail ? (
              <div className="p-6">
                <button onClick={() => setSelectedId(null)} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 sm:hidden">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <h2 className="text-xl font-semibold text-gray-900">{selectedEmail.subject}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                  <span><span className="font-medium text-gray-700">From:</span> {selectedEmail.sender_name ? `${selectedEmail.sender_name} <${selectedEmail.sender_email}>` : selectedEmail.sender_email}</span>
                  <span><span className="font-medium text-gray-700">To:</span> {selectedEmail.recipient_email}</span>
                  <span>{formatFullDate(selectedEmail.created_at)}</span>
                </div>
                <hr className="my-5 border-gray-200" />
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {selectedEmail.body_text || 'No content.'}
                </div>
                {/* Actions */}
                <div className="mt-6 flex gap-3 border-t border-gray-200 pt-4">
                  {folder === 'trash' ? (
                    <>
                      <button onClick={() => restoreEmail(selectedEmail.id)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                        <RotateCcw className="h-4 w-4" /> Restore
                      </button>
                      <button onClick={() => deletePermanently(selectedEmail.id)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-4 w-4" /> Delete permanently
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => openCompose(selectedEmail.sender_email)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
                        <SendIcon className="h-4 w-4" /> Reply
                      </button>
                      <button onClick={() => moveToTrash(selectedEmail.id)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                        <Trash2 className="h-4 w-4" /> Trash
                      </button>
                    </>
                  )}
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

      <ComposeModal isOpen={composeOpen} onClose={() => setComposeOpen(false)} defaultTo={composeDefaultTo} onSendSuccess={loadEmails} />
      <AddressBookModal isOpen={contactsOpen} onClose={() => setContactsOpen(false)} onSelectContact={handleContactSelect} />
    </div>
  );
}
