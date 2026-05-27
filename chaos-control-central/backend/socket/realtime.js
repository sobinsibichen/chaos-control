const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const { URL } = require("url");

const userConnections = new Map();
let wss;

function addUserConnection(userId, socket) {
  const key = String(userId);
  const connections = userConnections.get(key) || new Set();
  connections.add(socket);
  userConnections.set(key, connections);
}

function removeUserConnection(userId, socket) {
  const key = String(userId);
  const connections = userConnections.get(key);
  if (!connections) {
    return;
  }
  connections.delete(socket);
  if (!connections.size) {
    userConnections.delete(key);
  }
}

function sendMessage(socket, message) {
  if (socket.readyState !== 1) {
    return;
  }
  socket.send(JSON.stringify(message));
}

function initializeRealtime(server) {
  wss = new WebSocketServer({ server, path: "/realtime" });

  wss.on("connection", (socket, request) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get("token");
      if (!token) {
        sendMessage(socket, { type: "error", payload: { message: "Authentication required." } });
        socket.close(4001, "Authentication required");
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      const userId = socket.user?.id;
      if (userId) {
        addUserConnection(userId, socket);
      }
      sendMessage(socket, { type: "ready", payload: { timestamp: new Date().toISOString() } });
    } catch (error) {
      sendMessage(socket, { type: "error", payload: { message: "Invalid token." } });
      socket.close(4002, "Invalid token");
      return;
    }

    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(String(raw));
        if (message.type === "ping") {
          sendMessage(socket, { type: "pong", payload: { timestamp: new Date().toISOString() } });
        }
      } catch {
        sendMessage(socket, { type: "error", payload: { message: "Invalid realtime message." } });
      }
    });

    socket.on("close", () => {
      if (socket.user?.id) {
        removeUserConnection(socket.user.id, socket);
      }
    });
  });

  const heartbeat = setInterval(() => {
    if (!wss) {
      return;
    }

    for (const socket of wss.clients) {
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }

      socket.isAlive = false;
      socket.ping();
    }
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  return wss;
}

function emitUserRefresh(userId, payload = {}) {
  if (!wss) {
    return;
  }

  const connections = userConnections.get(String(userId));
  connections?.forEach((socket) => {
    sendMessage(socket, {
      type: "user:refresh",
      payload: {
        timestamp: new Date().toISOString(),
        ...payload,
      },
    });
  });
}

function emitSocialEvent(eventName, payload = {}) {
  if (!wss) {
    return;
  }

  for (const socket of wss.clients) {
    sendMessage(socket, {
      type: "social:event",
      event: eventName,
      payload: {
        timestamp: new Date().toISOString(),
        ...payload,
      },
    });
  }
}

module.exports = {
  initializeRealtime,
  emitUserRefresh,
  emitSocialEvent,
};
