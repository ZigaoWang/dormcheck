type Listener = (data: string) => void;

class SSEBroadcaster {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  broadcast(event: string, data: unknown) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const listener of this.listeners) {
      listener(message);
    }
  }
}

export const sse = new SSEBroadcaster();
