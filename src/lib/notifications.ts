import { prisma } from "./db";

/**
 * Notification Provider Abstraction
 * Supports Email (active) and WhatsApp (pluggable later)
 */

interface SendOptions {
  userId: string;
  channel: "EMAIL" | "WHATSAPP" | "BOTH";
  type: string;
  subject?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Send a notification via the configured channel
 * Currently supports email via console log (swap with Resend/Nodemailer when ready)
 */
export async function sendNotification(options: SendOptions): Promise<string> {
  const { userId, channel, type, subject, message, metadata } = options;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true, firstName: true, lastName: true },
  });

  if (!user) throw new Error("User not found");

  // Create notification record
  const notification = await prisma.notification.create({
    data: {
      userId,
      channel,
      type,
      subject: subject || type,
      message,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      status: "PENDING",
    },
  });

  try {
    if (channel === "EMAIL" || channel === "BOTH") {
      await sendEmail(user.email, subject || type, message);
    }

    if (channel === "WHATSAPP" || channel === "BOTH") {
      if (user.phone) {
        await sendWhatsApp(user.phone, message);
      }
    }

    // Mark as sent
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "SENT", sentAt: new Date() },
    });

    return notification.id;
  } catch (err) {
    // Mark as failed
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "FAILED", errorMsg: (err as Error).message },
    });
    throw err;
  }
}

/**
 * Send bulk notifications to multiple users
 */
export async function sendBulkNotification(
  userIds: string[],
  channel: "EMAIL" | "WHATSAPP" | "BOTH",
  type: string,
  subject: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<number> {
  let sent = 0;
  for (const userId of userIds) {
    try {
      await sendNotification({ userId, channel, type, subject, message, metadata });
      sent++;
    } catch {
      // Continue sending to others even if one fails
    }
  }
  return sent;
}

/**
 * Send task assignment notification
 */
export async function notifyTaskAssigned(taskId: string, assigneeId: string, taskTitle: string, deadline: string) {
  await sendNotification({
    userId: assigneeId,
    channel: "BOTH",
    type: "task_assigned",
    subject: `New Task Assigned: ${taskTitle}`,
    message: `You have been assigned a new task: "${taskTitle}". Deadline: ${new Date(deadline).toLocaleDateString("en-IN")}. Please check your task board.`,
    metadata: { taskId },
  });
}

/**
 * Send leave status notification
 */
export async function notifyLeaveStatus(userId: string, status: string, startDate: string, endDate: string) {
  await sendNotification({
    userId,
    channel: "EMAIL",
    type: "leave_status",
    subject: `Leave Request ${status}`,
    message: `Your leave request from ${new Date(startDate).toLocaleDateString("en-IN")} to ${new Date(endDate).toLocaleDateString("en-IN")} has been ${status.toLowerCase()}.`,
    metadata: { status, startDate, endDate },
  });
}

/**
 * Send task deadline reminder
 */
export async function notifyTaskDeadline(taskId: string, userId: string, taskTitle: string, daysLeft: number) {
  await sendNotification({
    userId,
    channel: "BOTH",
    type: "task_deadline_reminder",
    subject: `Task Deadline Approaching: ${taskTitle}`,
    message: `Your task "${taskTitle}" is due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Please ensure it is completed on time.`,
    metadata: { taskId, daysLeft },
  });
}

/**
 * Send attendance anomaly alert
 */
export async function notifyAttendanceAnomaly(userId: string, anomalyType: string, details: string) {
  await sendNotification({
    userId,
    channel: "EMAIL",
    type: "attendance_anomaly",
    subject: `Attendance Alert: ${anomalyType}`,
    message: details,
    metadata: { anomalyType },
  });
}

// ============================================================
// Provider implementations (swap these when integrating real providers)
// ============================================================

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  // TODO: Replace with Resend or Nodemailer when RESEND_API_KEY is configured
  if (process.env.RESEND_API_KEY) {
    // Resend implementation would go here
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({ from: process.env.EMAIL_FROM, to, subject, text: body });
    console.log(`[EMAIL SENT] To: ${to}, Subject: ${subject}`);
  } else {
    console.log(`[EMAIL MOCK] To: ${to}, Subject: ${subject}, Body: ${body.substring(0, 100)}...`);
  }
}

async function sendWhatsApp(phone: string, message: string): Promise<void> {
  // TODO: Replace with Twilio/WATI when WHATSAPP_API_KEY is configured
  if (process.env.WHATSAPP_API_KEY) {
    // WhatsApp provider implementation would go here
    console.log(`[WHATSAPP SENT] To: ${phone}`);
  } else {
    console.log(`[WHATSAPP MOCK] To: ${phone}, Message: ${message.substring(0, 100)}...`);
  }
}
