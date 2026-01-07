package routes

import (
	"strings"
	"time"

	"webFianlBackend/internal/controllers"
	"webFianlBackend/internal/middleware"
	"webFianlBackend/internal/ws"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupRouter(db *gorm.DB, jwtSecret string, corsOrigins string) *gin.Engine {
	router := gin.Default()
	origins := strings.Split(corsOrigins, ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}
	originMap := make(map[string]bool)
	for _, origin := range origins {
		if origin != "" {
			originMap[origin] = true
		}
	}
	router.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	authController := &controllers.AuthController{
		DB:        db,
		JWTSecret: jwtSecret,
	}
	channelController := &controllers.ChannelController{DB: db}
	wsController := &controllers.WSController{
		DB:      db,
		Manager: ws.NewManager(),
		AllowedOrigins: originMap,
	}

	api := router.Group("/api")
	authLimiter := middleware.NewRateLimiter(10, 5*time.Minute)
	api.POST("/register", middleware.RateLimit(authLimiter), authController.Register)
	api.POST("/login", middleware.RateLimit(authLimiter), authController.Login)

	authGroup := api.Group("")
	authGroup.Use(middleware.Auth(jwtSecret))
	authGroup.GET("/channels", channelController.ListMine)
	authGroup.GET("/channels/joined", channelController.ListJoined)
	authGroup.POST("/channels", channelController.Create)
	authGroup.GET("/channels/search", channelController.Search)
	authGroup.POST("/channels/:id/join", channelController.Join)
	authGroup.GET("/channels/:id/members", channelController.ListMembers)
	authGroup.DELETE("/channels/:id", channelController.Delete)
	authGroup.GET("/me", authController.Me)
	authGroup.PUT("/me", authController.UpdateMe)
	authGroup.DELETE("/me", authController.DeleteMe)
	authGroup.POST("/logout", authController.Logout)

	router.GET("/ws/:id", middleware.Auth(jwtSecret), wsController.Serve)

	return router
}
