import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';

const gearIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const SettingsMenu: React.FC = () => {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (auth?.user?.email) setResetEmail(auth.user.email);
  }, [auth?.user?.email]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  if (!auth?.user) return null;

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage(null);
    setResetLoading(true);
    const { error } = await auth.requestPasswordReset(resetEmail);
    setResetLoading(false);
    if (error) {
      setResetMessage({ type: 'error', text: error.message });
      return;
    }
    setResetMessage({ type: 'success', text: 'Check your email for the reset link.' });
  };

  return (
    <>
      <div ref={menuRef} style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 1000 }}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="Settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            padding: 0,
            border: '1px solid #ddd',
            borderRadius: '50%',
            background: '#fff',
            color: '#555',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          {gearIcon}
        </button>
        {open && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '6px',
              minWidth: '160px',
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: '6px 0',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setResetModalOpen(true);
                setResetMessage(null);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#333',
              }}
            >
              Reset password
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                auth.signOut();
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#333',
              }}
            >
              Log out
            </button>
          </div>
        )}
      </div>

      {resetModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
          onClick={() => !resetLoading && setResetModalOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '360px',
              width: '90%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>Reset password</h3>
            <form onSubmit={handleResetSubmit}>
              <label htmlFor="reset-email" style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#555' }}>
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                required
                disabled={resetLoading}
                style={{ width: '100%', padding: '8px 12px', marginBottom: '12px', boxSizing: 'border-box' }}
              />
              {resetMessage && (
                <p style={{ color: resetMessage.type === 'error' ? '#dc3545' : '#28a745', fontSize: '14px', marginBottom: '12px' }}>
                  {resetMessage.text}
                </p>
              )}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setResetModalOpen(false)} disabled={resetLoading}>
                  Cancel
                </button>
                <button type="submit" disabled={resetLoading}>
                  {resetLoading ? 'Sending…' : 'Send reset link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
