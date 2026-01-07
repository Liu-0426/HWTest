package main

import (
	"log"

	"webFianlBackend/internal/config"
	"webFianlBackend/internal/db"
	"webFianlBackend/internal/routes"
)

func main() {
	cfg := config.Load()
	if cfg.JWTSecret == "change-me" {
		log.Fatal("JWT_SECRET must be set to a non-default value")
	}
	conn := db.Init(cfg.DBDSN)

	router := routes.SetupRouter(conn, cfg.JWTSecret, cfg.CORSOrigins)
	if err := router.Run(cfg.Addr); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
