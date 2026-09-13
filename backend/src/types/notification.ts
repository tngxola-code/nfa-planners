export type NotificationKind =
  "match" | "ingest" | "expiry" | "briefing" | "system";

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationList {
  data: NotificationDto[];
  unreadCount: number;
  nextCursor: string | null;
}
