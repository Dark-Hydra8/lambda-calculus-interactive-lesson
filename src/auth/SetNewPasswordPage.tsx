import React, { useState } from 'react';
import { useAuth } from './AuthContext';

export const SetNewPasswordPage: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (password !== confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (!auth?.updatePassword) {
      setMessage({ type: 'error', text: 'Unable to update password.' });
      return;
    }
    setLoading(true);
    const { error } = await auth.updatePassword(password);
    setLoading(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setMessage({ type: 'success', text: 'Password updated. You can now sign in with your new password.' });
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setTimeout(onDone, 2000);
  };

  return (
    <div className="container" style={{ maxWidth: '400px', marginTop: '60px' }}>
      <h1>Set new password</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Enter your new password below.
      </p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="new-password" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            New password
          </label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={loading}
            autoComplete="new-password"
            style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="confirm-password" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={6}
            disabled={loading}
            autoComplete="new-password"
            style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box' }}
          />
        </div>
        {message && (
          <p style={{ color: message.type === 'error' ? '#dc3545' : '#28a745', marginBottom: '12px' }}>
            {message.text}
          </p>
        )}
        <button type="submit" disabled={loading}>
          {loading ? 'Updating…' : 'Set password'}
        </button>
      </form>
    </div>
  );
};
