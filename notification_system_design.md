# Notification System Design

## Stage 1

### Core Actions

The notification platform should support the following actions:

1. **Create Notification** – Send a new notification to a user
2. **Get Notifications** – Fetch all notifications for a user
3. **Get Unread Notifications** – Fetch only unread notifications
4. **Mark as Read** – Mark a single notification as read
5. **Mark All as Read** – Mark all notifications as read for a user
6. **Delete Notification** – Remove a specific notification

---

### REST API Endpoints

#### 1. Create Notification

```
POST /api/notifications
```

**Request Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "studentId": 1042,
  "type": "Placement",
  "message": "Google is hiring for SDE roles"
}
```

**Response (201 Created):**
```json
{
  "id": "a5aad02e-59d0-4153-85d9-58bf56d7c406",
  "studentId": 1042,
  "type": "Placement",
  "message": "Google is hiring for SDE roles",
  "isRead": false,
  "createdAt": "2026-05-06T10:30:00Z"
}
```

---

#### 2. Get All Notifications for a User

```
GET /api/notifications?studentId=1042
```

**Response (200 OK):**
```json
{
  "notifications": [
    {
      "id": "a4aad02e-19d0-4153-86d9-58bf55d7c402",
      "studentId": 1042,
      "type": "Placement",
      "message": "Google is hiring for SDE roles",
      "isRead": false,
      "createdAt": "2026-05-06T10:30:00Z"
    }
  ],
  "total": 1
}
```

---

#### 3. Get Unread Notifications

```
GET /api/notifications?studentId=1042&isRead=false
```

**Response (200 OK):** Same structure as above, filtered to unread only.

---

#### 4. Mark Notification as Read

```
PATCH /api/notifications/:id/read
```

**Response (200 OK):**
```json
{
  "id": "a4aad02e-19d0-4153-86d9-58bf55d7c402",
  "isRead": true,
  "message": "notification marked as read"
}
```

---

#### 5. Mark All as Read

```
PATCH /api/notifications/mark-all-read?studentId=1042
```

**Response (200 OK):**
```json
{
  "message": "all notifications marked as read",
  "count": 5
}
```

---

#### 6. Delete Notification

```
DELETE /api/notifications/:id
```

**Response (200 OK):**
```json
{
  "message": "notification deleted"
}
```

---

### Real-Time Notification Mechanism

For real-time delivery, I recommend using **Server-Sent Events (SSE)** over WebSockets because:
- Notifications are **unidirectional** (server → client), so full-duplex WebSocket is overkill
- SSE works over standard HTTP, easier to deploy behind load balancers
- Built-in browser support via `EventSource` API
- Automatic reconnection is handled by the browser

**Endpoint:**
```
GET /api/notifications/stream?studentId=1042
```

**How it works:**
1. Client opens an SSE connection: `new EventSource("/api/notifications/stream?studentId=1042")`
2. Server keeps the connection open
3. When a new notification is created for that student, the server pushes it through the SSE stream
4. Client receives the event and updates the UI without polling

**SSE Event Format:**
```
event: notification
data: {"id":"abc-123","type":"Placement","message":"TCS hiring","createdAt":"2026-05-06T11:00:00Z"}
```

---

## Stage 2

### Recommended Database: PostgreSQL

I recommend **PostgreSQL** for the following reasons:
- Strong support for JSONB if we need flexible fields later
- Excellent indexing capabilities (B-tree, partial, composite indexes)
- Handles concurrent reads/writes well with MVCC
- Mature ecosystem with good tooling
- Enum type support for notification types

### DB Schema

```sql
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id INTEGER NOT NULL REFERENCES students(id),
    notification_type notification_type NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fetching notifications by student
CREATE INDEX idx_notifications_student_id ON notifications(student_id);

-- Index for filtering unread notifications
CREATE INDEX idx_notifications_student_unread ON notifications(student_id, is_read)
    WHERE is_read = FALSE;
```

### Potential Problems at Scale

1. **Table bloat** – Millions of read notifications sitting in the table. Solution: archive old read notifications to a separate table after 90 days.
2. **Slow writes under heavy load** – Too many indexes slow down inserts. Solution: keep indexes minimal, only add what queries actually need.
3. **Large result sets** – A student with thousands of notifications. Solution: pagination using cursor-based approach (not OFFSET).

### SQL Queries for Each API

**Create Notification:**
```sql
INSERT INTO notifications (student_id, notification_type, message)
VALUES (1042, 'Placement', 'Google is hiring for SDE roles')
RETURNING id, student_id, notification_type, message, is_read, created_at;
```

**Get All Notifications for a Student:**
```sql
SELECT id, student_id, notification_type, message, is_read, created_at
FROM notifications
WHERE student_id = 1042
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;
```

**Get Unread Notifications:**
```sql
SELECT id, student_id, notification_type, message, is_read, created_at
FROM notifications
WHERE student_id = 1042 AND is_read = FALSE
ORDER BY created_at DESC;
```

**Mark as Read:**
```sql
UPDATE notifications
SET is_read = TRUE
WHERE id = 'a4aad02e-19d0-4153-86d9-58bf55d7c402';
```

**Mark All as Read:**
```sql
UPDATE notifications
SET is_read = TRUE
WHERE student_id = 1042 AND is_read = FALSE;
```

**Delete Notification:**
```sql
DELETE FROM notifications
WHERE id = 'a4aad02e-19d0-4153-86d9-58bf55d7c402';
```

---

## Stage 3

### Analyzing the Slow Query

The given query:
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

**Is this query accurate?**

The query is functionally correct — it fetches all unread notifications for a student. However there are issues:

1. **`SELECT *`** – Fetches all columns including potentially large text fields. Should select only needed columns.
2. **No index** – Without a composite index on `(student_id, is_read)`, the DB does a full table scan on 5 million rows.
3. **`ORDER BY createdAt ASC`** – Sorting without an index means the DB has to sort in memory, which is expensive for large result sets.

**What would I change?**

```sql
SELECT id, student_id, notification_type, message, created_at
FROM notifications
WHERE student_id = 1042 AND is_read = FALSE
ORDER BY created_at ASC;
```

Add a composite index:
```sql
CREATE INDEX idx_notif_student_unread_time
ON notifications(student_id, is_read, created_at)
WHERE is_read = FALSE;
```

This partial index only includes unread notifications, keeping the index small and fast.

**Likely computation cost without index:**
- Full table scan: O(n) where n = 5,000,000 rows
- Sort operation: O(k log k) where k = matching rows
- With 50,000 students, roughly ~100 notifications per student, so scanning 5M rows to find ~100 is very wasteful.

**Should we add indexes on every column?**

No, this is bad advice. Reasons:
- Each index slows down INSERT, UPDATE, DELETE operations because the index must be updated too
- Indexes consume disk space — on a 5M row table, each index could be hundreds of MB
- Many columns are rarely queried (e.g., `message`), so indexing them is wasted space
- The query planner might get confused with too many index choices
- Only index columns that appear in WHERE, JOIN, or ORDER BY clauses frequently

**Query: Students who got placement notifications in last 7 days:**

```sql
SELECT DISTINCT student_id
FROM notifications
WHERE notification_type = 'Placement'
  AND created_at >= NOW() - INTERVAL '7 days';
```

Supporting index:
```sql
CREATE INDEX idx_notif_type_created
ON notifications(notification_type, created_at);
```

---

## Stage 4

### Problem: DB Overwhelmed by Fetching on Every Page Load

When notifications are fetched on every page load for every student, the database gets hit with repeated identical queries. Here are strategies to fix this:

### Strategy 1: Caching with Redis

**How:** Store each student's notifications in Redis with a TTL (e.g., 60 seconds). On page load, check Redis first. If cache miss, query DB and populate cache.

```
Key: notifications:student:1042
Value: JSON array of notifications
TTL: 60 seconds
```

**Tradeoffs:**
- ✅ Drastically reduces DB load (most reads hit cache)
- ✅ Very fast reads (~1ms vs ~50ms from DB)
- ❌ Stale data for up to TTL duration
- ❌ Extra infrastructure (Redis server)
- ❌ Cache invalidation complexity when new notifications arrive

**Cache invalidation:** When a new notification is created for student X, delete the Redis key `notifications:student:X` so the next read fetches fresh data.

### Strategy 2: Pagination

**How:** Instead of fetching ALL notifications, fetch only the latest 20. Use cursor-based pagination for "load more".

```sql
SELECT id, notification_type, message, is_read, created_at
FROM notifications
WHERE student_id = 1042 AND created_at < '2026-05-06T10:00:00Z'
ORDER BY created_at DESC
LIMIT 20;
```

**Tradeoffs:**
- ✅ Constant query time regardless of total notifications
- ✅ No extra infrastructure needed
- ✅ Better UX (faster initial load)
- ❌ User needs to paginate to see older notifications
- ❌ Doesn't reduce number of DB connections

### Strategy 3: HTTP Caching (ETag / Last-Modified)

**How:** Return `ETag` or `Last-Modified` headers. Browser caches the response. On subsequent loads, browser sends `If-None-Match` / `If-Modified-Since`. Server returns 304 Not Modified if nothing changed.

**Tradeoffs:**
- ✅ Zero server processing for unchanged data
- ✅ No extra infrastructure
- ❌ Still hits the server (just returns 304 faster)
- ❌ Need to track last modification time per student

### Recommended Approach

Combine **Redis caching + Pagination**:
1. Paginate to limit data per request (20 notifications)
2. Cache the first page in Redis (most frequently accessed)
3. Invalidate cache on new notification creation

This gives the best balance of speed, freshness, and DB load reduction.

---

## Stage 5

### Shortcomings of Current Implementation

The given pseudocode:
```
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        send_email(student_id, message)    # calls Email API
        save_to_db(student_id, message)    # DB insert
        push_to_app(student_id, message)   # real-time push
```

**Problems:**

1. **Serial processing** – 50,000 students processed one by one. If each takes 200ms (email API call), total time = 50,000 × 200ms = ~2.7 hours.
2. **Partial failure** – If `send_email` fails at student #200, students 1-199 got emails but the rest didn't. No retry mechanism.
3. **Coupled operations** – Email sending, DB save, and push are tied together. If email API is slow, DB saves are also blocked.
4. **No idempotency** – If the process crashes and restarts, students 1-199 might get duplicate emails.
5. **Single point of failure** – One process handling everything. If it crashes, everything stops.

### Should DB save and email happen together?

**No.** They should be separated because:
- DB save is fast and reliable (~5ms), email sending is slow and unreliable (~200ms+)
- If email fails, the notification should still be saved in DB (user can see it in-app)
- Email is a "best effort" delivery — it can be retried independently
- Coupling them means a slow email API blocks all DB writes

### Revised Design

Use a **message queue** (like RabbitMQ or Redis Queue) to decouple and parallelize:

```
function notify_all(student_ids: array, message: string):
    // Step 1: Batch insert all notifications into DB (fast)
    batch_save_to_db(student_ids, message)

    // Step 2: Push jobs to message queue for async processing
    for student_id in student_ids:
        queue.publish("email_queue", { student_id, message })
        queue.publish("push_queue", { student_id, message })

// Separate worker processes (can run multiple instances)
function email_worker():
    while true:
        job = queue.consume("email_queue")
        try:
            send_email(job.student_id, job.message)
            mark_email_sent(job.student_id)
        catch error:
            queue.retry(job, delay: 30s, max_retries: 3)

function push_worker():
    while true:
        job = queue.consume("push_queue")
        try:
            push_to_app(job.student_id, job.message)
        catch error:
            queue.retry(job, delay: 10s, max_retries: 3)
```

**Why this is better:**
1. **DB batch insert** – One query inserts all 50,000 rows instead of 50,000 individual inserts
2. **Parallel processing** – Multiple email workers process the queue concurrently
3. **Fault tolerant** – If email fails, job goes back to queue with retry
4. **Decoupled** – Email slowness doesn't block DB or push notifications
5. **Scalable** – Add more workers to handle higher load
6. **Idempotent** – Each job has a unique ID, workers can check if already processed

---

## Stage 6

### Priority Inbox Approach

The priority inbox sorts notifications by:
1. **Type weight**: Placement (weight 3) > Result (weight 2) > Event (weight 1)
2. **Recency**: Newer notifications rank higher within the same type

### Algorithm

1. Fetch all notifications from the API
2. Assign a weight to each based on type
3. Sort by weight (descending), then by timestamp (descending)
4. Return top N results

### Maintaining Top N Efficiently

When new notifications keep coming in, we can use a **min-heap** of size N:
- If a new notification has higher priority than the smallest item in the heap, replace it
- This gives O(log N) per insertion instead of re-sorting the entire list
- For the evaluation, since we fetch from an API, we simply sort and slice the top N each time

The implementation code is in the `notification_app_be/` folder.
