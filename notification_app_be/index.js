// Priority Inbox - Notification Backend
// Fetches notifications from the evaluation server API and sorts by priority

import { Log, getToken } from "../logging_middleware/index.js";

const NOTIFICATION_API = "http://20.207.122.201/evaluation-service/notifications";

// priority weights: Placement > Result > Event
const TYPE_WEIGHTS = {
  "Placement": 3,
  "Result": 2,
  "Event": 1
};

/**
 * Fetch all notifications from the evaluation server
 */
async function fetchNotifications() {
  await Log("backend", "info", "service", "Fetching notifications from evaluation server");

  const token = await getToken();
  if (!token) {
    await Log("backend", "error", "auth", "Failed to get auth token for notification fetch");
    return [];
  }

  try {
    const res = await fetch(NOTIFICATION_API, {
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
 * Sort notifications by priority (type weight + recency)
 * Placement > Result > Event, then by timestamp descending
 */
function sortByPriority(notifications) {
  return notifications.sort((a, b) => {
    const weightA = TYPE_WEIGHTS[a.Type] || 0;
    const weightB = TYPE_WEIGHTS[b.Type] || 0;

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
function getTopN(notifications, n) {
  const sorted = sortByPriority([...notifications]);
  return sorted.slice(0, n);
}

/**
 * Filter notifications by type
 */
function filterByType(notifications, type) {
  return notifications.filter(n => n.Type === type);
}

/**
 * Display notifications in a readable format
 */
function displayNotifications(notifications, title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);

  if (notifications.length === 0) {
    console.log("  No notifications found.");
    return;
  }

  notifications.forEach((n, i) => {
    console.log(`\n  #${i + 1}`);
    console.log(`  ID:        ${n.ID}`);
    console.log(`  Type:      ${n.Type}`);
    console.log(`  Message:   ${n.Message}`);
    console.log(`  Timestamp: ${n.Timestamp}`);
  });

  console.log(`\n  Total: ${notifications.length}`);
  console.log(`${"=".repeat(60)}\n`);
}

// main execution
async function main() {
  await Log("backend", "info", "controller", "Priority Inbox application starting");

  // fetch notifications
  const notifications = await fetchNotifications();

  if (notifications.length === 0) {
    await Log("backend", "warn", "controller", "No notifications received from API");
    console.log("No notifications found.");
    return;
  }

  // display all notifications
  displayNotifications(notifications, "ALL NOTIFICATIONS");

  // display top 10 priority notifications
  const top10 = getTopN(notifications, 10);
  displayNotifications(top10, "TOP 10 PRIORITY NOTIFICATIONS");

  // display by type
  const placements = filterByType(notifications, "Placement");
  displayNotifications(placements, "PLACEMENT NOTIFICATIONS");

  const results = filterByType(notifications, "Result");
  displayNotifications(results, "RESULT NOTIFICATIONS");

  const events = filterByType(notifications, "Event");
  displayNotifications(events, "EVENT NOTIFICATIONS");

  await Log("backend", "info", "controller", "Priority Inbox processing complete");
}

main().catch(async (err) => {
  await Log("backend", "fatal", "controller", `Application crashed: ${err.message}`);
  console.error("Fatal error:", err);
});
