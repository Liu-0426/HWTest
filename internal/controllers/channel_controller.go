package controllers

import (
	"net/http"
	"strings"

	"webFianlBackend/internal/middleware"
	"webFianlBackend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ChannelController struct {
	DB *gorm.DB
}

type channelPayload struct {
	Name string `json:"name" binding:"required"`
}

func (cc *ChannelController) ListMine(c *gin.Context) {
	userID := c.GetUint(middleware.ContextUserIDKey)

	var channels []models.Channel
	if err := cc.DB.Where("owner_id = ?", userID).Preload("Owner").Find(&channels).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list channels failed"})
		return
	}

	c.JSON(http.StatusOK, channels)
}

func (cc *ChannelController) Create(c *gin.Context) {
	userID := c.GetUint(middleware.ContextUserIDKey)

	var payload channelPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	channel := models.Channel{
		Name:    payload.Name,
		OwnerID: userID,
	}

	if err := cc.DB.Create(&channel).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "channel already exists"})
		return
	}

	_ = cc.DB.FirstOrCreate(&models.ChannelMember{}, models.ChannelMember{
		ChannelID: channel.ID,
		UserID:    userID,
	})

	c.JSON(http.StatusCreated, channel)
}

// Search requires query format "owner@channel".
func (cc *ChannelController) Search(c *gin.Context) {
	query := c.Query("query")
	if query == "" || !strings.Contains(query, "@") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query must be owner@channel"})
		return
	}

	parts := strings.SplitN(query, "@", 2)
	ownerName := parts[0]
	channelName := parts[1]
	if ownerName == "" || channelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query must be owner@channel"})
		return
	}

	var owner models.User
	if err := cc.DB.Where("username = ?", ownerName).First(&owner).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "owner not found"})
		return
	}

	var channel models.Channel
	if err := cc.DB.Where("owner_id = ? AND name = ?", owner.ID, channelName).Preload("Owner").First(&channel).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}

	c.JSON(http.StatusOK, channel)
}

func (cc *ChannelController) ListJoined(c *gin.Context) {
	userID := c.GetUint(middleware.ContextUserIDKey)

	var channels []models.Channel
	if err := cc.DB.
		Joins("JOIN channel_members ON channel_members.channel_id = channels.id").
		Where("channel_members.user_id = ? AND channels.owner_id <> ?", userID, userID).
		Preload("Owner").
		Find(&channels).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list joined channels failed"})
		return
	}

	c.JSON(http.StatusOK, channels)
}

func (cc *ChannelController) Join(c *gin.Context) {
	userID := c.GetUint(middleware.ContextUserIDKey)
	channelID := c.Param("id")

	var channel models.Channel
	if err := cc.DB.Where("id = ?", channelID).Preload("Owner").First(&channel).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}

	_ = cc.DB.FirstOrCreate(&models.ChannelMember{}, models.ChannelMember{
		ChannelID: channel.ID,
		UserID:    userID,
	})

	c.JSON(http.StatusOK, channel)
}

func (cc *ChannelController) ListMembers(c *gin.Context) {
	userID := c.GetUint(middleware.ContextUserIDKey)
	channelID := c.Param("id")

	var channel models.Channel
	if err := cc.DB.Where("id = ?", channelID).First(&channel).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}

	var membership models.ChannelMember
	if err := cc.DB.Where("channel_id = ? AND user_id = ?", channel.ID, userID).First(&membership).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
		return
	}

	var members []models.User
	if err := cc.DB.Table("users").
		Select("users.id, users.username, users.email, users.created_at").
		Joins("JOIN channel_members ON channel_members.user_id = users.id").
		Where("channel_members.channel_id = ?", channel.ID).
		Order("users.username").
		Find(&members).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list members failed"})
		return
	}

	c.JSON(http.StatusOK, members)
}

func (cc *ChannelController) Delete(c *gin.Context) {
	userID := c.GetUint(middleware.ContextUserIDKey)
	channelID := c.Param("id")

	var channel models.Channel
	if err := cc.DB.Where("id = ?", channelID).First(&channel).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}
	if channel.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "not the owner"})
		return
	}

	_ = cc.DB.Where("channel_id = ?", channel.ID).Delete(&models.ChannelMember{}).Error
	if err := cc.DB.Delete(&channel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete channel failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
