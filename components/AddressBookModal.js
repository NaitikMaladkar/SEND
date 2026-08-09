'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Loader2, User } from 'lucide-react';

export default function AddressBookModal({ isOpen, onClose, onSelectContact }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/contacts');
      if (res.status === 401) {
        setError('Session expired.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load contacts.');
        return;
      }
      setContacts(data.contacts || []);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadContacts();
  }, [isOpen, loadContacts]);

  if (!isOpen) return null;

  async function handleAdd(e) {
    e.preventDefault();
    setAddError('');
    if (!newName.trim() || !newEmail.trim()) {
      setAddError('Name and email are required.');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || 'Failed to add contact.');
        setAdding(false);
        return;
      }
      setNewName('');
      setNewEmail('');
      setShowAdd(false);
      setContacts((prev) => [...prev, data.contact]);
    } catch {
      setAddError('Network error.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    try {
      await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // silently fail
    }
  }

  function handleSelect(contact) {
    if (onSelectContact) onSelectContact(contact.email);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">Address Book</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading contacts...
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {!loading && !error && contacts.length === 0 && !showAdd && (
            <div className="text-center py-10">
              <User className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No contacts yet.</p>
            </div>
          )}

          {/* Contact List */}
          <div className="space-y-1">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="group flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <button
                  onClick={() => handleSelect(contact)}
                  className="flex-1 text-left min-w-0"
                >
                  <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                  <p className="text-xs text-gray-500 truncate">{contact.email}</p>
                </button>
                <button
                  onClick={() => handleDelete(contact.id)}
                  className="ml-2 rounded p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  aria-label="Delete contact"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Contact Form */}
          {showAdd && (
            <form onSubmit={handleAdd} className="mt-4 space-y-3 rounded-lg border border-gray-200 p-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
              />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
              />
              {addError && (
                <p className="text-xs text-red-600">{addError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {adding ? 'Adding...' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setAddError(''); }}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3">
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Contact
            </button>
          )}
        </div>
      </div>
    </div>
  );
}