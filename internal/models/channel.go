package models

import "time"

type Channel struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:64;index:idx_owner_name,unique;not null" json:"name"`
	OwnerID   uint      `gorm:"index:idx_owner_name,unique;not null" json:"owner_id"`
	Owner     User      `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}
