import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "http";
import express from "express";
import { Server as IOServer } from "socket.io";
import { io as ioc, Socket } from "socket.io-client";

describe("WebSocket — socket.io", () => {
  let httpServer: ReturnType<typeof createServer>;
  let ioServer: IOServer;
  let port: number;

  beforeAll(async () => {
    const app = express();
    httpServer = createServer(app);

    ioServer = new IOServer(httpServer, {
      cors: { origin: "*" },
    });

    ioServer.on("connection", (socket) => {
      socket.on("join:cycle", (cycleId: string) => {
        socket.join(`cycle:${cycleId}`);
      });
      socket.on("leave:cycle", (cycleId: string) => {
        socket.leave(`cycle:${cycleId}`);
      });
      socket.on("join:order", (orderId: string) => {
        socket.join(`order:${orderId}`);
      });
      socket.on("leave:order", (orderId: string) => {
        socket.leave(`order:${orderId}`);
      });
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        port = typeof addr === "object" ? addr!.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    ioServer.close();
    httpServer.close();
  });

  function createClient(): Promise<Socket> {
    return new Promise((resolve) => {
      const client = ioc(`http://localhost:${port}`, { transports: ["websocket"] });
      client.on("connect", () => resolve(client));
    });
  }

  it("should connect a client", async () => {
    const client = await createClient();
    expect(client.connected).toBe(true);
    client.disconnect();
  });

  it("should emit vote:update to cycle room", async () => {
    const client = await createClient();
    const cycleId = "test-cycle-1";

    client.emit("join:cycle", cycleId);
    await new Promise((r) => setTimeout(r, 100));

    const received = new Promise<any>((resolve) => {
      client.on("vote:update", (data) => resolve(data));
    });

    ioServer.to(`cycle:${cycleId}`).emit("vote:update", { cycleId, dishId: "d1", voteCount: 5, totalVotes: 10 });

    const data = await received;
    expect(data.cycleId).toBe(cycleId);
    expect(data.voteCount).toBe(5);
    client.disconnect();
  });

  it("should emit bid:update to cycle room", async () => {
    const client = await createClient();
    const cycleId = "test-cycle-2";

    client.emit("join:cycle", cycleId);
    await new Promise((r) => setTimeout(r, 100));

    const received = new Promise<any>((resolve) => {
      client.on("bid:update", (data) => resolve(data));
    });

    ioServer.to(`cycle:${cycleId}`).emit("bid:update", { cycleId, bidCount: 3 });

    const data = await received;
    expect(data.bidCount).toBe(3);
    client.disconnect();
  });

  it("should emit order:status to order room", async () => {
    const client = await createClient();
    const orderId = "test-order-1";

    client.emit("join:order", orderId);
    await new Promise((r) => setTimeout(r, 100));

    const received = new Promise<any>((resolve) => {
      client.on("order:status", (data) => resolve(data));
    });

    ioServer.to(`order:${orderId}`).emit("order:status", { orderId, status: "CONFIRMED" });

    const data = await received;
    expect(data.status).toBe("CONFIRMED");
    client.disconnect();
  });

  it("should emit cycle:status to cycle room", async () => {
    const client = await createClient();
    const cycleId = "test-cycle-3";

    client.emit("join:cycle", cycleId);
    await new Promise((r) => setTimeout(r, 100));

    const received = new Promise<any>((resolve) => {
      client.on("cycle:status", (data) => resolve(data));
    });

    ioServer.to(`cycle:${cycleId}`).emit("cycle:status", { cycleId, status: "BIDDING" });

    const data = await received;
    expect(data.status).toBe("BIDDING");
    client.disconnect();
  });

  it("should isolate rooms — client not in room doesn't receive events", async () => {
    const client1 = await createClient();
    const client2 = await createClient();

    client1.emit("join:cycle", "room-A");
    await new Promise((r) => setTimeout(r, 100));

    let client2Received = false;
    client2.on("vote:update", () => {
      client2Received = true;
    });

    ioServer.to("cycle:room-A").emit("vote:update", { cycleId: "room-A", dishId: "d1", voteCount: 1, totalVotes: 1 });

    await new Promise((r) => setTimeout(r, 200));

    expect(client2Received).toBe(false);

    client1.disconnect();
    client2.disconnect();
  });

  it("should send events to multiple clients in the same room", async () => {
    const client1 = await createClient();
    const client2 = await createClient();
    const cycleId = "shared-room";

    client1.emit("join:cycle", cycleId);
    client2.emit("join:cycle", cycleId);
    await new Promise((r) => setTimeout(r, 100));

    const received1 = new Promise<any>((resolve) => {
      client1.on("cycle:status", (data) => resolve(data));
    });
    const received2 = new Promise<any>((resolve) => {
      client2.on("cycle:status", (data) => resolve(data));
    });

    ioServer.to(`cycle:${cycleId}`).emit("cycle:status", { cycleId, status: "COMPLETED" });

    const [data1, data2] = await Promise.all([received1, received2]);
    expect(data1.status).toBe("COMPLETED");
    expect(data2.status).toBe("COMPLETED");

    client1.disconnect();
    client2.disconnect();
  });

  it("should stop receiving events after leaving a room", async () => {
    const client = await createClient();
    const cycleId = "leave-test";

    client.emit("join:cycle", cycleId);
    await new Promise((r) => setTimeout(r, 100));

    client.emit("leave:cycle", cycleId);
    await new Promise((r) => setTimeout(r, 100));

    let received = false;
    client.on("vote:update", () => {
      received = true;
    });

    ioServer.to(`cycle:${cycleId}`).emit("vote:update", { cycleId, dishId: "d1", voteCount: 1, totalVotes: 1 });
    await new Promise((r) => setTimeout(r, 200));

    expect(received).toBe(false);
    client.disconnect();
  });
});
