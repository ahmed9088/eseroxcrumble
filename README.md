# Cafe Esero × Crumble Cookie Preorder Site

A premium, high-performance cookie preorder reservation system built with Next.js (App Router), styled with custom warm chocolate Vanilla CSS, powered by Supabase (PostgreSQL + File Storage), and automated with Resend Email API for OTP verification and admin-action alerts. Fully optimized for high-concurrency launches (500+ concurrent customers) and deployed via GitHub & Vercel.

## 🛠️ Step-by-Step Setup Guide

Follow these steps to configure your database, email notifications, local dev, and production hosting:

---

### Step 1: Database Setup (Supabase)

Supabase provides a production-grade PostgreSQL database and object storage on a generous free tier.

1. **Create a Supabase Project:**
   - Go to [Supabase](https://supabase.com) and sign in/sign up.
   - Create a new project named `esero-cookie-preorder`. Select a region close to your customers and set a strong database password.
2. **Execute Database Schema:**
   - In your Supabase project dashboard, navigate to the **SQL Editor** tab from the left sidebar.
   - Click **New query**.
   - Open the [schema.sql](file:///C:/Users/AHMED%20SAFFAR/.gemini/antigravity-ide/scratch/esero-cookie-preorder/schema.sql) file in this project, copy its contents, paste them into the SQL editor, and click **Run**.
   - This creates three tables: `orders`, `settings`, and `email_verifications`.
3. **Configure Storage Bucket (for Payment Proof Uploads):**
   - Navigate to the **Storage** tab in the left sidebar.
   - Click **New bucket**.
   - Name the bucket exactly: `payment-proofs`.
   - **Crucial:** Toggle the switch to make it a **Public bucket** (this allows the admin panel to view the uploaded screenshots).
   - Click **Create bucket**.
   - *(Note: Since our backend API uploads files using the Supabase Admin Service Role key, no custom upload security policies are required. The server role has full permissions by default).*
4. **Get your API Keys:**
   - Go to **Project Settings** (gear icon) -> **API**.
   - Copy the following values to configure in your environment:
     - **Project URL** (needed for `NEXT_PUBLIC_SUPABASE_URL`)
     - **anon / public** API key (needed for `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
     - **service_role** secret API key (needed for `SUPABASE_SERVICE_ROLE_KEY`) - *Keep this key hidden!*

---

### Step 2: Email Setup (Resend)

Resend handles sending verification codes (OTP) and booking statuses automatically.

1. **Register on Resend:**
   - Go to [Resend](https://resend.com) and create an account.
2. **Get your API Key:**
   - Go to the **API Keys** tab and click **Create API Key**.
   - Name it `Esero Preorder` and copy the key (needed for `RESEND_API_KEY`).
3. **Domain Verification (Important for Production):**
   - By default, Resend operates in sandbox mode and will only send emails to your own registered account email address (using `noreply@resend.dev` as sender).
   - To send confirmation emails to all your customer emails, click **Domains** in the left sidebar, add your custom domain (e.g. `cafeesero.com`), and add the generated DNS TXT/MX records to your domain name server settings (GoDaddy, Cloudflare, Namecheap, etc.).

---

### Step 3: Local Dev Configuration

1. In the root of the project directory, duplicate `.env.local.example` and rename it to `.env.local`.
2. Fill in the variables using your Supabase, Resend keys, and define an admin password of your choice:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   RESEND_API_KEY=re_your_resend_api_key_here
   ADMIN_PASSWORD=your-secret-passcode-here
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) for the Preorder Form and [http://localhost:3000/admin](http://localhost:3000/admin) for the Admin Dashboard.

---

### Step 4: GitHub Repository & Vercel Deployment

Vercel provides instant hosting, high scalability, and serverless edge functions that auto-scale to handle massive concurrent traffic spikes (such as 500+ customers ordering at once).

1. **Push to GitHub:**
   - Initialize a local git repository in this project if not already done.
   - Create a new private repository on GitHub.
   - Push your code to GitHub:
     ```bash
     git remote add origin git@github.com:yourusername/esero-cookie-preorder.git
     git branch -M main
     git add .
     git commit -m "feat: initial release of Esero preorder site"
     git push -u origin main
     ```
2. **Deploy on Vercel:**
   - Log into [Vercel](https://vercel.com).
   - Click **Add New...** -> **Project**.
   - Import your GitHub repository `esero-cookie-preorder`.
   - In the **Environment Variables** section, add the same 5 variables you added to `.env.local`:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `RESEND_API_KEY`
     - `ADMIN_PASSWORD`
   - Click **Deploy**.
   - Vercel will build the project and output a public live URL (e.g. `esero-cookie-preorder.vercel.app`). Give this link to the Cafe Esero team for customers, and `/admin` for the management dashboard!
