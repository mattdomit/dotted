"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:4000";

let sharedSocket: Socket | null = null;
let refCount = 0;

function getSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  refCount++;
  return sharedSocket;
}

function releaseSocket() {
  refCount--;
  if (refCount <= 0 && sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
    refCount = 0;
  }
}

interface UseSocketReturn {
  socket: React.RefObject<Socket | null>;
  joinCycle: (cycleId: string) => void;
  leaveCycle: (cycleId: string) => void;
  joinOrder: (orderId: string) => void;
  leaveOrder: (orderId: string) => void;
  on: (event: string, handler: (...args: any[]) => void) => () => void;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = getSocket();
    return () => {
      releaseSocket();
      socketRef.current = null;
    };
  }, []);

  const joinCycle = useCallback((cycleId: string) => {
    socketRef.current?.emit("join:cycle", cycleId);
  }, []);

  const leaveCycle = useCallback((cycleId: string) => {
    socketRef.current?.emit("leave:cycle", cycleId);
  }, []);

  const joinOrder = useCallback((orderId: string) => {
    socketRef.current?.emit("join:order", orderId);
  }, []);

  const leaveOrder = useCallback((orderId: string) => {
    socketRef.current?.emit("leave:order", orderId);
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  return { socket: socketRef, joinCycle, leaveCycle, joinOrder, leaveOrder, on };
}
