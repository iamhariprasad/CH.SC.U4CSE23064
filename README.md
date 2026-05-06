# CH.SC.U4CSE23064

## Structure

- `logging_middleware/` - Reusable logging middleware package
- `notification_system_design.md` - System design document (Stages 1-6)
- `notification_app_be/` - Stage 6: Priority Inbox backend implementation
- `notification_app_fe/` - Stage 7: React frontend for notification inbox

## Setup

### Logging Middleware
```bash
cd logging_middleware
node -e "import('./index.js').then(m => m.Log('backend', 'info', 'middleware', 'test')).then(console.log)"
```

### Backend (Stage 6)
```bash
cd notification_app_be
node index.js
```

### Frontend (Stage 7)
```bash
cd notification_app_fe
npm install
npm run dev
```
