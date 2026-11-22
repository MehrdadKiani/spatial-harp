import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../src/core/event-bus';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('notifies subscribers when events are emitted', () => {
    const handler = vi.fn();
    bus.on('test:event', handler);

    bus.emit('test:event', { value: 42 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it('isolates different event channels', () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();

    bus.on('channel:A', handlerA);
    bus.on('channel:B', handlerB);

    bus.emit('channel:A', 'payloadA');
    expect(handlerA).toHaveBeenCalledWith('payloadA');
    expect(handlerB).not.toHaveBeenCalled();
  });

  it('unsubscribes using the returned cleanup function', () => {
    const handler = vi.fn();
    const unsubscribe = bus.on('test:event', handler);

    bus.emit('test:event', 1);
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    bus.emit('test:event', 2);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes explicitly using off()', () => {
    const handler = vi.fn();
    bus.on('test:event', handler);

    bus.off('test:event', handler);
    bus.emit('test:event', 'data');
    expect(handler).not.toHaveBeenCalled();
  });

  it('handles errors inside handlers gracefully without breaking other listeners', () => {
    const faultyHandler = vi.fn(() => {
      throw new Error('Handler exception');
    });
    const healthyHandler = vi.fn();

    // Silence expected console.error during test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    bus.on('test:event', faultyHandler);
    bus.on('test:event', healthyHandler);

    expect(() => bus.emit('test:event', 'payload')).not.toThrow();
    expect(faultyHandler).toHaveBeenCalled();
    expect(healthyHandler).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('clears all listeners on clear()', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on('event1', handler1);
    bus.on('event2', handler2);

    bus.clear();

    bus.emit('event1', 1);
    bus.emit('event2', 2);

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });
});
