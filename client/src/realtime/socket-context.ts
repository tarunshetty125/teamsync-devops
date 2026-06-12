import { createContext } from "react";
import { Socket } from "socket.io-client";
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./socket-events";

export type TeamSyncSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type SocketContextValue = {
  socket: TeamSyncSocket | null;
  isConnected: boolean;
  onlineUserIds: string[];
  isUserOnline: (userId?: string | null) => boolean;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  joinTask: (taskId: string) => void;
  leaveTask: (taskId: string) => void;
};

export const SocketContext = createContext<SocketContextValue | undefined>(
  undefined
);
