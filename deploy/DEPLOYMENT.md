# Deploying stock-analyzer to AWS EC2

End-to-end walkthrough for standing up a production instance of the app on EC2,
fronted by nginx + TLS, with a `dev`/`main` Git workflow and auto-deploy on
merge to `main`.

This doc is the plan. The actual config lives in:

- `deploy/docker-compose.prod.yml` — production override for compose
- `deploy/nginx-host.conf` — host nginx reverse proxy (goes on the EC2)
- `.github/workflows/deploy.yml` — GitHub Actions auto-deploy

---

## 0. Before you start — security group fixes

The current security group has two issues:

1. **SSH (port 22) is open to `0.0.0.0/0`.** Delete that rule. Keep only the
   `47.186.12.177/32` rule (or whatever your current IP is). Security group
   rules are additive, so an open rule always wins.
2. **Ports 5001 and 5173 are publicly reachable.** Once nginx is in front of
   everything those ports should be closed — clients should only ever hit
   80/443. Delete the 5001 and 5173 rules.
3. **Port 443 is missing.** Add an inbound rule: TCP 443, source `0.0.0.0/0`.

After the cleanup you should have exactly:

| Port | Source | Purpose |
|------|--------|---------|
| 22   | your IP /32 | SSH |
| 80   | 0.0.0.0/0 | HTTP (redirects to HTTPS) |
| 443  | 0.0.0.0/0 | HTTPS |

---

## 1. Prep the code (one-time, local)

### 1.1 Add gunicorn to the backend

Append one line to `server/requirements.txt`:

```
gunicorn==23.0.0
```

The prod compose file runs gunicorn as the entrypoint; `python run.py` (Flask
dev server) is never used in production because it's single-threaded and has
debug mode baked in.

### 1.2 Create the `dev` branch and protect both branches

```bash
git checkout main
git pull
git checkout -b dev
git push -u origin dev
```

On GitHub, go to **Settings → Branches → Add rule** and add a rule for each
of `main` and `dev`:

- Require pull requests before merging
- Require at least 1 approval (`main` at minimum)
- Require status checks to pass (add your CI check once it exists)
- Do not allow force pushes
- Do not allow deletions

Also set `dev` as the default branch in Settings → General so feature branches
branch off `dev` by default.

### 1.3 Commit the deploy files

The three files in this PR are the minimum for a reproducible production
deploy. Merge them into `main` the first time manually; after that, the
GitHub Action takes over.

---

## 2. Provision & prepare the EC2

SSH in (`ssh -i your-key.pem ubuntu@<elastic-ip>`) and run:

```bash
# System updates
sudo apt update && sudo apt upgrade -y

# Docker + Compose plugin
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Let your user run docker without sudo
sudo usermod -aG docker $USER
# Log out and back in for the group change to take effect

# nginx + certbot for TLS
sudo apt install -y nginx certbot python3-certbot-nginx

# git
sudo apt install -y git
```

### 2.1 Clone the repo

```bash
sudo mkdir -p /opt/stock-analyzer
sudo chown $USER:$USER /opt/stock-analyzer
git clone https://github.com/Tjzeller12/stock-analyzer.git /opt/stock-analyzer
cd /opt/stock-analyzer
git checkout main
```

For private repos: generate an SSH deploy key on the server
(`ssh-keygen -t ed25519`), add the public key as a read-only deploy key on
GitHub (**Settings → Deploy keys**), and clone with the SSH URL.

### 2.2 Write `.env`

Still in `/opt/stock-analyzer`:

```bash
cat > .env <<'EOF'
PUBLIC_DOMAIN=app.yourdomain.com

POSTGRES_DB=stockdb
POSTGRES_USER=stockuser
POSTGRES_PASSWORD=<long random string>

SECRET_KEY=<long random string>

ALPHA_VANTAGE_KEY=<real key>
ANTHROPIC_API_KEY=<real key>
EOF
chmod 600 .env
```

Generate strong secrets with `openssl rand -hex 32`.

**Never commit this file.** Confirm `.env` is in `.gitignore` before you push
anything.

---

## 3. DNS + TLS

1. In your DNS provider (Route 53, Cloudflare, whatever), add an **A record**:
   `app.yourdomain.com` → the Elastic IP you attached.
2. Wait until `dig app.yourdomain.com` returns the right IP (usually seconds).
3. On the EC2, install the nginx config:

   ```bash
   sudo cp /opt/stock-analyzer/deploy/nginx-host.conf \
           /etc/nginx/sites-available/stock-analyzer
   sudo sed -i 's/app\.yourdomain\.com/<your actual domain>/g' \
           /etc/nginx/sites-available/stock-analyzer
   sudo ln -sf /etc/nginx/sites-available/stock-analyzer \
               /etc/nginx/sites-enabled/stock-analyzer
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t && sudo systemctl reload nginx
   ```

   At this point the `:443` block will fail nginx's check because the
   certs don't exist yet — temporarily comment out the `listen 443` block
   and reload, then proceed.

4. Get a cert:

   ```bash
   sudo certbot --nginx -d app.yourdomain.com
   ```

   Certbot will edit `stock-analyzer` to add the real cert paths and the
   HTTP→HTTPS redirect. Auto-renew is installed as a systemd timer.

---

## 4. First deploy (manual)

```bash
cd /opt/stock-analyzer
docker compose \
  -f docker-compose.yml \
  -f deploy/docker-compose.prod.yml \
  --env-file .env \
  up -d --build
```

The backend container runs `flask db upgrade` on start, so migrations apply
automatically.

Verify:

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps
curl -I https://app.yourdomain.com
curl -I https://app.yourdomain.com/api/          # should 404 or similar, NOT refuse
```

Then open the site in a browser and do a full login/portfolio round-trip.

---

## 5. Wire up GitHub Actions auto-deploy

In the GitHub repo, go to **Settings → Secrets and variables → Actions** and
add:

| Secret | Value |
|--------|-------|
| `EC2_HOST` | `app.yourdomain.com` (or the Elastic IP) |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | the full contents of your `.pem` private key |
| `EC2_APP_DIR` | `/opt/stock-analyzer` |

Then push `.github/workflows/deploy.yml` to `main`. Every subsequent merge to
`main` will trigger a deploy. You can also kick off a deploy manually from
the Actions tab.

Test it: make a trivial change on `dev`, PR it to `main`, merge, watch the
Action run.

---

## 6. Day-to-day Git workflow

```
feature/*  ──▶  dev  ──▶  main
                           │
                           └── auto-deploys to EC2
```

- **Never commit directly to `main` or `dev`.** Both are PR-only.
- Work happens on `feature/*` branches cut from `dev`.
- Feature PRs merge into `dev`. `dev` is where you confirm the *combined*
  state works — ideally by pointing a staging compose stack at it (see
  section 7), otherwise by running it locally.
- When `dev` is in a shippable state, open a PR `dev → main`. Merging that
  PR **is** the release. The Action deploys within a couple minutes.
- Tag each release on `main`:

  ```bash
  git checkout main && git pull
  git tag -a v1.2.0 -m "Release 1.2.0 — <headline change>"
  git push --tags
  ```

  Rolling back is then `git checkout v1.1.0` on the server and
  `docker compose ... up -d --build`.

### Hotfix flow

If `main` is broken and you can't wait for `dev`:

```bash
git checkout main && git pull
git checkout -b hotfix/short-name
# fix, commit
git push -u origin hotfix/short-name
```

Open PRs into **both** `main` (to deploy) and `dev` (to keep it in sync).

---

## 7. (Optional but recommended) Staging on the same EC2

Same box, second compose stack, a different subdomain like
`staging.yourdomain.com` pointing at the `dev` branch. The shape:

- Second clone at `/opt/stock-analyzer-staging`, checked out to `dev`.
- Second compose file that binds to `127.0.0.1:5174` / `127.0.0.1:5002` and
  uses a separate database volume (`postgres_data_staging`).
- Second nginx server block for `staging.yourdomain.com` proxying to those
  ports.
- Second GitHub Action on `push: branches: [dev]` that deploys to the
  staging directory.

This gives you somewhere real to click around on `dev` before it hits `main`.
Worth it the day something that "worked locally" breaks in production.

---

## 8. Ongoing ops hygiene

- **Backups.** Add a cron that runs nightly:

  ```
  0 3 * * * docker compose -f /opt/stock-analyzer/docker-compose.yml exec -T db \
      pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > /var/backups/stockdb-$(date +\%F).sql.gz
  ```

  Then ship those to S3 with a lifecycle policy.

- **Log rotation.** Add `/etc/docker/daemon.json`:

  ```json
  { "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" } }
  ```

  Restart docker: `sudo systemctl restart docker`. Without this, container
  logs will fill the disk in a few months.

- **Monitoring.** Start with CloudWatch alarms on CPU, memory, disk, and
  status-check failures. Page yourself (SNS → email or SMS) on any of them.

- **Unattended security upgrades.** `sudo apt install -y unattended-upgrades`
  and enable — this instance is internet-facing.

---

## Quick reference

```bash
# Check what's running
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps

# Tail logs
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml logs -f backend

# Manual re-deploy (same thing the Action does)
git pull && docker compose \
  -f docker-compose.yml -f deploy/docker-compose.prod.yml \
  --env-file .env up -d --build

# Run a one-off migration / shell
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml \
  exec backend flask db upgrade
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml \
  exec backend bash

# Roll back to a tagged release
git fetch --tags && git checkout v1.1.0
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml \
  --env-file .env up -d --build
```
