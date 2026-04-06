# Trade Log — Trendline Break Strategy

A React web app for logging and analyzing futures trades on MGC and MNQ.

## Setup

### 1. Supabase storage bucket (for chart images)
In your Supabase dashboard:
- Go to **Storage** → **New bucket**
- Name it `trade-charts`
- Set to **Public**
- Click Create

### 2. Deploy to Vercel
1. Push this repo to GitHub
2. Go to vercel.com → **New Project** → Import your GitHub repo
3. Add environment variable:
   - Name: `REACT_APP_SUPABASE_ANON_KEY`
   - Value: your Supabase anon key (from Project Settings → API)
4. Click **Deploy**

### 3. Load historical data
Once deployed, click **Load 61 trades** button to seed all historical trades.

## Features
- Trade entry form with chart image upload
- Stats dashboard — win rate, net P&L, avg winner/loser
- Insight panels by instrument, grade, Safety Line quality, session
- Filter by account, symbol, grade, win/loss
- Dark theme
