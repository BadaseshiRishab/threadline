# Deploying Threadline on AWS (Ubuntu + Docker)

The server builds and runs everything with `docker-compose.yml`: MongoDB, the four APIs and the four websites. The code comes from GitHub. Your secrets (`.env` files), database and uploaded documents do **not** go through GitHub; you copy them to the server over SSH.

| Site | Address on the server |
|---|---|
| Storefront | `http://<server IP>:8080` |
| Seller | `http://<server IP>:8081` |
| Admin | `http://<server IP>:8082` |
| Delivery partners | `http://<server IP>:8083` |

## 1. On your computer: export the data

With Docker Desktop running and the Docker setup up (`npm run docker:up`):

```
npm run docker:copy-db -- --force     # bring the Docker database up to date with your local one
npm run db:export                     # writes db-export/threadline-<date>.archive.gz
tar -czf uploads.tgz private_uploads  # seller signatures, licence and RC scans
```

Keep these files private: they contain customers' and sellers' personal data.

## 2. Create the EC2 server

- **AMI:** Ubuntu Server 24.04 LTS.
- **Instance type:** `t3.small` (2 GB RAM) or larger. Building the websites needs memory; on a 1 GB instance add swap first (see the end of this guide).
- **Storage:** 20 GB or more.
- **Security group, inbound:** SSH (22) from your IP; TCP 8080–8083 from anywhere. MongoDB is never exposed: it only listens on the server itself.
- Download the key pair (`.pem` file).

## 3. Install Docker on the server

```
ssh -i threadline.pem ubuntu@<server IP>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit
```

Log in again so the `docker` group applies.

## 4. Get the code

```
ssh -i threadline.pem ubuntu@<server IP>
git clone https://github.com/BadaseshiRishab/threadline.git
cd threadline
mkdir -p private_uploads
```

Create `private_uploads` yourself before the first start: the APIs run as user 1000 (the `ubuntu` user), and a folder Docker creates on its own would belong to root, so uploads would fail.

## 5. Copy secrets and data from your computer

In a terminal on your computer, from the project folder (PowerShell on Windows has `scp` and `tar` built in):

```
scp -i threadline.pem seller/backend/.env ubuntu@<server IP>:~/threadline/seller/backend/.env
scp -i threadline.pem admin/backend/.env  ubuntu@<server IP>:~/threadline/admin/backend/.env
scp -i threadline.pem db-export/threadline-<date>.archive.gz uploads.tgz ubuntu@<server IP>:~/
```

Use the same `.env` files: `DATA_ENCRYPTION_KEY` must stay the same, or sellers' bank details in the database can no longer be read.

## 6. Configure for the server

Back on the server, in `~/threadline`:

```
echo "PUBLIC_URL=http://<server IP>" > .env
tar -xzf ~/uploads.tgz -C ~/threadline
```

`PUBLIC_URL` makes the links between the sites (seller ↔ admin ↔ delivery) point at the server instead of localhost. In `seller/backend/.env` and `admin/backend/.env` set `OTP_DEV_CONSOLE=false`, so codes are never printed in logs.

**Change the admin login.** The example admin login (`admin@example.com` / `admin123`) is printed in this public repository, so anyone could use it. In `admin/backend/.env` on the server, set your own `ADMIN_EMAIL` and a long `ADMIN_PASSWORD` (at least 12 characters). You apply it to the database in step 7.

Keep `NODE_ENV=development` while the sites are on plain `http://`: with `production`, login cookies are sent over HTTPS only and nobody could sign in. Switch to `production` once you add a domain and HTTPS.

## 7. Start everything and load the data

```
docker compose up -d --build
docker compose ps                                   # wait until everything is "running" and mongo is "healthy"
sh scripts/db-import.sh ~/threadline-<date>.archive.gz
docker compose exec admin-api node scripts/setAdminPassword.js
```

The first build takes several minutes. The last command replaces the imported admin account's login with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the server's `admin/backend/.env` (the account was copied over with its old password, and the API only creates an admin when there is none). Run it again whenever you change them. Then open `http://<server IP>:8080` (and 8081–8083).

## Using the AWS database from your computer

The server's MongoDB is never open to the internet. Your computer reaches it through an SSH tunnel instead: local port 27019 leads to MongoDB on the server. The local `.env` files already point there (`MONGODB_URI=mongodb://127.0.0.1:27019/threadline`; the old local address is kept as a comment to switch back).

1. In `seller/backend/.env`, set `AWS_SSH_KEY` to the path of your `.pem` file (`AWS_HOST` is already the server's IP).
2. Windows' `ssh` refuses a key file other users can read. Once, in PowerShell:
   ```
   icacls C:\path\to\threadline.pem /inheritance:r /grant:r "$($env:USERNAME):(R)"
   ```
3. Open the tunnel and leave that terminal running:
   ```
   npm run db:tunnel
   ```
4. In another terminal, `npm run dev` works as usual, now against the AWS database. It warns you if the tunnel is not open.

With the tunnel open you can also load your local data straight into the server, instead of the export/import in steps 1 and 7 (PowerShell):

```
$env:TARGET_MONGODB_URI = "mongodb://127.0.0.1:27019/threadline"
npm run docker:copy-db -- --force
```

then on the server `docker compose restart seller-api admin-api user-api delivery-api` and `docker compose exec admin-api node scripts/setAdminPassword.js`.

## Updating after code changes

Push your changes to GitHub, then on the server:

```
cd ~/threadline
git pull
docker compose up -d --build
```

The database (Docker volume `threadline_mongo-data`) and `private_uploads` are kept.

## Useful commands

```
docker compose logs -f seller-api      # one service's output (seller-api, admin-api, user-api, delivery-api, *-web, mongo)
docker compose restart user-api
docker compose down                    # stop everything; data is kept
```

**Backups:** `npm run db:export` needs Node; on the server use the same commands directly:

```
docker compose exec -T mongo mongodump --quiet --db threadline --gzip --archive=/tmp/backup.archive.gz
docker compose cp mongo:/tmp/backup.archive.gz ~/threadline-backup-$(date +%F).archive.gz
```

## MongoDB version

The setup uses MongoDB **7.0**. MongoDB 8.0 and newer refuse to start on Linux kernels 6.19 to 7.0.13 (Ubuntu 26.04 on AWS ships kernel 7.0.0), with the log message *"Linux kernel versions 6.19 and newer has a known incompatibility with this version of MongoDB"* ([SERVER-121912](https://jira.mongodb.org/browse/SERVER-121912)). Kernel 7.0.14 and later fix it; until then keep 7.0. A database started by MongoDB 8 cannot be opened by 7.0, so switch versions only on an empty database, or export and re-import.

## Low-memory servers: add swap

```
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Payments and SMS on the server

- **Razorpay:** test keys work as they are. For live keys, activate the Razorpay account and add your site's address in the Razorpay dashboard.
- **Fast2SMS:** works from the server with the same API key.
