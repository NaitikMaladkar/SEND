'use client';

import { useState, useEffect } from 'react';
import { X, Send, Loader2, Check } from 'lucide-react';

export default function ComposeModal({ isOpen, onClose, defaultTo, onSendSuccess }) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTo(defaultTo || '');
      setSubject('');
      setBody('');
      setError('');
      setSent(false);
    }
  }, [isOpen, defaultTo]);

  if (!isOpen) return null;

  async function handleSend(e) {
    e.preventDefault();
    setError('');

    const trimmedTo = to.trim();
    if (!trimmedTo) {
      setError('Recipient email is required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedTo)) {
      setError('Enter a valid email address (e.g. person@example.com).');
      return;
    }
    if (!subject.trim()) {
      setError('Subject is required.');
      return;
    }
    if (!body.trim()) {
      setError('Message body is required.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: trimmedTo, subject: subject.trim(), body: body.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send.');
        setSending(false);
        return;
      }

      setSent(true);
      if (onSendSuccess) onSendSuccess();
      setTimeout(() => onClose(), 1200);
    } catch {
      setError('Network error. Please try again.');
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">New Message</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSend} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto">
            {/* To */}
            <div className="border-b border-gray-200">
              <div className="flex items-center py-3 px-5">
                <label htmlFor="compose-to" className="text-sm font-medium text-gray-500 w-14 shrink-0">
                  To
                </label>
                <input
                  id="compose-to"
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  autoComplete="email"
                  className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Subject */}
            <div className="border-b border-gray-200">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="w-full px-5 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>

            {/* Body */}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              rows={8}
              className="w-full resize-none px-5 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
          </div>

          {/* Error / Success */}
          {error && (
            <div className="mx-5 mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}
          {sent && (
            <div className="mx-5 mt-3 rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-700 flex items-center gap-2">
              <Check className="h-4 w-4" /> Email sent successfully!
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
            <button
              type="submit"
              disabled={sending || sent}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : sent ? (
                <Check className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? 'Sending...' : sent ? 'Sent!' : 'Send'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Discard
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
