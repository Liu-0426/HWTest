package ws

import (
	"encoding/json"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
)

type Message struct {
	Sender    string `json:"sender"`
	Content   string `json:"content"`
	Timestamp int64  `json:"timestamp"`
}

type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	username string
}

func NewClient(hub *Hub, conn *websocket.Conn, username string) *Client {
	return &Client{
		hub:      hub,
		conn:     conn,
		send:     make(chan []byte, 256),
		username: username,
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(1024)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, payload, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		msg := Message{
			Sender:    c.username,
			Content:   string(payload),
			Timestamp: time.Now().Unix(),
		}
		encoded, _ := json.Marshal(msg)
		c.hub.broadcast <- encoded
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
