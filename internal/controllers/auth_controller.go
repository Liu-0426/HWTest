package controllers

import (
	"net/http"
	"time"

	"webFianlBackend/internal/middleware"
	"webFianlBackend/internal/models"
	"webFianlBackend/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AuthController struct {
	DB        *gorm.DB
	JWTSecret string
}

const authCookieName = "auth_token"

func setAuthCookie(c *gin.Context, token string) {
	secure := c.Request.TLS != nil
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(authCookieName, token, int((24 * time.Hour).Seconds()), "/", "", secure, true)
}

func clearAuthCookie(c *gin.Context) {
	secure := c.Request.TLS != nil
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(authCookieName, "", -1, "/", "", secure, true)
}

type authPayload struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password" binding:"required"`
}

func (a *AuthController) Register(c *gin.Context) {
	var payload authPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if payload.Name == "" || payload.Email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and email are required"})
		return
	}

	var existing models.User
	if err := a.DB.Where("username = ? OR email = ?", payload.Name, payload.Email).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "name or email already exists"})
		return
	}

	hash, err := utils.HashPassword(payload.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "password hash failed"})
		return
	}

	user := models.User{
		Username: payload.Name,
		Email:    payload.Email,
		Password: hash,
	}
	if err := a.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create user failed"})
		return
	}

	token, err := utils.GenerateToken(user.ID, user.Username, a.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	setAuthCookie(c, token)
	c.JSON(http.StatusCreated, gin.H{"user": user})
}

func (a *AuthController) Login(c *gin.Context) {
	var payload authPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if payload.Email == "" && payload.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email or name is required"})
		return
	}

	var user models.User
	if payload.Email != "" {
		if err := a.DB.Where("email = ?", payload.Email).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
	} else {
		if err := a.DB.Where("username = ?", payload.Name).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
	}

	if !utils.CheckPassword(user.Password, payload.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := utils.GenerateToken(user.ID, user.Username, a.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	setAuthCookie(c, token)
	c.JSON(http.StatusOK, gin.H{"user": user})
}

type profileUpdatePayload struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (a *AuthController) Me(c *gin.Context) {
	userID := c.GetUint(middleware.ContextUserIDKey)

	var user models.User
	if err := a.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (a *AuthController) UpdateMe(c *gin.Context) {
	userID := c.GetUint(middleware.ContextUserIDKey)

	var payload profileUpdatePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if payload.Name == "" && payload.Email == "" && payload.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no updates provided"})
		return
	}

	var user models.User
	if err := a.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if payload.Name != "" && payload.Name != user.Username {
		var existing models.User
		if err := a.DB.Where("username = ? AND id <> ?", payload.Name, user.ID).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "name already exists"})
			return
		}
		user.Username = payload.Name
	}

	if payload.Email != "" && payload.Email != user.Email {
		var existing models.User
		if err := a.DB.Where("email = ? AND id <> ?", payload.Email, user.ID).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
			return
		}
		user.Email = payload.Email
	}

	if payload.Password != "" {
		hash, err := utils.HashPassword(payload.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "password hash failed"})
			return
		}
		user.Password = hash
	}

	if err := a.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update profile failed"})
		return
	}

	token, err := utils.GenerateToken(user.ID, user.Username, a.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	setAuthCookie(c, token)
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (a *AuthController) DeleteMe(c *gin.Context) {
	userID := c.GetUint(middleware.ContextUserIDKey)

	err := a.DB.Transaction(func(tx *gorm.DB) error {
		var ownedChannels []models.Channel
		if err := tx.Where("owner_id = ?", userID).Find(&ownedChannels).Error; err != nil {
			return err
		}

		if len(ownedChannels) > 0 {
			var channelIDs []uint
			for _, ch := range ownedChannels {
				channelIDs = append(channelIDs, ch.ID)
			}
			if err := tx.Where("channel_id IN ?", channelIDs).Delete(&models.ChannelMember{}).Error; err != nil {
				return err
			}
			if err := tx.Where("owner_id = ?", userID).Delete(&models.Channel{}).Error; err != nil {
				return err
			}
		}

		if err := tx.Where("user_id = ?", userID).Delete(&models.ChannelMember{}).Error; err != nil {
			return err
		}

		if err := tx.Where("id = ?", userID).Delete(&models.User{}).Error; err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete account failed"})
		return
	}

	clearAuthCookie(c)
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (a *AuthController) Logout(c *gin.Context) {
	clearAuthCookie(c)
	c.JSON(http.StatusOK, gin.H{"status": "logged_out"})
}
