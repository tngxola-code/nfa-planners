const notifications = [
  {
    type: "NEW TENDER",
    title: "UMUZ/11/2026 matched at 96%",
    time: "Today · 08:12",
  },
  {
    type: "BRIEFING REMINDER",
    title: "UMUZ/11/2026 briefing in 3 days",
    time: "Today · 07:00",
  },
  {
    type: "CLOSING DATE REMINDER",
    title: "CED 04/2026-2027 closes in 9 days",
    time: "Yesterday · 17:00",
  },
];

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-2 text-sm text-black/50">
          Tender alerts, briefing reminders and closing-date notifications.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
        {notifications.map((notification, index) => (
          <div
            key={`${notification.type}-${notification.title}`}
            className={`p-5 ${
              index !== notifications.length - 1 ? "border-b border-black/10" : ""
            }`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">
              {notification.type}
            </div>
            <div className="mt-1 font-medium">{notification.title}</div>
            <div className="mt-1 text-xs text-black/40">{notification.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
