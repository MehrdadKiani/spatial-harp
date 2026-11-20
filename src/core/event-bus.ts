type EventHandler<T = any> = (data: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  public on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Return unbind function
    return () => this.off(event, handler);
  }

  public off<T = any>(event: string, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<T = any>(event: string, data: T): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`Error in event handler for "${event}":`, err);
        }
      });
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const globalBus = new EventBus();
