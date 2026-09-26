# Project Report Portal

BCA Final Year Semester Mini Project — login/registration, project details form
with dynamic module fields, and PDF report generation.

## Structure

```
project-portal/
├── backend/          Node.js + Express API, PDF generation, JSON file storage
│   ├── server.js
│   ├── package.json
│   └── data/          created automatically (users.json, projects/*.json)
└── frontend/          plain HTML/CSS/JS, served by the backend
    ├── index.html
    ├── style.css
    └── app.js
```

## Run it

1. Open a terminal in the `backend` folder:
   ```
   cd backend
   npm install
   npm start
   ```
2. Open **http://localhost:3000** in your browser.

That's it — one server serves both the frontend and the API, so there's
no separate frontend server or CORS setup needed.

## How it works

- **Register / Login** — `POST /api/register` and `POST /api/login`. Passwords
  are salted and hashed (PBKDF2) before being written to `backend/data/users.json`.
  A session token is returned and stored in the browser's `localStorage`.
- **Project details** — `GET/POST /api/project`, saved per user to
  `backend/data/projects/<username>.json`.
- **PDF report** — `POST /api/project/report` builds the PDF server-side with
  `pdfkit` and streams it back; the browser triggers a normal file download.

## Notes for submission

- Storage is flat JSON files, so no database installation is required — fine
  for a mini project, but swap in SQLite/MongoDB if your guide wants a "real" DB.
- Change the color palette in `frontend/style.css` and the copy in
  `frontend/index.html` to make this submission visually distinct, per the
  originality requirement.
- Remember to host it online (e.g. Render, Railway, Glitch) for at least 15 days.

Developed by Y. Saran, RS. Vishal, K.B. Navin
