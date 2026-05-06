# Logging Middleware

A reusable logging middleware that sends structured log entries to the evaluation test server.

## Usage

```javascript
import { Log } from "./index.js";

// basic usage
await Log("backend", "info", "controller", "User fetched notifications successfully");

// error logging
await Log("backend", "error", "handler", "received string, expected bool");

// fatal error
await Log("backend", "fatal", "db", "Critical database connection failure.");
```

## Parameters

| Parameter | Type   | Description                          |
|-----------|--------|--------------------------------------|
| stack     | string | `"backend"` or `"frontend"`          |
| level     | string | `"debug"`, `"info"`, `"warn"`, `"error"`, `"fatal"` |
| package   | string | Module name (see allowed values)     |
| message   | string | Descriptive log message              |

## Allowed Packages

**Backend**: cache, controller, cron_job, db, domain, handler, repository, route, service, auth, config, middleware, utils

**Frontend**: api, component, hook, page, state, style, auth, config, middleware, utils
