import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole;
    const queued = await admin.entities.Notification.filter({ delivery_mode: "end_of_day", delivery_status: "queued" });
    const groups = new Map<string, any[]>();
    for (const notification of queued) {
      const key = notification.recipient_email || notification.recipient_id || "unassigned";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(notification);
    }
    const sentAt = new Date().toISOString();
    const digests = [];
    for (const [recipient, notifications] of groups.entries()) {
      const body = notifications.map((notification) => `• ${notification.title}: ${notification.body || ""}`).join("\n");
      const first = notifications[0];
      const digest = await admin.entities.Notification.create({
        recipient_id: first.recipient_id || "",
        recipient_email: first.recipient_email || "",
        channel: "in_app",
        delivery_mode: "immediate",
        type: "end_of_day_digest",
        title: `Compliance end-of-day digest (${notifications.length} item${notifications.length === 1 ? "" : "s"})`,
        body,
        related_record_type: "NotificationDigest",
        related_record_id: "",
        link: "/notifications",
        is_read: false,
        sent_at: sentAt,
        delivery_status: "dev_logged",
      });
      for (const notification of notifications) await admin.entities.Notification.update(notification.id, { delivery_status: "dev_logged", sent_at: sentAt });
      await admin.entities.AuditTrail.create({ user_name: "Compliance Automation", action: "notification_digest_generated", record_type: "Notification", record_id: digest.id, record_name: digest.title, comment: `Development email adapter logged digest for ${recipient}`, timestamp: sentAt });
      console.log(`[DEV EOD EMAIL] To: ${recipient}\n${body}`);
      digests.push({ recipient, count: notifications.length, digest_id: digest.id });
    }
    return Response.json({ success: true, sent_at: sentAt, digests });
  } catch (error) {
    console.error("end-of-day-digest", error);
    return Response.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
});
