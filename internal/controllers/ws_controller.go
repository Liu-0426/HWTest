package controllers

import (
	"net/http"
	"strconv"

	"webFianlBackend/internal/middleware"
	"webFianlBackend/internal/models"
	"webFianlBackend/internal/ws"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
)

type WSController struct {
	DB      *gorm.DB
	Manager *ws.Manager
	AllowedOrigins map[string]bool
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func (wc *WSController) Serve(c *gin.Context) {
	userID := c.GetUint(middleware.ContextUserIDKey)
	username := c.GetString(middleware.ContextUsernameKey)

	channelID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel id"})
		return
	}

	var channel models.Channel
	if err := wc.DB.Where("id = ?", channelID).First(&channel).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}

	if channel.OwnerID != userID {
		var membership models.ChannelMember
		if err := wc.DB.Where("channel_id = ? AND user_id = ?", channel.ID, userID).First(&membership).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
			return
		}
	}

	upgrader.CheckOrigin = func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return false
		}
		return wc.AllowedOrigins[origin]
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	hub := wc.Manager.Get(uint(channelID))
	client := ws.NewClient(hub, conn, username)
	hub.Register(client)

	go client.WritePump()
	client.ReadPump()

	_ = userID
}
