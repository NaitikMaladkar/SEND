'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getMailDomain, stripHtml } from '@/lib/utils';
import ComposeModal from '@/components/ComposeModal';
import AddressBookModal from '@/components/AddressBookModal';
import type { Email } from '@/lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  PenSquare,
  Inbox as InboxIcon,
  Send as SendIcon,
  Trash2,
  LogOut,
  Menu,
  X,
  Mail,
  Users,
  RotateCcw,
  Trash,
  Reply,
  Loader2,
  WifiOff,
  Wifi,
  Clock,
  ChevronLeft,
} from 'lucide-react';

type Folder = 'inbox' | 'sent' | 'trash';

export default function InboxPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const domain = getMailDomain();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // State
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [folder, setFolder] = useState<Folder>('inbox');
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDefaultTo, setComposeDefaultTo] = useState('');
  const [contactsOpen, setContactsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Counts
  const inboxCount = emails.filter((e) => e.folder === 'inbox').length;
  const sentCount = emails.filter((e) => e.folder === 'sent').length;
  const trashCount = emails.filter((e) => e.folder === 'trash').length;

  const unreadInbox = emails.filter(
    (e) => e.folder === 'inbox' && !e.is_read,
  ).length;

  // Current folder emails
  const folderEmails = emails.filter((e) => e.folder === folder);

  // Selected email
  const selectedEmail = emails.find((e) => e.id === selectedEmailId) || null;

  // Fetch user info
  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserEmail(user.email ?? '');
      setUserId(user.id);
    }
    loadUser();
  }, [supabase, router]);

  // Fetch emails
  const fetchEmails = useCallback(
    async (targetFolder?: Folder) => {
      const f = targetFolder || folder;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/emails?folder=${f}`);
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (res.ok) {
          setEmails((prev) => {
            // Replace only the emails of the fetched folder
            const otherEmails = prev.filter((e) => e.folder !== f);
            return [...otherEmails, ...(data.emails || [])];
          });
          setLastSynced(new Date());
        } else {
          setError(data.error || 'Failed to load emails');
        }
      } catch {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    },
    [folder, router],
  );

  // Load emails when folder changes
  useEffect(() => {
    if (userId) {
      fetchEmails();
    }
  }, [folder, userId, fetchEmails]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('emails')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'emails',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newEmail = payload.new as Email;
          setEmails((prev) => {
            // Avoid duplicates
            if (prev.some((e) => e.id === newEmail.id)) return prev;
            return [newEmail, ...prev];
          });
          setLastSynced(new Date());
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  // Offline detection
  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      // Refresh emails when coming back online
      fetchEmails();
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchEmails]);

  // Select email and mark as read
  async function handleSelectEmail(email: Email) {
    setSelectedEmailId(email.id);
    setSidebarOpen(false);

    if (!email.is_read && folder === 'inbox') {
      // Mark as read in the background
      setEmails((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, is_read: true } : e)),
      );
      try {
        await fetch(`/api/emails/${email.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'read' }),
        });
      } catch {
        // Silently fail - already updated locally
      }
    }
  }

  // Email actions
  async function handleAction(emailId: string, action: string) {
    setActionLoading(emailId);
    try {
      const res = await fetch(`/api/emails/${emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Action failed');
        return;
      }
      // Optimistically update
      setEmails((prev) =>
        prev.map((e) => {
          if (e.id !== emailId) return e;
          switch (action) {
            case 'read':
              return { ...e, is_read: true };
            case 'unread':
              return { ...e, is_read: false };
            case 'trash':
              return { ...e, folder: 'trash' as const };
            case 'restore':
              return { ...e, folder: 'inbox' as const };
            default:
              return e;
          }
        }),
      );
      if (action === 'trash' && selectedEmailId === emailId) {
        setSelectedEmailId(null);
      }
      if (action === 'restore' && selectedEmailId === emailId) {
        setSelectedEmailId(null);
      }
      setLastSynced(new Date());
    } catch {
      setError('Failed to perform action');
    } finally {
      setActionLoading(null);
    }
  }

  // Delete permanently
  async function handleDelete(emailId: string) {
    setActionLoading(emailId);
    try {
      const res = await fetch(`/api/emails/${emailId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Delete failed');
        return;
      }
      setEmails((prev) => prev.filter((e) => e.id !== emailId));
      if (selectedEmailId === emailId) {
        setSelectedEmailId(null);
      }
      setLastSynced(new Date());
    } catch {
      setError('Failed to delete');
    } finally {
      setActionLoading(null);
    }
  }

  // Sign out
  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  // Compose
  function openCompose(to?: string) {
    setComposeDefaultTo(to || '');
    setComposeOpen(true);
  }

  // Reply
  function handleReply() {
    if (!selectedEmail) return;
    const subject = selectedEmail.subject
      ? selectedEmail.subject.startsWith('Re: ')
        ? selectedEmail.subject
        : `Re: ${selectedEmail.subject}`
      : '';
    openCompose(selectedEmail.sender_email);
    // We set the defaultTo and the subject would need to be handled via compose modal
    // For simplicity, we open compose with the To filled in
  }

  // Select contact
  function handleSelectContact(email: string) {
    openCompose(email);
  }

  // Format date
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  // Format full date
  function formatFullDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-yellow-700">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">Offline</span>
          </div>
          {lastSynced && (
            <span className="text-xs text-yellow-600 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last synced {formatDate(lastSynced.toISOString())}
            </span>
          )}
        </div>
      )}

      {/* Top bar (mobile) */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <h1 className="text-lg font-bold text-indigo-600">SEND</h1>
        <button
          onClick={() => openCompose()}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <PenSquare className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar overlay (mobile) */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/30 z-20"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-30 lg:z-0 w-72 h-full bg-gray-50 border-r border-gray-200 flex flex-col transition-transform duration-200 ease-in-out`}
        >
          {/* Compose button */}
          <div className="p-4">
            <button
              onClick={() => {
                openCompose();
                setSidebarOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-medium py-2.5 px-4 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors shadow-sm"
            >
              <PenSquare className="w-4 h-4" />
              Compose
            </button>
          </div>

          {/* Folder navigation */}
          <nav className="flex-1 px-3 space-y-1">
            <button
              onClick={() => {
                setFolder('inbox');
                setSelectedEmailId(null);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                folder === 'inbox'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <InboxIcon className="w-5 h-5" />
              <span className="flex-1 text-left">Inbox</span>
              {unreadInbox > 0 && (
                <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadInbox}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setFolder('sent');
                setSelectedEmailId(null);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                folder === 'sent'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <SendIcon className="w-5 h-5" />
              <span className="flex-1 text-left">Sent</span>
              {sentCount > 0 && (
                <span className="text-xs text-gray-400">{sentCount}</span>
              )}
            </button>

            <button
              onClick={() => {
                setFolder('trash');
                setSelectedEmailId(null);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                folder === 'trash'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Trash2 className="w-5 h-5" />
              <span className="flex-1 text-left">Trash</span>
              {trashCount > 0 && (
                <span className="text-xs text-gray-400">{trashCount}</span>
              )}
            </button>

            <div className="pt-4 border-t border-gray-200 mt-4">
              <button
                onClick={() => {
                  setContactsOpen(true);
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Users className="w-5 h-5" />
                <span className="flex-1 text-left">Contacts</span>
              </button>
            </div>
          </nav>

          {/* User info and sign out */}
          <div className="p-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 truncate">{userEmail}</p>
            <button
              onClick={handleSignOut}
              className="mt-2 w-full flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </aside>

        {/* Email list */}
        <div className="flex-1 flex min-w-0">
          <div
            className={`${selectedEmail ? 'hidden md:flex' : 'flex'} w-full md:w-96 md:flex-shrink-0 flex-col border-r border-gray-200`}
          >
            {/* List header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                {folder === 'inbox'
                  ? 'Inbox'
                  : folder === 'sent'
                    ? 'Sent'
                    : 'Trash'}
              </h2>
              {isOnline && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Wifi className="w-3 h-3" />
                  {lastSynced && (
                    <span>Synced {formatDate(lastSynced.toISOString())}</span>
                  )}
                </div>
              )}
            </div>

            {/* Email list content */}
            <div className="flex-1 overflow-y-auto email-scroll">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                </div>
              ) : error ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-sm text-red-500">{error}</p>
                  <button
                    onClick={() => fetchEmails()}
                    className="mt-2 text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                  >
                    Try again
                  </button>
                </div>
              ) : folderEmails.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">
                    {folder === 'inbox'
                      ? 'No messages yet'
                      : folder === 'sent'
                        ? 'No sent messages'
                        : 'Trash is empty'}
                  </p>
                </div>
              ) : (
                <ul>
                  {folderEmails.map((email) => (
                    <li key={email.id}>
                      <button
                        onClick={() => handleSelectEmail(email)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${
                          selectedEmailId === email.id
                            ? 'bg-indigo-50 border-l-2 border-l-indigo-600'
                            : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-sm truncate ${
                              !email.is_read
                                ? 'font-semibold text-gray-900'
                                : 'text-gray-600'
                            }`}
                          >
                            {folder === 'sent'
                              ? email.recipient_email
                              : email.sender_name || email.sender_email}
                          </span>
                          <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                            {formatDate(email.created_at)}
                          </span>
                        </div>
                        <p
                          className={`text-sm truncate mt-0.5 ${
                            !email.is_read
                              ? 'font-medium text-gray-800'
                              : 'text-gray-500'
                          }`}
                        >
                          {email.subject || '(no subject)'}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {email.body_text
                            ? stripHtml(email.body_text).slice(0, 100)
                            : email.body_html
                              ? stripHtml(email.body_html).slice(0, 100)
                              : ''}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Reading pane */}
          <div
            className={`${selectedEmail ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}
          >
            {selectedEmail ? (
              <>
                {/* Reading pane header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
                  <button
                    onClick={() => setSelectedEmailId(null)}
                    className="md:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-2 ml-auto">
                    {folder === 'inbox' && (
                      <button
                        onClick={() =>
                          handleAction(
                            selectedEmail.id,
                            selectedEmail.is_read ? 'unread' : 'read',
                          )
                        }
                        disabled={actionLoading === selectedEmail.id}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        title={
                          selectedEmail.is_read ? 'Mark as unread' : 'Mark as read'
                        }
                      >
                        <Mail className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          {selectedEmail.is_read ? 'Unread' : 'Read'}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => handleReply()}
                      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      <Reply className="w-4 h-4" />
                      <span className="hidden sm:inline">Reply</span>
                    </button>
                    {selectedEmail.folder !== 'trash' ? (
                      <button
                        onClick={() =>
                          handleAction(selectedEmail.id, 'trash')
                        }
                        disabled={actionLoading === selectedEmail.id}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Trash</span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            handleAction(selectedEmail.id, 'restore')
                          }
                          disabled={actionLoading === selectedEmail.id}
                          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span className="hidden sm:inline">Restore</span>
                        </button>
                        <button
                          onClick={() => handleDelete(selectedEmail.id)}
                          disabled={actionLoading === selectedEmail.id}
                          className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash className="w-4 h-4" />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Email content */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                  <h1 className="text-xl font-bold text-gray-900 mb-4">
                    {selectedEmail.subject || '(no subject)'}
                  </h1>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-6 mb-6 text-sm">
                    <div>
                      <span className="text-gray-400">From: </span>
                      <span className="text-gray-700 font-medium">
                        {selectedEmail.sender_name
                          ? `${selectedEmail.sender_name} <${selectedEmail.sender_email}>`
                          : selectedEmail.sender_email}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">To: </span>
                      <span className="text-gray-700">
                        {selectedEmail.recipient_email}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Date: </span>
                      <span className="text-gray-700">
                        {formatFullDate(selectedEmail.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-5">
                    <div className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                      {selectedEmail.body_text
                        ? selectedEmail.body_text
                        : selectedEmail.body_html
                          ? stripHtml(selectedEmail.body_html)
                          : 'No content'}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">
                    Select an email to read
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        defaultTo={composeDefaultTo}
        onSendSuccess={() => fetchEmails('sent')}
      />

      {/* Address Book Modal */}
      <AddressBookModal
        isOpen={contactsOpen}
        onClose={() => setContactsOpen(false)}
        onSelectContact={handleSelectContact}
      />
    </div>
  );
}
