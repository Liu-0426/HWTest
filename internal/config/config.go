package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBDSN     string
	JWTSecret string
	Addr      string
	CORSOrigins string
}

func Load() Config {
	_ = godotenv.Load()
	return Config{
		DBDSN:     getenv("DB_DSN", "root:password@tcp(127.0.0.1:3306)/irc?charset=utf8mb4&parseTime=True&loc=Local"),
		JWTSecret: getenv("JWT_SECRET", "change-me"),
		Addr:      getenv("ADDR", ":8080"),
		CORSOrigins: getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
