import { Server as HTTPServer } from "http";
import { Server as IOServer } from "socket.io";

let io: IOServer | null = null;

export function initSocket(httpServer: HTTPServer) {
  io = new IOServer(httpServer, {
    cors: {
      origin: process.env.WEB_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join cycle room for live updates
    socket.on("join:cycle", (cycleId: string) => {
      socket.join(`cycle:${cycleId}`);
      console.log(`${socket.id} joined cycle:${cycleId}`);
    });

    socket.on("leave:cycle", (cycleId: string) => {
      socket.leave(`cycle:${cycleId}`);
    });

    // Join order room for status tracking
    socket.on("join:order", (orderId: string) => {
      socket.join(`order:${orderId}`);
    });

    socket.on("leave:order", (orderId: string) => {
      socket.leave(`order:${orderId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): IOServer | null {
  return io;
}
