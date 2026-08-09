'use client';

import { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTo?: string;
  onSendSuccess?: () => void;
}

export default function ComposeModal({
  isOpen,
  onClose,
  defaultTo = '',
  onSendSuccess,
}: ComposeModalProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Update `to` when defaultTo changes externally
  if (isOpen && defaultTo && !to) {
    setTo(defaultTo);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);

    try {
      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send email');
        setSending(false);
        return;
      }

      setSuccess(true);
      onSendSuccess?.();

      // Close after short delay
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch {
      setError('An unexpected error occurred');
      setSending(false);
    }
  }

  function handleClose() {
    setTo('');
    setSubject('');
    setBody('');
    setError(null);
    setSuccess(false);
    setSending(false);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Message</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSend} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 py-3 border-b border-gray-100">
            <label htmlFor="compose-to" className="sr-only">To</label>
            <input
              id="compose-to"
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            />
          </div>

          <div className="px-6 py-3 border-b border-gray-100">
            <label htmlFor="compose-subject" className="sr-only">Subject</label>
            <input
              id="compose-subject"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            />
          </div>

          <div className="flex-1 px-6 py-3 min-h-0">
            <label htmlFor="compose-body" className="sr-only">Body</label>
            <textarea
              id="compose-body"
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              className="w-full h-full min-h-[200px] text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none"
            />
          </div>

          {error && (
            <div className="px-6 py-2 bg-red-50 border-t border-red-100">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="px-6 py-2 bg-green-50 border-t border-green-100">
              <p className="text-sm text-green-600">Message sent!</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={sending || success}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending…
                </>
              ) : success ? (
                'Sent!'
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
