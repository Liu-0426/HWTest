import { useEffect, useState } from 'react';
import axios from 'axios';
import ChatLayout from './components/ChatLayout';
import LoginScreen from './components/LoginScreen';
import { devAuthPayload, devBypassAuth } from './devAuth';

type AuthPayload = {
  user?: {
    name?: string;
    email?: string;
  };
  [key: string]: unknown;
};

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const apiBaseUrl = import.meta.env.DEV ? undefined : rawApiBaseUrl?.trim() || undefined;

export default function App() {
  const [user, setUser] = useState<AuthPayload['user'] | null>(
    devBypassAuth ? devAuthPayload.user ?? null : null
  );
  const [loading, setLoading] = useState(!devBypassAuth);

  useEffect(() => {
    if (devBypassAuth) return;
    const fetchMe = async () => {
      try {
        const { data } = await axios.get(`${apiBaseUrl ?? ''}/api/me`, { withCredentials: true });
        if (data?.name || data?.email) {
          setUser({ name: data.name, email: data.email });
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, []);

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <LoginScreen
        apiBaseUrl={apiBaseUrl}
        onAuthenticated={(payload: AuthPayload) => {
          if (payload.user) {
            setUser(payload.user);
          }
        }}
      />
    );
  }

  return (
    <ChatLayout
      apiBaseUrl={apiBaseUrl}
      currentUserName={user?.name ?? 'User'}
      onLogout={async () => {
        try {
          await axios.post(`${apiBaseUrl ?? ''}/api/logout`, {}, { withCredentials: true });
        } finally {
          setUser(null);
        }
      }}
    />
  );
}
