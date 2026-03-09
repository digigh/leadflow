# 🎯 LeadFlow — Internal Lead Management Platform

A modern, production-ready lead management platform built with React + Vite + TailwindCSS + Supabase.

---

## 📁 Project Structure

```
leadflow/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   └── UI.jsx              # Reusable: MetricCard, StatusBadge, PriorityBadge, Toast
│   ├── lib/
│   │   ├── supabase.js         # Supabase client
│   │   └── constants.js        # Status options, colors, mock data
│   ├── pages/
│   │   ├── HomePage.jsx        # Landing page
│   │   ├── LoginPage.jsx       # Login with credential check
│   │   ├── Dashboard.jsx       # Sidebar shell
│   │   ├── LeadsTab.jsx        # Lead table with edit/save to Supabase
│   │   └── AnalyticsTab.jsx    # Charts and analytics
│   ├── App.jsx                 # Page router
│   ├── main.jsx                # React entry point
│   └── index.css               # Tailwind + global styles
├── .env                        # Your secret keys (DO NOT COMMIT)
├── .env.example                # Template for others
├── .gitignore
├── supabase-schema.sql         # Run this in Supabase SQL Editor
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## 🚀 Setup Instructions (Step by Step)

### Step 1 — Prerequisites

Make sure you have these installed:
- **Node.js** v18 or higher → https://nodejs.org
- **Git** → https://git-scm.com
- A **GitHub account** → https://github.com

Check your versions:
```bash
node --version    # should be v18+
npm --version     # should be 9+
git --version
```

---

### Step 2 — Set Up Supabase Database

1. Go to https://supabase.com and open your project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase-schema.sql` and paste it
5. Click **Run** (or press Ctrl+Enter)
6. You should see: *"Success. No rows returned"*
7. Go to **Table Editor** → you should now see a `leads` table with sample data

---

### Step 3 — Clone / Set Up Locally

**Option A — If you're starting fresh (no git yet):**
```bash
# Navigate to where you want the project
cd ~/Desktop

# Clone your GitHub repo (after creating it in Step 5)
git clone https://github.com/YOUR_USERNAME/leadflow.git
cd leadflow
```

**Option B — If you already have the files:**
```bash
# Navigate into the project folder
cd leadflow
```

---

### Step 4 — Install Dependencies

```bash
npm install
```

This installs React, Vite, TailwindCSS, Supabase client, Recharts, and Lucide icons.

---

### Step 5 — Configure Environment Variables

The `.env` file is already configured with your Supabase credentials.

Verify it looks like this:
```
VITE_SUPABASE_URL=https://oczaxskcvvlinraewyqq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_ADMIN_EMAIL=admin@leadplatform.com
VITE_ADMIN_PASSWORD=Password123
```

> ⚠️ The `.env` file is in `.gitignore` — it will NOT be pushed to GitHub (keeps your keys safe).

---

### Step 6 — Run Locally

```bash
npm run dev
```

Open your browser at: **http://localhost:5173**

You should see the LeadFlow homepage. Click **Login to Platform** and use:
- Email: `admin@leadplatform.com`
- Password: `Password123`

---

### Step 7 — Push to GitHub

```bash
# Initialize git (only needed first time)
git init

# Add all files
git add .

# First commit
git commit -m "🚀 Initial commit — LeadFlow platform"

# Create repo on GitHub first (github.com → New Repository → name it 'leadflow')
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/leadflow.git
git branch -M main
git push -u origin main
```

> ⚠️ Double-check `.env` is NOT in your commit. Run `git status` — if `.env` appears, stop and check your `.gitignore`.

---

### Step 8 — Deploy to Vercel (Free Hosting)

1. Go to https://vercel.com and sign in with GitHub
2. Click **Add New → Project**
3. Select your `leadflow` repo
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` → your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` → your anon key
   - `VITE_ADMIN_EMAIL` → admin@leadplatform.com
   - `VITE_ADMIN_PASSWORD` → Password123
5. Click **Deploy**
6. Your app will be live at `https://leadflow-xxx.vercel.app` in ~60 seconds

---

## 🔑 Login Credentials

| Field    | Value                       |
|----------|-----------------------------|
| Email    | admin@leadplatform.com      |
| Password | Password123                 |

---

## 🗄️ Database Schema

The `leads` table has these columns:

| Column       | Type    | Description                        |
|--------------|---------|------------------------------------|
| id           | bigint  | Auto-increment primary key         |
| lead_name    | text    | Full name of the lead              |
| company      | text    | Company name                       |
| email        | text    | Email address                      |
| phone        | text    | Phone number                       |
| source       | text    | 'Website' or 'Meta'                |
| message      | text    | Inquiry message (Website leads)    |
| date         | date    | Lead submission date               |
| job_title    | text    | Job title (Meta leads)             |
| status       | text    | **Blank by default** — set by team |
| priority     | text    | **Blank by default** — set by team |
| assigned_to  | text    | **Blank by default** — set by team |
| feedback     | text    | **Blank by default** — set by team |
| remarks      | text    | **Blank by default** — set by team |
| created_at   | timestamp | Auto-set on insert               |
| updated_at   | timestamp | Auto-updated on every edit       |

---

## 🔗 Google Sheets Integration (Coming Next)

To connect your Google Sheets, you'll need to provide:
1. Your **Spreadsheet ID** (from the URL)
2. Whether the sheet is public or you have a Service Account key
3. Exact tab names for Sheet 1 (Website Leads) and Sheet 2 (Meta Leads)

---

## 🛠️ Available Scripts

| Command         | What it does                        |
|-----------------|-------------------------------------|
| `npm run dev`   | Start local dev server on port 5173 |
| `npm run build` | Build for production into `/dist`   |
| `npm run preview` | Preview production build locally  |

---

## 🎨 Tech Stack

| Layer      | Technology                  |
|------------|-----------------------------|
| Frontend   | React 18 + Vite             |
| Styling    | TailwindCSS 3               |
| Icons      | Lucide React                |
| Charts     | Recharts                    |
| Database   | Supabase (PostgreSQL)       |
| Fonts      | DM Sans + DM Serif Display  |
| Hosting    | Vercel (recommended)        |
