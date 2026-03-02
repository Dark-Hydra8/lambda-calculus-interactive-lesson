import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { validateAsuriteId } from './AuthContext';

type Mode = 'signin' | 'signup';

export const LoginPage: React.FC = () => {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [asuriteId, setAsuriteId] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  if (!auth) {
    return (
      <div className="container">
        <p>Auth not available.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    if (mode === 'signin') {
      const { error } = await auth.signIn(username.trim(), password);
      setLoading(false);
      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }
    } else {
      if (!validateAsuriteId(asuriteId.trim())) {
        setLoading(false);
        setMessage({ type: 'error', text: 'ASURite ID must be 2–20 alphanumeric characters.' });
        return;
      }
      const { error } = await auth.signUp(username.trim(), password, asuriteId.trim());
      setLoading(false);
      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }
      setMessage({ type: 'success', text: 'Check your email to confirm your account.' });
    }
  };

  if (!auth.user) {
    return (
      <div className="container">
        <h1>Lambda Calculus Interactive Lessons</h1>
        <p style={{ marginBottom: '20px', color: '#666' }}>
        </p>
        <form onSubmit={handleSubmit} style={{ maxWidth: '400px' }}>
          {message && (
            <p style={{ color: message.type === 'error' ? '#dc3545' : '#28a745', marginBottom: '12px' }}>
              {message.text}
            </p>
          )}
          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="username" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Email
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="password" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box' }}
            />
          </div>
          {mode === 'signup' && (
            <div style={{ marginBottom: '12px' }}>
              <label htmlFor="asurite" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                ASURite ID (username)
              </label>
              <input
                id="asurite"
                type="text"
                value={asuriteId}
                onChange={(e) => setAsuriteId(e.target.value)}
                required
                autoComplete="username"
                placeholder="e.g. jsmith42"
                style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box' }}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <button type="submit" disabled={loading}>
              {mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setMessage(null);
              }}
            >
              {mode === 'signin' ? 'Sign up instead' : 'Sign in instead'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return null;
};
