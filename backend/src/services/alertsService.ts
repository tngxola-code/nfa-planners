import type { PrismaClient } from "@prisma/client";
import { EventBus, userChannel, type RealtimeEvent } from "../lib/eventBus.js";

export interface MatchAlert {
  ocid: string;
  title: string;
  buyer: string;
}

export class AlertsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly bus: EventBus,
  ) {}

  pushToUser(userId: string, event: RealtimeEvent): void {
    this.bus.publish(userChannel(userId), event);
  }

  async notifyMatches(
    users: Array<{ id: string }>,
    matches: MatchAlert[],
  ): Promise<void> {
    if (matches.length === 0 || users.length === 0) {
      return;
    }

    const title =
      matches.length === 1
        ? `New matching tender: ${matches[0].title}`
        : `${matches.length} new matching tenders`;

    const body = matches
      .slice(0, 5)
      .map((match) => `${match.title} - ${match.buyer}`)
      .join("; ");

    for (const user of users) {
      const notification = await this.prisma.notification.create({
        data: {
          userId: user.id,
          kind: "match",
          title,
          body,
        },
      });

      this.pushToUser(user.id, {
        type: "notification",
        payload: {
          id: notification.id,
          kind: "match",
          title,
          body,
          matched: matches.length,
          createdAt: notification.createdAt,
        },
      });
    }
  }
}
