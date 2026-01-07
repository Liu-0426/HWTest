import { useEffect, useState } from 'react';
import axios from 'axios';

type AuthPayload = {
  user?: {
    name?: string;
    email?: string;
  };
  [key: string]: unknown;
};

type LoginFormProps = {
  apiBaseUrl?: string;
  prefillEmail?: string;
  loginHint?: string;
  onSuccess: (payload: AuthPayload) => void;
};

const buildUrl = (baseUrl: string | undefined, path: string) => {
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
};

export default function LoginForm({ apiBaseUrl, prefillEmail, loginHint, onSuccess }: LoginFormProps) {
  const [identifier, setIdentifier] = useState(prefillEmail ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(loginHint ?? '');

  useEffect(() => {
    if (prefillEmail) {
      setIdentifier(prefillEmail);
    }
  }, [prefillEmail]);

  useEffect(() => {
    if (loginHint) {
      setMessage(loginHint);
    }
  }, [loginHint]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const isEmail = identifier.includes('@');
      const { data } = await axios.post(
        buildUrl(apiBaseUrl, '/api/login'),
        isEmail ? { email: identifier, password } : { name: identifier, password },
        { headers: { 'Content-Type': 'application/json' }, withCredentials: true }
      );

      setMessage('Welcome back. Redirecting to your workspace.');
      onSuccess(data);
    } catch (err) {
      const fallbackMessage = 'Login failed. Please check your credentials.';
      if (axios.isAxiosError(err)) {
        const serverMessage = err.response?.data?.error ?? err.response?.data?.message;
        setError(typeof serverMessage === 'string' ? serverMessage : fallbackMessage);
      } else {
        setError(err instanceof Error ? err.message : fallbackMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-field">
        <label htmlFor="login-email">Email or name</label>
        <input
          id="login-email"
          type="text"
          name="identifier"
          autoComplete="email"
          placeholder="you@company.com or user name"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Your secure password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <div className="auth-meta">
        <label className="auth-checkbox">
          <input type="checkbox" />
          <span>Keep me signed in</span>
        </label>
        <button type="button" className="auth-link" disabled>
          Forgot password
        </button>
      </div>

      {error ? <div className="auth-alert error">{error}</div> : null}
      {message ? <div className="auth-alert success">{message}</div> : null}

      <button className="auth-submit" type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
