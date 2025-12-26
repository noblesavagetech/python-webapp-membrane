# Railway Deployment Guide

## Setup (Two Services Required)

Since this is a monorepo with frontend + backend, you need **two Railway services**:

### Service 1: Backend API
1. **Create new service** from GitHub repo
2. **Root Directory**: `backend/`
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables**:
   - `OPENROUTER_API_KEY`: Your OpenRouter API key
   - `VECTOR_DB_DIR`: `./data/vectordb`
   - `UPLOAD_DIR`: `./data/uploads`
6. **Note the deployed URL** (e.g., `https://your-backend.up.railway.app`)

### Service 2: Frontend
1. **Create new service** from same GitHub repo
2. **Root Directory**: `/` (root)
3. **Build Command**: `npm install && npm run build`
4. **Start Command**: `npm run preview`
5. **Environment Variables**:
   - `VITE_API_URL`: Backend URL from Service 1
6. Update `src/services/api.ts` to use `import.meta.env.VITE_API_URL` instead of hardcoded detection

## Alternative: Deploy Backend Only to Railway

If you deploy the frontend elsewhere (Vercel, Netlify):
- Just use Service 1 (Backend) on Railway
- Set CORS to allow your frontend domain
- Update frontend API_BASE_URL to point to Railway backend

## Quick Deploy (Backend Only)

```bash
railway login
railway init
railway up
railway variables set OPENROUTER_API_KEY=sk-or-v1-...
```
