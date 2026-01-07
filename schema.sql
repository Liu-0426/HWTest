CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_users_username (username),
  UNIQUE KEY idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS channels (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL,
  owner_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_owner_name (owner_id, name),
  KEY idx_channels_owner_id (owner_id),
  CONSTRAINT fk_channels_owner FOREIGN KEY (owner_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS channel_members (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  channel_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_channel_user (channel_id, user_id),
  KEY idx_channel_members_channel (channel_id),
  KEY idx_channel_members_user (user_id),
  CONSTRAINT fk_channel_members_channel FOREIGN KEY (channel_id) REFERENCES channels (id),
  CONSTRAINT fk_channel_members_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
