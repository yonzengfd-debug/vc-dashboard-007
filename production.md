# Production Deployment Guide (Vercel) 🚀

This dashboard is built with **Next.js** and optimized for **Vercel**.

## 1. Connect to GitHub
1. Push your latest code to your GitHub repository:
   ```bash
   git add .
   git commit -m "Migrate to Next.js for Vercel deployment"
   git push origin main
   ```
2. Go to [Vercel](https://vercel.com/new).
3. Import your `vc-dashboard-007` repository.

## 2. Configure Environment Variables
In the Vercel "Environment Variables" section during setup, add these keys:

| Key | Value |
| :--- | :--- |
| `NEXT_PUBLIC_DATA_SOURCE` | `supabase` (or `csv`) |
| `NEXT_PUBLIC_GEMINI_API_KEY` | your_gemini_key |
| `NEXT_PUBLIC_SUPABASE_URL` | your_supabase_url |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your_supabase_key |

## 3. Deployment
1. Click **Deploy**.
2. Vercel will build the project and provide a live URL (e.g., `vc-dashboard.vercel.app`).

## 4. Verification
- Open the production URL.
- Verify that KPIs load (Total Revenue: ~$94k).
- Click "Generate Business Insights" to verify the AI integration.
