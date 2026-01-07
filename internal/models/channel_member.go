package models

import "time"

type ChannelMember struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ChannelID uint      `gorm:"index:idx_channel_user,unique;not null" json:"channel_id"`
	UserID    uint      `gorm:"index:idx_channel_user,unique;not null" json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}
