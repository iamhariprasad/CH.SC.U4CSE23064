import { useState, useEffect } from 'react';
import { fetchNotifications, Log } from './api.js';
import './index.css';

// priority weights
const NOTIFICATION_PRIORITY_WEIGHTS = { Placement: 3, Result: 2, Event: 1 };

function App() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('all'); // 'all' or 'priority'
  const [typeFilter, setTypeFilter] = useState('All');
  const [topN, setTopN] = useState(10);
  const [viewedIds, setViewedIds] = useState(() => {
    // persist read state in localStorage
    const saved = localStorage.getItem('readNotifications');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    localStorage.setItem('readNotifications', JSON.stringify(viewedIds));
  }, [viewedIds]);

  async function loadNotifications() {
    setLoading(true);
    Log("info", "api", "Fetching notifications from server");

    const data = await fetchNotifications();
    setNotifications(data);
    setLoading(false);

    if (data.length > 0) {
      Log("info", "page", `Loaded ${data.length} notifications`);
    } else {
      Log("warn", "page", "No notifications received");
    }
  }

  function markAsRead(id) {
    if (!viewedIds.includes(id)) {
      setViewedIds([...viewedIds, id]);
      Log("info", "component", `Notification ${id} marked as read`);
    }
  }

  function markAllRead() {
    const allIds = notifications.map(n => n.ID);
    setViewedIds(allIds);
    Log("info", "component", "All notifications marked as read");
  }

  // sort by priority: type weight desc, then timestamp desc
  function retrievePriorityList() {
    const sorted = [...notifications].sort((a, b) => {
      const wA = NOTIFICATION_PRIORITY_WEIGHTS[a.Type] || 0;
      const wB = NOTIFICATION_PRIORITY_WEIGHTS[b.Type] || 0;
      if (wA !== wB) return wB - wA;
      return new Date(b.Timestamp) - new Date(a.Timestamp);
    });
    return sorted.slice(0, topN);
  }

  // filter by type
  function filterNotifications(list) {
    if (typeFilter === 'All') return list;
    return list.filter(n => n.Type === typeFilter);
  }

  // get display list based on current page
  function buildDisplayList() {
    if (page === 'priority') {
      return filterNotifications(retrievePriorityList());
    }
    // all page: sort by timestamp desc
    const sorted = [...notifications].sort(
      (a, b) => new Date(b.Timestamp) - new Date(a.Timestamp)
    );
    return filterNotifications(sorted);
  }

  const displayList = buildDisplayList();
  const unreadCount = notifications.filter(n => !viewedIds.includes(n.ID)).length;

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Notification Inbox</h1>
        <p>Student Notification Dashboard</p>
      </header>

      {/* Stats */}
      <div className="stats">
        <div className="stat-box">
          <div className="label">Total</div>
          <div className="value">{notifications.length}</div>
        </div>
        <div className="stat-box">
          <div className="label">Unread</div>
          <div className="value">{unreadCount}</div>
        </div>
        <div className="stat-box">
          <div className="label">Placements</div>
          <div className="value">
            {notifications.filter(n => n.Type === 'Placement').length}
          </div>
        </div>
        <div className="stat-box">
          <div className="label">Results</div>
          <div className="value">
            {notifications.filter(n => n.Type === 'Result').length}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="nav-tabs">
        <button
          className={`nav-tab ${page === 'all' ? 'active' : ''}`}
          onClick={() => { setPage('all'); Log("info", "page", "Switched to All Notifications"); }}
        >
          All Notifications
        </button>
        <button
          className={`nav-tab ${page === 'priority' ? 'active' : ''}`}
          onClick={() => { setPage('priority'); Log("info", "page", "Switched to Priority Inbox"); }}
        >
          Priority Inbox
        </button>
      </nav>

      {/* Controls */}
      <div className="controls">
        <label>Filter by type:</label>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            Log("info", "component", `Filter changed to ${e.target.value}`);
          }}
        >
          <option value="All">All Types</option>
          <option value="Placement">Placement</option>
          <option value="Result">Result</option>
          <option value="Event">Event</option>
        </select>

        {page === 'priority' && (
          <>
            <label>Top N:</label>
            <select
              value={topN}
              onChange={(e) => {
                setTopN(Number(e.target.value));
                Log("info", "component", `Top N changed to ${e.target.value}`);
              }}
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={15}>Top 15</option>
              <option value={20}>Top 20</option>
            </select>
          </>
        )}

        <button
          className="nav-tab"
          onClick={markAllRead}
          style={{ marginLeft: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}
        >
          Mark All Read
        </button>

        <button
          className="nav-tab"
          onClick={loadNotifications}
          style={{ border: '1px solid var(--border)', borderRadius: '6px' }}
        >
          Refresh
        </button>
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading notifications...</p>
        </div>
      ) : displayList.length === 0 ? (
        <div className="empty">
          <p>No notifications found.</p>
        </div>
      ) : (
        <div className="notification-list">
          {displayList.map((n, idx) => {
            const isRead = viewedIds.includes(n.ID);
            return (
              <div
                key={n.ID}
                className={`notification-card ${isRead ? 'read' : 'unread'}`}
                onClick={() => markAsRead(n.ID)}
              >
                <div className="notification-top">
                  <div>
                    {page === 'priority' && (
                      <span className="priority-rank">#{idx + 1}</span>
                    )}
                    {!isRead && <span className="unread-dot"></span>}
                    <span className={`notification-type type-${n.Type}`}>
                      {n.Type}
                    </span>
                  </div>
                  <span className="notification-time">{formatTime(n.Timestamp)}</span>
                </div>
                <div className="notification-message">{n.Message}</div>
                <div className="notification-id">ID: {n.ID}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default App;
