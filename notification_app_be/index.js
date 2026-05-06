// Priority Inbox - Notification Backend
// Retrieves notifications from the evaluation server API and orders them by priority

import { Log, getToken } from "../logging_middleware/index.js";

const NOTIFICATIONS_ENDPOINT = "http://20.207.122.201/evaluation-service/notifications";

// priority mapping: Placement > Result > Event
const PRIORITY_MAPPING = {
  "Placement": 3,
  "Result": 2,
  "Event": 1
};

/**
 * Retrieve all notifications from the evaluation server
 */
async function retrieveNotifications() {
  await Log("backend", "info", "service", "Fetching notifications from evaluation server");

  const token = await getToken();
  if (!token) {
    await Log("backend", "error", "auth", "Failed to get auth token for notification fetch");
    return [];
  }

  try {
    const res = await fetch(NOTIFICATIONS_ENDPOINT, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!res.ok) {
      await Log("backend", "error", "service", `Notification API returned status ${res.status}`);
      return [];
    }

    const data = await res.json();
    await Log("backend", "info", "service", `Fetched ${data.notifications.length} notifications`);
    return data.notifications;
  } catch (err) {
    await Log("backend", "fatal", "service", `Failed to fetch notifications: ${err.message}`);
    return [];
  }
}

/**
 * Order notifications by priority (type weight + recency)
 * Placement > Result > Event, then by timestamp descending
 */
function orderNotifications(notifications) {
  return notifications.sort((a, b) => {
    const weightA = PRIORITY_MAPPING[a.Type] || 0;
    const weightB = PRIORITY_MAPPING[b.Type] || 0;

    // higher weight first
    if (weightA !== weightB) {
      return weightB - weightA;
    }

    // same weight — newer first
    return new Date(b.Timestamp) - new Date(a.Timestamp);
  });
}

/**
 * Get top N priority notifications
 */
function extractTopNotifications(notifications, limit) {
  const sorted = orderNotifications([...notifications]);
  return sorted.slice(0, limit);
}

/**
 * Filter notifications by type
 */
function getNotificationsByType(notifications, type) {
  return notifications.filter(n => n.Type === type);
}

/**
 * Display notifications in a readable format
 */
function printNotifications(notifications, headerTitle) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${headerTitle}`);
  console.log(`${"=".repeat(60)}`);

  if (notifications.length === 0) {
    console.log("  No notifications found.");
    return;
  }

  notifications.forEach((item, index) => {
    console.log(`\n  #${index + 1}`);
    console.log(`  ID:        ${item.ID}`);
    console.log(`  Type:      ${item.Type}`);
    console.log(`  Message:   ${item.Message}`);
    console.log(`  Timestamp: ${item.Timestamp}`);
  });

  console.log(`\n  Total: ${notifications.length}`);
  console.log(`${"=".repeat(60)}\n`);
}

// main execution
async function main() {
  await Log("backend", "info", "controller", "Priority Inbox application starting");

  // fetch notifications
  const allNotifications = await retrieveNotifications();

  if (allNotifications.length === 0) {
    await Log("backend", "warn", "controller", "No notifications received from API");
    console.log("No notifications found.");
    return;
  }

  // display all notifications
  printNotifications(allNotifications, "ALL NOTIFICATIONS");

  // display top 10 priority notifications
  const top10 = extractTopNotifications(allNotifications, 10);
  printNotifications(top10, "TOP 10 PRIORITY NOTIFICATIONS");

  // display by type
  const placements = getNotificationsByType(allNotifications, "Placement");
  printNotifications(placements, "PLACEMENT NOTIFICATIONS");

  const results = getNotificationsByType(allNotifications, "Result");
  printNotifications(results, "RESULT NOTIFICATIONS");

  const events = getNotificationsByType(allNotifications, "Event");
  printNotifications(events, "EVENT NOTIFICATIONS");

  await Log("backend", "info", "controller", "Priority Inbox processing complete");
}

main().catch(async (err) => {
  await Log("backend", "fatal", "controller", `Application crashed: ${err.message}`);
  console.error("Fatal error:", err);
});
