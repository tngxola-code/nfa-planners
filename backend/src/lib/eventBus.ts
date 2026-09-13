export interface RealtimeEvent {
  type: "notification" | "ingest_status";
  payload: unknown;
}

type Listener = (event: RealtimeEvent) => void;

export class EventBus {
  private readonly channels = new Map<string, Set<Listener>>();

  subscribe(channel: string, listener: Listener): () => void {
    let listeners = this.channels.get(channel);

    if (!listeners) {
      listeners = new Set();
      this.channels.set(channel, listeners);
    }

    listeners.add(listener);
    return () => this.unsubscribe(channel, listener);
  }

  unsubscribe(channel: string, listener: Listener): void {
    const listeners = this.channels.get(channel);

    if (!listeners) {
      return;
    }

    listeners.delete(listener);

    if (listeners.size === 0) {
      this.channels.delete(channel);
    }
  }

  publish(channel: string, event: RealtimeEvent): void {
    const listeners = this.channels.get(channel);

    if (!listeners) {
      return;
    }

    for (const listener of [...listeners]) {
      listener(event);
    }
  }

  listenerCount(channel: string): number {
    return this.channels.get(channel)?.size ?? 0;
  }

  isIdle(channel: string): boolean {
    return !this.channels.has(channel);
  }
}

export const userChannel = (userId: string): string => `user:${userId}`;
