import type { PrismaClient } from "@prisma/client";
import {
  buildDigestEmail,
  consoleEmailSender,
  type EmailSender,
} from "../lib/digestEmail.js";
import type {
  NotificationDto,
  NotificationKind,
  NotificationList,
} from "../types/notification.js";

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
}

function toDto(notification: NotificationRow): NotificationDto {
  return {
    id: notification.id,
    kind: notification.kind as NotificationKind,
    title: notification.title,
    body: notification.body,
    read: notification.readAt !== null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export interface NotificationListOptions {
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
}

export class NotificationsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly email: EmailSender = consoleEmailSender,
  ) {}

  async record(
    userId: string,
    kind: NotificationKind,
    title: string,
    body: string,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId,
        kind,
        title,
        body,
      },
    });
  }

  async list(
    userId: string,
    options: NotificationListOptions = {},
  ): Promise<NotificationList> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

    const where = {
      userId,
      ...(options.unreadOnly ? { readAt: null } : {}),
    };

    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(options.cursor
          ? {
              cursor: { id: options.cursor },
              skip: 1,
            }
          : {}),
      }),
      this.prisma.notification.count({
        where: {
          userId,
          readAt: null,
        },
      }),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: page.map(toDto),
      unreadCount,
      nextCursor: hasMore && page.length ? page[page.length - 1].id : null,
    };
  }

  async markRead(userId: string, ids?: string[]): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
        ...(ids?.length
          ? {
              id: {
                in: ids,
              },
            }
          : {}),
      },
      data: {
        readAt: new Date(),
      },
    });

    return result.count;
  }

  async sendDigest(digestWindowHours = 24): Promise<{ sent: number }> {
    const since = new Date(Date.now() - digestWindowHours * 3_600_000);

    const users = await this.prisma.user.findMany({
      where: {
        status: "active",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    let sent = 0;

    for (const user of users) {
      const recent = await this.prisma.notification.findMany({
        where: {
          userId: user.id,
          readAt: null,
          createdAt: {
            gte: since,
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
      });

      if (!recent.length) continue;

      const { subject, html } = buildDigestEmail(
        user.name || user.email,
        recent.map(toDto),
      );

      await this.email.send(user.email, subject, html);
      sent += 1;
    }

    return { sent };
  }
}
