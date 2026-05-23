const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

function initializeRealtime(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Authentication required."));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      return next();
    } catch (error) {
      return next(new Error("Invalid token."));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user?.id;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on("social:subscribe", () => {
      socket.join("social:live");
    });

    socket.on("social:unsubscribe", () => {
      socket.leave("social:live");
    });
  });

  return io;
}

function emitUserRefresh(userId, payload = {}) {
  if (!io) {
    return;
  }

  io.to(`user:${userId}`).emit("user:refresh", {
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

function emitSocialEvent(eventName, payload = {}) {
  if (!io) {
    return;
  }

  io.to("social:live").emit(eventName, {
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

module.exports = {
  initializeRealtime,
  emitUserRefresh,
  emitSocialEvent,
};
