import { useMemo, useState } from 'react';
import './LoginScreen.css';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

type AuthMode = 'login' | 'register';

type AuthPayload = {
  user?: {
    name?: string;
    email?: string;
  };
  [key: string]: unknown;
};

type LoginScreenProps = {
  apiBaseUrl?: string;
  onAuthenticated: (payload: AuthPayload) => void;
};

export default function LoginScreen({ apiBaseUrl, onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [prefillEmail, setPrefillEmail] = useState('');
  const [loginHint, setLoginHint] = useState('');

  const highlight = useMemo(() => {
    return mode === 'login'
      ? '歡迎回來，立即進入聊天室。'
      : '註冊只需幾分鐘，馬上開始交流。';
  }, [mode]);

  return (
    <div className="auth-root">
      <div className="auth-glow">
        <span className="orb orb-a" />
        <span className="orb orb-b" />
        <span className="orb orb-c" />
      </div>

      <div className="auth-card" role="region" aria-label="Authentication">
        <div className="auth-info">
          <div className="auth-badge">IRC SIMPLE</div>
          <h1>你的 IRC 聊天空間，簡單又直覺。</h1>
          <p>{highlight}</p>

          <div className="auth-stats">
            <div>
              <span>24/7</span>
              <small>線上狀態</small>
            </div>
            <div>
              <span>低延遲</span>
              <small>即時回應</small>
            </div>
            <div>
              <span>安全</span>
              <small>簡單登入</small>
            </div>
          </div>

          <div className="auth-quote">
            "回到聊天室的本質：快、輕、好用。"
            <span>- 系統訊息</span>
          </div>
        </div>

        <div className="auth-panel">
          <div className="auth-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => {
                setMode('login');
                setLoginHint('');
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => {
                setMode('register');
                setLoginHint('');
              }}
            >
              Create account
            </button>
          </div>

          <div className="auth-panel-body">
            <div className="auth-title">
              <h2>{mode === 'login' ? '登入 IRC' : '註冊帳號'}</h2>
              <p>
                {mode === 'login'
                  ? '使用信箱登入並進入聊天室。'
                  : '填寫基本資料，建立新帳號。'}
              </p>
            </div>

            {mode === 'login' ? (
              <LoginForm
                apiBaseUrl={apiBaseUrl}
                prefillEmail={prefillEmail}
                loginHint={loginHint}
                onSuccess={onAuthenticated}
              />
            ) : (
              <RegisterForm
                apiBaseUrl={apiBaseUrl}
                onRegistered={(email) => {
                  setPrefillEmail(email);
                  setLoginHint('Account created. Please sign in to continue.');
                  setMode('login');
                }}
              />
            )}

            <div className="auth-footer">
              <span>
                {mode === 'login'
                  ? '第一次使用？'
                  : '已經有帳號了？'}
              </span>
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  const nextMode = mode === 'login' ? 'register' : 'login';
                  setMode(nextMode);
                  if (nextMode === 'register') {
                    setLoginHint('');
                  }
                }}
              >
                {mode === 'login' ? '建立新帳號' : '返回登入'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
