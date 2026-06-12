import { PresenceRealtimePayload } from "./realtime.types";

type SocketPresence = {
  userId: string;
  workspaceIds: Set<string>;
};

class PresenceRegistry {
  private countsByWorkspaceUser = new Map<string, number>();
  private socketPresence = new Map<string, SocketPresence>();

  connect(
    socketId: string,
    userId: string,
    workspaceIds: string[]
  ): PresenceRealtimePayload[] {
    const timestamp = new Date().toISOString();
    const onlineEvents: PresenceRealtimePayload[] = [];
    const uniqueWorkspaceIds = Array.from(new Set(workspaceIds));

    this.socketPresence.set(socketId, {
      userId,
      workspaceIds: new Set(uniqueWorkspaceIds),
    });

    for (const workspaceId of uniqueWorkspaceIds) {
      const key = this.getKey(workspaceId, userId);
      const currentCount = this.countsByWorkspaceUser.get(key) || 0;
      this.countsByWorkspaceUser.set(key, currentCount + 1);

      if (currentCount === 0) {
        onlineEvents.push({ userId, workspaceId, timestamp });
      }
    }

    return onlineEvents;
  }

  disconnect(socketId: string): PresenceRealtimePayload[] {
    const timestamp = new Date().toISOString();
    const offlineEvents: PresenceRealtimePayload[] = [];
    const presence = this.socketPresence.get(socketId);

    if (!presence) {
      return offlineEvents;
    }

    this.socketPresence.delete(socketId);

    for (const workspaceId of presence.workspaceIds) {
      const key = this.getKey(workspaceId, presence.userId);
      const nextCount = Math.max((this.countsByWorkspaceUser.get(key) || 0) - 1, 0);

      if (nextCount === 0) {
        this.countsByWorkspaceUser.delete(key);
        offlineEvents.push({
          userId: presence.userId,
          workspaceId,
          timestamp,
        });
      } else {
        this.countsByWorkspaceUser.set(key, nextCount);
      }
    }

    return offlineEvents;
  }

  getOnlineUserIds(workspaceId: string): string[] {
    const prefix = `${workspaceId}:`;
    const onlineUserIds: string[] = [];

    for (const [key, count] of this.countsByWorkspaceUser.entries()) {
      if (count > 0 && key.startsWith(prefix)) {
        onlineUserIds.push(key.slice(prefix.length));
      }
    }

    return onlineUserIds;
  }

  resetForTest() {
    this.countsByWorkspaceUser.clear();
    this.socketPresence.clear();
  }

  private getKey(workspaceId: string, userId: string) {
    return `${workspaceId}:${userId}`;
  }
}

export const presenceRegistry = new PresenceRegistry();
