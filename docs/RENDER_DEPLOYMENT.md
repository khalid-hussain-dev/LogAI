# Deploying LogAI on Render

This guide details the step-by-step instructions to deploy the full LogAI stack (FastAPI Backend, Node Auth Service, React Frontend, PostgreSQL, Redis, Elasticsearch, and Background stream workers) to **Render**.

---

## Architecture Topology on Render

Render is designed around independent components. Because Nginx is not required when utilizing Render's native routing, the deployment topology maps to:

```mermaid
graph TD
    Client[Browser / User] -->|Web Traffic| Frontend[Static Site: React Frontend]
    Client -->|API Requests| FastAPI[Web Service: FastAPI Backend]
    Client -->|OAuth redirects| AuthService[Web Service: Node Auth Service]
    
    FastAPI -->|Private DB Link| Postgres[(Managed PostgreSQL)]
    FastAPI -->|Private Cache Link| Redis[(Managed Redis)]
    FastAPI -->|Private Index Link| Elasticsearch[Private Docker Service: Elasticsearch]
    
    StreamWorker[Background Worker: Python Stream Worker] -->|Consumes Queue| Redis
    StreamWorker -->|Saves Logs| Elasticsearch
    StreamWorker -->|Saves Alerts| Postgres
    
    AuthService -->|Writes Users| Postgres
    AuthService -->|Issues JWTs| FastAPI
```

---

## Step 1: Deploy Databases (Managed Services)

### 1. PostgreSQL
1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **PostgreSQL**.
3. Configure the database details:
   - **Name**: `logai-db`
   - **Database Name**: `logai`
   - **User**: `logai`
4. Click **Create Database**.
5. Save the **Internal Database URL** (e.g., `postgres://logai:password@dpg-xxxx-postgres.render.com/logai`) and **External Database URL**.

### 2. Redis
1. Click **New +** and select **Redis**.
2. Configure the Redis details:
   - **Name**: `logai-redis`
3. Click **Create Redis**.
4. Save the **Internal Redis URL** (e.g., `redis://red-xxxx:6379`).

---

## Step 2: Deploy Elasticsearch

Because Elasticsearch is not offered as a managed service on Render, you have two options:

### Option A: Private Docker Service on Render (Recommended for free/private tier testing)
1. Click **New +** and select **Private Service**.
2. Choose **Deploy an image** and enter:
   `docker.elastic.co/elasticsearch/elasticsearch:8.13.0`
3. Set the Service Name: `logai-elasticsearch`.
4. Add the following **Environment Variables**:
   - `discovery.type` = `single-node`
   - `xpack.security.enabled` = `false`
   - `xpack.security.http.ssl.enabled` = `false`
   - `ES_JAVA_OPTS` = `-Xms512m -Xmx512m`
5. Click **Create Private Service**.
6. Render will assign an internal connection URL: `http://logai-elasticsearch:9200`.

### Option B: Cloud-hosted Elasticsearch (Recommended for Production)
1. Set up a free sandbox on [Elastic Cloud](https://www.elastic.co/cloud/) or [Bonsai Elasticsearch](https://bonsai.io/).
2. Copy your connection URL (e.g., `https://xxxx.bonsaicloud.com:443`).

---

## Step 3: Deploy Node Auth Service

The `auth-service` handles user OAuth logins.

1. Click **New +** and select **Web Service**.
2. Connect your GitHub repository.
3. Configure the Web Service:
   - **Name**: `logai-auth-service`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Root Directory**: `auth-service`
4. Expand **Advanced** and add the following **Environment Variables**:
   - `PORT` = `4001`
   - `JWT_SECRET_KEY` = `[Choose a long secure random string]`
   - `JWT_ALGORITHM` = `HS256`
   - `POSTGRES_HOST` = `[Your Internal Postgres Host]`
   - `POSTGRES_PORT` = `5432`
   - `POSTGRES_DB` = `logai`
   - `POSTGRES_USER` = `logai`
   - `POSTGRES_PASSWORD` = `[Your Postgres Password]`
   - `REDIS_URL` = `[Your Internal Redis URL]`
   - `FRONTEND_URL` = `[Your Render Frontend Static URL - update this after Step 6]`
   - `GOOGLE_CLIENT_ID` = `[Optional: Google OAuth Client ID]`
   - `GOOGLE_CLIENT_SECRET` = `[Optional: Google OAuth Client Secret]`
   - `GITHUB_CLIENT_ID` = `[Optional: GitHub OAuth Client ID]`
   - `GITHUB_CLIENT_SECRET` = `[Optional: GitHub OAuth Client Secret]`
5. Click **Create Web Service**. Save the generated URL (e.g., `https://logai-auth-service.onrender.com`).

---

## Step 4: Deploy FastAPI Backend

1. Click **New +** and select **Web Service**.
2. Connect your GitHub repository.
3. Configure the Web Service:
   - **Name**: `logai-backend`
   - **Runtime**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
   - **Root Directory**: `backend`
4. Expand **Advanced** and add the following **Environment Variables**:
   - `POSTGRES_HOST` = `[Your Internal Postgres Host]`
   - `POSTGRES_PORT` = `5432`
   - `POSTGRES_DB` = `logai`
   - `POSTGRES_USER` = `logai`
   - `POSTGRES_PASSWORD` = `[Your Postgres Password]`
   - `REDIS_URL` = `[Your Internal Redis URL]`
   - `ELASTICSEARCH_URL` = `http://logai-elasticsearch:9200` *(or your Bonsai URL)*
   - `JWT_SECRET_KEY` = `[MUST match the JWT_SECRET_KEY configured in Step 3]`
   - `JWT_ALGORITHM` = `HS256`
5. Click **Create Web Service**. Save the generated URL (e.g., `https://logai-backend.onrender.com`).

---

## Step 5: Deploy Python Stream Worker

The stream worker handles rollups, anomaly training, and alerting in the background.

1. Click **New +** and select **Background Worker**.
2. Connect your GitHub repository.
3. Configure the Background Worker:
   - **Name**: `logai-stream-worker`
   - **Runtime**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python -m app.workers.stream_worker`
   - **Root Directory**: `backend`
4. Add the exact same **Environment Variables** as your FastAPI Backend (Step 4).
5. Click **Create Background Worker**.

---

## Step 6: Deploy React Frontend

1. Click **New +** and select **Static Site**.
2. Connect your GitHub repository.
3. Configure the Static Site:
   - **Name**: `logai-dashboard`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Root Directory**: `frontend`
4. Click **Create Static Site**.
5. Copy the generated Static Site URL (e.g. `https://logai-dashboard.onrender.com`).
6. **Post-Deployment Updates**:
   - Go back to your **Node Auth Service** settings and update `FRONTEND_URL` environment variable with this static site URL.
   - Update your OAuth credentials (Google/GitHub Developer Console) redirects to point to `https://logai-auth-service.onrender.com/api/auth/google/callback`.

---

## Step 7: DB Migrations (First Run)

To set up the database tables:
1. Open your **FastAPI Backend** dashboard on Render.
2. Select **Shell** from the left-side navigation tab.
3. Run the migrations command:
   ```bash
   alembic upgrade head
   ```
4. Your PostgreSQL tables are now created and you can log in, register servers, and ingest logs!
