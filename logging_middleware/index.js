// Logging Middleware
// Reusable logging package for evaluation

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = "http://20.207.122.201/evaluation-service";
const LOG_URL = `${BASE_URL}/logs`;
const REGISTER_URL = `${BASE_URL}/register`;
const AUTH_URL = `${BASE_URL}/auth`;

// valid values
const ALLOWED_STACKS = ["backend", "frontend"];
const ALLOWED_LEVELS = ["debug", "info", "warn", "error", "fatal"];

const SERVER_PACKAGES = [
  "cache", "controller", "cron_job", "db", "domain",
  "handler", "repository", "route", "service",
  "auth", "config", "middleware", "utils"
];

const CLIENT_PACKAGES = [
  "api", "component", "hook", "page", "state", "style",
  "auth", "config", "middleware", "utils"
];

// token cache
let cachedAuthToken = null;
let authTokenExpiry = 0;

// load credentials from file
let currentCredentials = {};
try {
  const credsPath = join(__dirname, "credentials.json");
  currentCredentials = JSON.parse(readFileSync(credsPath, "utf-8"));
} catch (err) {
  // credentials not loaded, will need to be set manually
}

/**
 * Set credentials manually
 */
function setCredentials(creds) {
  currentCredentials = { ...currentCredentials, ...creds };
}

/**
 * Register with the evaluation server (one-time only!)
 */
async function register(details) {
  const payload = {
    email: details.email,
    name: details.name,
    mobileNo: details.mobileNo,
    githubUsername: details.githubUsername,
    rollNo: details.rollNo,
    accessCode: details.accessCode
  };

  try {
    const res = await fetch(REGISTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
      currentCredentials = {
        email: details.email,
        name: details.name,
        rollNo: details.rollNo,
        accessCode: details.accessCode,
        clientID: data.clientID,
        clientSecret: data.clientSecret
      };
      return data;
    } else {
      console.error("[LogMiddleware] Registration failed:", data);
      return null;
    }
  } catch (err) {
    console.error("[LogMiddleware] Registration error:", err.message);
    return null;
  }
}

/**
 * Get auth token (caches until expiry)
 */
async function getToken() {
  if (cachedAuthToken && Date.now() < authTokenExpiry) {
    return cachedAuthToken;
  }

  const payload = {
    email: currentCredentials.email,
    name: currentCredentials.name,
    rollNo: currentCredentials.rollNo,
    accessCode: currentCredentials.accessCode,
    clientID: currentCredentials.clientID,
    clientSecret: currentCredentials.clientSecret
  };

  try {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.access_token) {
      cachedAuthToken = data.access_token;
      authTokenExpiry = Date.now() + (data.expires_in * 1000) - 300000;
      return cachedAuthToken;
    } else {
      console.error("[LogMiddleware] Auth failed:", data);
      return null;
    }
  } catch (err) {
    console.error("[LogMiddleware] Auth error:", err.message);
    return null;
  }
}

/**
 * Send a log to the evaluation server
 * @param {string} stack - "backend" or "frontend"
 * @param {string} level - "debug" | "info" | "warn" | "error" | "fatal"
 * @param {string} pkg - module/package name
 * @param {string} message - log message
 */
async function Log(stack, level, pkg, message) {
  if (!ALLOWED_STACKS.includes(stack)) {
    console.error(`[LogMiddleware] Invalid stack: "${stack}"`);
    return null;
  }

  if (!ALLOWED_LEVELS.includes(level)) {
    console.error(`[LogMiddleware] Invalid level: "${level}"`);
    return null;
  }

  const allowed = stack === "backend" ? SERVER_PACKAGES : CLIENT_PACKAGES;
  if (!allowed.includes(pkg)) {
    console.error(`[LogMiddleware] Invalid package: "${pkg}" for stack "${stack}"`);
    return null;
  }

  const token = await getToken();
  if (!token) {
    console.error("[LogMiddleware] Could not get auth token");
    return null;
  }

  const payload = { stack, level, package: pkg, message };

  try {
    const res = await fetch(LOG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
      return data;
    } else {
      console.error(`[LogMiddleware] Log failed (${res.status}):`, data);
      return null;
    }
  } catch (err) {
    console.error("[LogMiddleware] Log send error:", err.message);
    return null;
  }
}

export { Log, register, getToken, setCredentials };
export default Log;
