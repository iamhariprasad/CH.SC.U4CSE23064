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
const VALID_STACKS = ["backend", "frontend"];
const VALID_LEVELS = ["debug", "info", "warn", "error", "fatal"];

const BACKEND_PACKAGES = [
  "cache", "controller", "cron_job", "db", "domain",
  "handler", "repository", "route", "service",
  "auth", "config", "middleware", "utils"
];

const FRONTEND_PACKAGES = [
  "api", "component", "hook", "page", "state", "style",
  "auth", "config", "middleware", "utils"
];

// token cache
let cachedToken = null;
let tokenExpiry = 0;

// load credentials from file
let credentials = {};
try {
  const credsPath = join(__dirname, "credentials.json");
  credentials = JSON.parse(readFileSync(credsPath, "utf-8"));
} catch (err) {
  // credentials not loaded, will need to be set manually
}

/**
 * Set credentials manually
 */
function setCredentials(creds) {
  credentials = { ...credentials, ...creds };
}

/**
 * Register with the evaluation server (one-time only!)
 */
async function register(details) {
  const body = {
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
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (res.ok) {
      credentials = {
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
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const body = {
    email: credentials.email,
    name: credentials.name,
    rollNo: credentials.rollNo,
    accessCode: credentials.accessCode,
    clientID: credentials.clientID,
    clientSecret: credentials.clientSecret
  };

  try {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (res.ok && data.access_token) {
      cachedToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in * 1000) - 300000;
      return cachedToken;
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
  if (!VALID_STACKS.includes(stack)) {
    console.error(`[LogMiddleware] Invalid stack: "${stack}"`);
    return null;
  }

  if (!VALID_LEVELS.includes(level)) {
    console.error(`[LogMiddleware] Invalid level: "${level}"`);
    return null;
  }

  const allowed = stack === "backend" ? BACKEND_PACKAGES : FRONTEND_PACKAGES;
  if (!allowed.includes(pkg)) {
    console.error(`[LogMiddleware] Invalid package: "${pkg}" for stack "${stack}"`);
    return null;
  }

  const token = await getToken();
  if (!token) {
    console.error("[LogMiddleware] Could not get auth token");
    return null;
  }

  const body = { stack, level, package: pkg, message };

  try {
    const res = await fetch(LOG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(body)
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
