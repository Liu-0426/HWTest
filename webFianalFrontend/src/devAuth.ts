type AuthPayload = {
  token?: string;
  user?: {
    name?: string;
    email?: string;
  };
  [key: string]: unknown;
};

export const devBypassAuth =
  import.meta.env.MODE === 'development' && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';

export const devAuthPayload: AuthPayload = {
  token: 'dev',
  user: {
    name: 'Dev_User',
    email: 'dev@example.com',
  },
};
