package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateEntry struct {
	count     int
	expiresAt time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	window  time.Duration
	limit   int
	entries map[string]rateEntry
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		window:  window,
		limit:   limit,
		entries: make(map[string]rateEntry),
	}
}

func (rl *RateLimiter) Allow(ip string) bool {
	now := time.Now()
	rl.mu.Lock()
	defer rl.mu.Unlock()

	entry, ok := rl.entries[ip]
	if !ok || now.After(entry.expiresAt) {
		rl.entries[ip] = rateEntry{count: 1, expiresAt: now.Add(rl.window)}
		return true
	}

	if entry.count >= rl.limit {
		return false
	}
	entry.count++
	rl.entries[ip] = entry
	return true
}

func RateLimit(rl *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := clientIP(c)
		if !rl.Allow(ip) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many requests"})
			return
		}
		c.Next()
	}
}

func clientIP(c *gin.Context) string {
	if ip := c.ClientIP(); ip != "" {
		return ip
	}
	host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err == nil {
		return host
	}
	return c.Request.RemoteAddr
}
