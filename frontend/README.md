# Chatly frontend

## Run backend
```bash
cd /Users/macbook/Desktop/whatsapp
source venv/bin/activate
python manage.py runserver
```

## Run frontend
```bash
cd /Users/macbook/Desktop/whatsapp/frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173

## Flow
1. Register or login (`/api/auth/...`)
2. Pick a user from the sidebar
3. Messages load from `/api/chat/messages/history/`
4. Live send/receive via `ws://127.0.0.1:8000/ws/chat/?token=<access>`
