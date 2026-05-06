// Logging middleware adapted for browser (frontend)
// No filesystem access - credentials passed directly

const BASE_URL = "http://20.207.122.201/evaluation-service";
const LOG_URL = `${BASE_URL}/logs`;
const AUTH_URL = `${BASE_URL}/auth`;
const NOTIFICATION_URL = `${BASE_URL}/notifications`;

const PERMITTED_LEVELS = ["debug", "info", "warn", "error", "fatal"];
const UI_PACKAGES = [
  "api", "component", "hook", "page", "state", "style",
  "auth", "config", "middleware", "utils"
];

let savedAuthToken = null;
let authTokenExpiration = 0;

const credentials = {
  email: "ch.sc.u4cse23021@ch.students.amrita.edu",
  name: "Harshil J",
  rollNo: "ch.sc.u4cse23021",
  accessCode: "PTBMmQ",
  clientID: "ffc0ce0b-e0ae-4f27-bc53-a363fc9757d6",
  clientSecret: "GfrbYVUQxHvtNPDZ"
};

async function getToken() {
  if (savedAuthToken && Date.now() < authTokenExpiration) {
    return savedAuthToken;
  }

  try {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials)
    });

    const data = await res.json();
    if (res.ok && data.access_token) {
      savedAuthToken = data.access_token;
      authTokenExpiration = Date.now() + (data.expires_in * 1000) - 300000;
      return savedAuthToken;
    }
    return null;
  } catch (err) {
    console.error("[Logger] Auth error:", err.message);
    return null;
  }
}

export async function Log(level, pkg, message) {
  if (!PERMITTED_LEVELS.includes(level)) return null;
  if (!UI_PACKAGES.includes(pkg)) return null;

  const token = await getToken();
  if (!token) return null;

  try {
    const res = await fetch(LOG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        stack: "frontend",
        level,
        package: pkg,
        message
      })
    });
    const data = await res.json();
    return res.ok ? data : null;
  } catch (err) {
    return null;
  }
}

export async function fetchNotifications() {
  const token = await getToken();
  if (!token) return [];

  try {
    const res = await fetch(NOTIFICATION_URL, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.notifications || [];
  } catch (err) {
    console.error("[API] Fetch error:", err.message);
    return [];
  }
}
