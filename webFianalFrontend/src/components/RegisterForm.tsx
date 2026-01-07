import { useState } from 'react';
import axios from 'axios';

type RegisterFormProps = {
  apiBaseUrl?: string;
  onRegistered: (email: string) => void;
};

const buildUrl = (baseUrl: string | undefined, path: string) => {
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
};

export default function RegisterForm({ apiBaseUrl, onRegistered }: RegisterFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await axios.post(
        buildUrl(apiBaseUrl, '/api/register'),
        {
          name: fullName,
          email,
          password
        },
        { headers: { 'Content-Type': 'application/json' }, withCredentials: true }
      );

      setMessage('Account created. Please sign in with your new credentials.');
      onRegistered(email);
    } catch (err) {
      const fallbackMessage = 'Registration failed. Please try again.';
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
        <label htmlFor="register-name">Full name</label>
        <input
          id="register-name"
          type="text"
          name="name"
          autoComplete="name"
          placeholder="Jane Doe"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="register-email">Work email</label>
        <input
          id="register-email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="jane@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="register-password">Password</label>
        <input
          id="register-password"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="register-confirm">Confirm password</label>
        <input
          id="register-confirm"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      </div>

      {error ? <div className="auth-alert error">{error}</div> : null}
      {message ? <div className="auth-alert success">{message}</div> : null}

      <button className="auth-submit" type="submit" disabled={loading}>
        {loading ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  );
}
