import { describe, expect, it } from "vitest";
import { EventBus, userChannel } from "../../src/lib/eventBus.js";

describe("EventBus", () => {
  it("delivers events only to the target user channel", () => {
    const bus = new EventBus();
    const receivedA: string[] = [];
    const receivedB: string[] = [];

    bus.subscribe(userChannel("a"), (event) => {
      receivedA.push(JSON.stringify(event.payload));
    });

    bus.subscribe(userChannel("b"), (event) => {
      receivedB.push(JSON.stringify(event.payload));
    });

    bus.publish(userChannel("a"), {
      type: "notification",
      payload: { title: "hi" },
    });

    expect(receivedA).toEqual(['{"title":"hi"}']);
    expect(receivedB).toEqual([]);
  });

  it("unsubscribe stops delivery and removes the channel", () => {
    const bus = new EventBus();

    const unsubscribe = bus.subscribe(userChannel("a"), () => undefined);

    expect(bus.listenerCount(userChannel("a"))).toBe(1);

    unsubscribe();

    expect(bus.listenerCount(userChannel("a"))).toBe(0);
    expect(bus.isIdle(userChannel("a"))).toBe(true);
  });

  it("publishing to an idle channel is a no-op", () => {
    const bus = new EventBus();

    expect(() =>
      bus.publish(userChannel("nobody"), {
        type: "notification",
        payload: {},
      }),
    ).not.toThrow();
  });
});
