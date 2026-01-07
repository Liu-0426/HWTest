import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import axios from 'axios';
import '../NeonChat.css';

type ChatLayoutProps = {
  apiBaseUrl?: string;
  currentUserName?: string;
  onLogout: () => void;
};

type Channel = {
  id: number;
  name: string;
  owner_id: number;
  ownerName?: string;
  owner?: {
    name?: string;
  };
};

type Message = {
  sender: string;
  content: string;
  timestamp: number;
};

type Member = {
  id: number;
  name: string;
};

const buildUrl = (baseUrl: string | undefined, path: string) => {
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
};

const buildWsUrl = (baseUrl: string | undefined, path: string) => {
  const base = baseUrl ?? window.location.origin;
  return buildUrl(base, path).replace(/^http/, 'ws');
};

const getInitials = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return 'DU';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const HOME_CHANNEL_ID = 0;

export default function ChatLayout({
  apiBaseUrl,
  currentUserName = 'Dev_User',
  onLogout,
}: ChatLayoutProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(HOME_CHANNEL_ID);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [newChannelName, setNewChannelName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [sidebarError, setSidebarError] = useState('');
  const [sidebarMessage, setSidebarMessage] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileOriginal, setProfileOriginal] = useState({ name: '', email: '' });
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const channelList = useMemo(() => {
    return channels.map((channel) => {
      const isOwn = channel.ownerName ? channel.ownerName === currentUserName : true;
      const label = isOwn ? `#${channel.name}` : `${channel.ownerName ?? 'unknown'}@${channel.name}`;
      return { ...channel, label };
    });
  }, [channels, currentUserName]);

  const activeChannel = useMemo(() => {
    if (!activeChannelId) return null;
    return channels.find((channel) => channel.id === activeChannelId) ?? null;
  }, [channels, activeChannelId]);

  const recentChannels = useMemo(() => {
    return [...channels].sort((a, b) => b.id - a.id).slice(0, 3);
  }, [channels]);

  const ownedChannels = useMemo(
    () => channels.filter((channel) => channel.ownerName === currentUserName),
    [channels, currentUserName]
  );

  const joinedChannels = useMemo(
    () => channels.filter((channel) => channel.ownerName !== currentUserName),
    [channels, currentUserName]
  );

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const [ownedRes, joinedRes] = await Promise.all([
          axios.get(buildUrl(apiBaseUrl, '/api/channels'), { withCredentials: true }),
          axios.get(buildUrl(apiBaseUrl, '/api/channels/joined'), { withCredentials: true }),
        ]);

        const owned = Array.isArray(ownedRes.data)
          ? ownedRes.data.map((channel: Channel) => ({
              ...channel,
              ownerName: channel.owner?.name ?? currentUserName,
            }))
          : [];
        const joined = Array.isArray(joinedRes.data)
          ? joinedRes.data.map((channel: Channel) => ({
              ...channel,
              ownerName: channel.owner?.name ?? channel.ownerName,
            }))
          : [];

        setChannels((prev) => {
          const merged = new Map<number, Channel>();
          [...owned, ...joined, ...prev].forEach((channel) => merged.set(channel.id, channel));
          return Array.from(merged.values());
        });

        setActiveChannelId((current) => current ?? HOME_CHANNEL_ID);
      } catch (err) {
        setSidebarError('讀取頻道失敗，請稍後再試。');
      }
    };

    fetchChannels();
  }, [apiBaseUrl, currentUserName]);

  useEffect(() => {
    if (!activeChannelId) return;

    setMessages([]);
    setMembers([]);

    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = buildWsUrl(apiBaseUrl, `/ws/${activeChannelId}`);
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      fetchMembers(activeChannelId);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as Message;
        setMessages((prev) => [...prev, payload]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { sender: 'system', content: String(event.data), timestamp: Date.now() },
        ]);
      }
    };

    socket.onerror = () => {
      setSidebarError('WebSocket 連線失敗。');
    };

    socket.onclose = () => {
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
    };

    return () => {
      socket.close();
    };
  }, [activeChannelId, apiBaseUrl]);

  const fetchMembers = async (channelId: number) => {
    try {
      const { data } = await axios.get(
        buildUrl(apiBaseUrl, `/api/channels/${channelId}/members`),
        { withCredentials: true }
      );
      const normalized = Array.isArray(data)
        ? data.map((member: Member) => ({ id: member.id, name: member.name }))
        : [];
      setMembers(normalized);
    } catch {
      setMembers([]);
    }
  };

  const fetchProfile = async () => {
    setProfileError('');
    setProfileMessage('');
    setProfileLoading(true);
    try {
      const { data } = await axios.get(buildUrl(apiBaseUrl, '/api/me'), {
        withCredentials: true,
      });
      const name = typeof data?.name === 'string' ? data.name : '';
      const email = typeof data?.email === 'string' ? data.email : '';
      setProfileName(name);
      setProfileEmail(email);
      setProfileOriginal({ name, email });
    } catch {
      setProfileError('讀取個人資料失敗。');
    } finally {
      setProfileLoading(false);
    }
  };

  const openProfile = () => {
    setShowProfile(true);
    fetchProfile();
  };

  const handleProfileSave = async () => {
    const name = profileName.trim();
    const email = profileEmail.trim();
    const password = profilePassword.trim();

    if (name === profileOriginal.name && email === profileOriginal.email && !password) {
      setProfileError('尚未修改任何內容。');
      return;
    }

    setProfileError('');
    setProfileMessage('');
    setProfileLoading(true);

    try {
      const payload: { name: string; email: string; password?: string } = { name, email };
      if (password) {
        payload.password = password;
      }
      const { data } = await axios.put(buildUrl(apiBaseUrl, '/api/me'), payload, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      });
      if (data?.user?.name || data?.user?.email) {
        const updatedName = data.user.name ?? name;
        const updatedEmail = data.user.email ?? email;
        setProfileOriginal({ name: updatedName, email: updatedEmail });
        setProfileName(updatedName);
        setProfileEmail(updatedEmail);
      } else {
        setProfileOriginal({ name, email });
      }
      setProfilePassword('');
      setProfileMessage('個人檔案已更新。');
    } catch (err) {
      setProfileError('更新失敗，請稍後再試。');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('確定要刪除帳號？此操作無法復原。')) {
      return;
    }
    setProfileLoading(true);
    setProfileError('');
    try {
      await axios.delete(buildUrl(apiBaseUrl, '/api/me'), { withCredentials: true });
      onLogout();
    } catch {
      setProfileError('刪除帳號失敗。');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCreateChannel = async () => {
    const name = newChannelName.trim();
    if (!name) {
      setSidebarError('請輸入頻道名稱。');
      return;
    }

    setSidebarError('');
    setSidebarMessage('');

    try {
      const { data } = await axios.post(
        buildUrl(apiBaseUrl, '/api/channels'),
        { name },
        { headers: { 'Content-Type': 'application/json' }, withCredentials: true }
      );

      const created: Channel = { ...data, ownerName: currentUserName };
      setChannels((prev) => (prev.some((item) => item.id === created.id) ? prev : [...prev, created]));
      setActiveChannelId(created.id);
      setMembers([{ id: Date.now(), name: currentUserName }]);
      setNewChannelName('');
      setSidebarMessage('頻道已建立。');
    } catch (err) {
      setSidebarError('建立頻道失敗，可能名稱重複。');
    }
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query.includes('@')) {
      setSidebarError('搜尋格式需為 owner@channel');
      return;
    }

    setSidebarError('');
    setSidebarMessage('');

    try {
      const { data } = await axios.get(
        buildUrl(apiBaseUrl, `/api/channels/search?query=${encodeURIComponent(query)}`),
        { withCredentials: true }
      );
      const [ownerName] = query.split('@');
      const found: Channel = { ...data, ownerName: data?.owner?.name ?? ownerName };

      await axios.post(
        buildUrl(apiBaseUrl, `/api/channels/${found.id}/join`),
        {},
        { withCredentials: true }
      );

      setChannels((prev) => (prev.some((item) => item.id === found.id) ? prev : [...prev, found]));
      setActiveChannelId(found.id);
      fetchMembers(found.id);
      setSidebarMessage('已加入該頻道。');
    } catch (err) {
      setSidebarError('找不到該頻道。');
    }
  };

  const handleDeleteChannel = async (channelId: number) => {
    setSidebarError('');
    setSidebarMessage('');

    try {
      await axios.delete(buildUrl(apiBaseUrl, `/api/channels/${channelId}`), {
        withCredentials: true,
      });

      setChannels((prev) => {
        const remaining = prev.filter((channel) => channel.id !== channelId);
        setActiveChannelId((current) => {
          if (current === channelId) {
            return remaining[0]?.id ?? null;
          }
          return current;
        });
        return remaining;
      });
      setSidebarMessage('頻道已刪除。');
    } catch {
      setSidebarError('刪除頻道失敗。');
    }
  };

  const handleSend = () => {
    const content = chatInput.trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(content);
    setChatInput('');
  };

  const userInitials = getInitials(currentUserName);

  return (
    <div className="neon-layout">
      <aside className="neon-sidebar">
        <div className="server-title">NEO_SERVER</div>

        <div className="sidebar-input">
          <input
            type="text"
            value={newChannelName}
            onChange={(event) => setNewChannelName(event.target.value)}
            placeholder="New channel name"
          />
          <button type="button" className="sidebar-action" onClick={handleCreateChannel}>
            <Plus size={14} />
            Create
          </button>
        </div>

        <div className="sidebar-input">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search owner@channel"
          />
          <button type="button" className="sidebar-action" onClick={handleSearch}>
            <Search size={14} />
            Search
          </button>
        </div>

        {sidebarError ? <div className="sidebar-alert error">{sidebarError}</div> : null}
        {sidebarMessage ? <div className="sidebar-alert success">{sidebarMessage}</div> : null}

        <div className="channel-list">
          <div
            className={`channel-item channel-home ${activeChannelId === HOME_CHANNEL_ID ? 'active' : ''}`}
            onClick={() => setActiveChannelId(HOME_CHANNEL_ID)}
          >
            <span className="channel-label">首頁</span>
          </div>
          {channelList.length === 0 ? (
            <div className="channel-empty">尚未建立頻道</div>
          ) : (
            channelList.map((channel) => (
              <div
                key={`${channel.id}-${channel.owner_id}-${channel.name}`}
                className={`channel-item ${activeChannelId === channel.id ? 'active' : ''}`}
                onClick={() => setActiveChannelId(channel.id)}
              >
                <span className="channel-label">{channel.label}</span>
                {channel.ownerName === currentUserName ? (
                  <button
                    type="button"
                    className="channel-delete"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteChannel(channel.id);
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>

        <button type="button" className="user-profile-area" onClick={openProfile}>
          <div className="user-avatar">{userInitials}</div>
          <div className="user-info">
            <div className="user-name">{currentUserName}</div>
            <div className="user-status">Online</div>
          </div>
        </button>
      </aside>

      <main className="neon-chat-area">
        <header className="chat-header">
          <div className="chat-title">
            {activeChannel ? `#${activeChannel.name}` : '首頁'}
          </div>
          <div style={{ color: '#5c7c8a' }}>⋮</div>
        </header>

        {!activeChannel ? (
          <div className="welcome-panel">
            <div className="welcome-hero">
              <h2>歡迎回來，{currentUserName}</h2>
              <p>快速建立或搜尋頻道，開始你的即時聊天。</p>
              {recentChannels[0] ? (
                <button
                  type="button"
                  className="welcome-cta"
                  onClick={() => setActiveChannelId(recentChannels[0].id)}
                >
                  進入最近聊天：{recentChannels[0].ownerName === currentUserName
                    ? `#${recentChannels[0].name}`
                    : `${recentChannels[0].ownerName}@${recentChannels[0].name}`}
                </button>
              ) : null}
            </div>

            <div className="welcome-actions">
              <div className="welcome-card">
                <h3>快速建立</h3>
                <p>建立自己的頻道，邀請朋友加入。</p>
                <div className="welcome-input">
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(event) => setNewChannelName(event.target.value)}
                    placeholder="Channel name"
                  />
                  <button type="button" onClick={handleCreateChannel}>
                    建立
                  </button>
                </div>
              </div>

              <div className="welcome-card">
                <h3>搜尋加入</h3>
                <p>使用 owner@channel 格式加入他人頻道。</p>
                <div className="welcome-input">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="owner@channel"
                  />
                  <button type="button" onClick={handleSearch}>
                    搜尋
                  </button>
                </div>
              </div>
            </div>

            <div className="welcome-columns">
              <div>
                <h4>你的頻道</h4>
                {ownedChannels.length === 0 ? (
                  <div className="welcome-empty">尚未建立頻道</div>
                ) : (
                  ownedChannels.slice(0, 5).map((channel) => (
                    <button
                      key={`owned-${channel.id}`}
                      type="button"
                      className="welcome-link"
                      onClick={() => setActiveChannelId(channel.id)}
                    >
                      #{channel.name}
                    </button>
                  ))
                )}
              </div>

              <div>
                <h4>最近加入</h4>
                {joinedChannels.length === 0 ? (
                  <div className="welcome-empty">尚未加入頻道</div>
                ) : (
                  joinedChannels.slice(0, 5).map((channel) => (
                    <button
                      key={`joined-${channel.id}`}
                      type="button"
                      className="welcome-link"
                      onClick={() => setActiveChannelId(channel.id)}
                    >
                      {channel.ownerName}@{channel.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="message-list">
              {messages.length === 0 ? (
                <div className="message-empty">還沒有訊息</div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={`${msg.timestamp}-${msg.sender}-${idx}`} className="message-card">
                    <div
                      className={
                        `message-content-box ${msg.sender === currentUserName ? 'msg-cyan' : 'msg-pink'}`
                      }
                    >
                      <div
                        className={`message-user ${msg.sender === currentUserName ? 'text-cyan' : 'text-pink'}`}
                      >
                        {msg.sender}
                      </div>
                      <div className="message-text">{msg.content}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="input-area">
              <input
                type="text"
                className="neon-input"
                placeholder="Input text"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleSend();
                  }
                }}
              />
              <button className="send-btn-glow" onClick={handleSend}>
                SEND
              </button>
            </div>
          </>
        )}
      </main>

      <aside className="neon-members">
        <div className="members-title">Members</div>
        <div className="member-list">
          {members.length === 0 ? (
            <div className="member-item">
              <div className="member-name">尚未載入</div>
            </div>
          ) : (
            members.map((member) => (
              <div key={`${member.id}-${member.name}`} className="member-item">
                <div className="status-dot dot-cyan"></div>
                <div className="member-name glow-cyan">{member.name}</div>
              </div>
            ))
          )}
        </div>
      </aside>

      {showProfile ? (
        <div
          className="profile-overlay"
          onClick={() => {
            setShowProfile(false);
            setProfileError('');
            setProfileMessage('');
          }}
        >
          <div
            className="profile-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>個人檔案</h3>
            <div className="profile-field">
              <label htmlFor="profile-name">名稱</label>
              <input
                id="profile-name"
                type="text"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder="Name"
              />
            </div>
            <div className="profile-field">
              <label htmlFor="profile-email">Email</label>
              <input
                id="profile-email"
                type="email"
                value={profileEmail}
                onChange={(event) => setProfileEmail(event.target.value)}
                placeholder="Email"
              />
            </div>
            <div className="profile-field">
              <label htmlFor="profile-password">新密碼</label>
              <input
                id="profile-password"
                type="password"
                value={profilePassword}
                onChange={(event) => setProfilePassword(event.target.value)}
                placeholder="不修改可留空"
              />
            </div>

            {profileError ? <div className="profile-alert error">{profileError}</div> : null}
            {profileMessage ? <div className="profile-alert success">{profileMessage}</div> : null}

            <div className="profile-actions">
              <button type="button" className="profile-save" onClick={handleProfileSave} disabled={profileLoading}>
                {profileLoading ? 'Saving...' : '保存'}
              </button>
              <button
                type="button"
                className="profile-cancel"
                onClick={() => setShowProfile(false)}
                disabled={profileLoading}
              >
                關閉
              </button>
              <button
                type="button"
                className="profile-logout"
                onClick={onLogout}
                disabled={profileLoading}
              >
                登出
              </button>
              <button
                type="button"
                className="profile-delete"
                onClick={handleDeleteAccount}
                disabled={profileLoading}
              >
                刪除帳號
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
