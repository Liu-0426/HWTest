package ws

import (
	"sync"
)

type Hub struct {
	channelID uint
	clients   map[*Client]bool
	broadcast chan []byte
	register  chan *Client
	unregister chan *Client
}

func newHub(channelID uint) *Hub {
	return &Hub{
		channelID: channelID,
		clients:   make(map[*Client]bool),
		broadcast: make(chan []byte),
		register:  make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					delete(h.clients, client)
					close(client.send)
				}
			}
		}
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

type Manager struct {
	mu   sync.Mutex
	hubs map[uint]*Hub
}

func NewManager() *Manager {
	return &Manager{
		hubs: make(map[uint]*Hub),
	}
}

func (m *Manager) Get(channelID uint) *Hub {
	m.mu.Lock()
	defer m.mu.Unlock()

	if hub, ok := m.hubs[channelID]; ok {
		return hub
	}

	hub := newHub(channelID)
	m.hubs[channelID] = hub
	go hub.run()
	return hub
}
