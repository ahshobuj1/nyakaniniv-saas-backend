# Deployment Strategy & Hosting Guide

Before diving into development, planning your deployment is crucial. Since you are building a **SaaS platform** with Docker, PostgreSQL, Prisma, and Express/Bun, here is a detailed breakdown of where to host and how to deploy.

---

## 1. AWS vs. Hostinger VPS: Which is Best?

### **Option A: Hostinger VPS (Recommended for Startups/Early Stage)**

- **Pros:** Extremely cost-effective (starting around $5-10/month), predictable pricing, very easy to set up for a single-server Docker environment, provides root access.
- **Cons:** Manual scaling (if your traffic spikes, you have to manually upgrade the VPS plan or add load balancers). You manage your own database backups.
- **Verdict:** **Best choice for now.** Since this is a new project, a VPS is perfect. You can run both your Node API and PostgreSQL database on the same VPS using `docker-compose`.

### **Option B: AWS (EC2 + RDS)**

- **Pros:** Enterprise-grade reliability, infinite scalability, managed database (RDS handles backups and scaling automatically).
- **Cons:** Expensive (RDS alone can be $15-$30/month minimum), steep learning curve, unpredictable billing if traffic spikes.
- **Verdict:** **Use this later.** Move to AWS when you start getting paying customers and need high availability and automated database backups.

---

## 2. Step-by-Step Deployment Guide (Using VPS & Docker)

Since you already have a `Dockerfile` and `docker-compose.yml`, deploying on a VPS (like Hostinger or DigitalOcean) is very straightforward.

### Step 1: Prepare the Server

1. Buy a VPS (Ubuntu 22.04 or 24.04).
2. SSH into your VPS: `ssh root@your_server_ip`
3. Install Docker and Docker Compose on the VPS.

### Step 2: Configure Environment Variables

1. Clone your GitHub repository to the VPS:
   ```bash
   git clone https://github.com/ahshobuj1/nyakaniniv-saas-backend.git
   cd nyakaniniv-saas-backend
   ```
2. Create your production `.env` file on the server:
   ```bash
   cp .env.demo .env
   nano .env
   ```
   _Set your `DATABASE_URL`, `JWT_SECRET`, Stripe keys, and AWS S3 credentials._

### Step 3: Aligning Server and Database (Docker Compose)

Your `docker-compose.yml` should be responsible for spinning up both the **PostgreSQL Database** and the **Express Server**.

Here is how the flow works:

1. Run the compose file in detached mode:
   ```bash
   docker-compose up -d --build
   ```
2. **Alignment:** Docker Compose creates an internal network. Your Node.js server container will be able to communicate with the PostgreSQL container using the service name (e.g., `db`).
   _Your production `DATABASE_URL` in the `.env` should look like this:_
   `DATABASE_URL="postgresql://user:password@db:5432/nyakaniniv_db?schema=public"` _(Notice the host is `db`, not `localhost`)_.

### Step 4: Run Prisma Migrations

Once the containers are running, you need to push your schema to the production database.

1. Execute the migration inside your running backend container:
   ```bash
   docker-compose exec backend bun run db:migrate:prod
   ```

### Step 5: Add reverse proxy (Nginx)

1. Point your domain's DNS (A Record) to your VPS IP address.
2. Install Nginx:
   ```bash
   sudo apt install nginx
   ```
3. Config:
   Create a new file at `/etc/nginx/sites-available/api` and add:

   ```nginx
   server {
       listen 80;

       server_name api.yourdomain.com;

       location / {
           # Use your actual port, 4000 or 3000
           proxy_pass http://localhost:4000;
       }
   }
   ```

4. Enable the configuration and restart Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/api /etc/nginx/sites-enabled/
   sudo systemctl restart nginx
   ```

### Step 6: Add HTTPS (SSL)

You don't want users accessing `http://your_ip:4000`. You want `https://api.yourdomain.com`.
Run Certbot to automatically generate a free SSL certificate:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

## 3. CI/CD (Continuous Deployment) - For the Future

Instead of manually SSH-ing into the server every time you push code to `main`:

1. Use **GitHub Actions**.
2. Write a workflow that automatically logs into your VPS via SSH, runs `git pull`, and executes `docker-compose up -d --build` whenever you merge code into the `main` branch.
