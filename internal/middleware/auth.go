package middleware

import (
	"net/http"
	"strings"

	"webFianlBackend/internal/utils"

	"github.com/gin-gonic/gin"
)

const (
	ContextUserIDKey   = "userID"
	ContextUsernameKey = "username"
)

func Auth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		tokenValue := ""
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header"})
				return
			}
			tokenValue = parts[1]
		} else {
			if cookie, err := c.Cookie("auth_token"); err == nil {
				tokenValue = cookie
			}
		}

		if tokenValue == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			return
		}

		claims, err := utils.ParseToken(tokenValue, secret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		c.Set(ContextUserIDKey, claims.UserID)
		c.Set(ContextUsernameKey, claims.Username)
		c.Next()
	}
}
