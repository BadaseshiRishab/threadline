# Threadline seller marketplace

This workspace contains separate React/Webpack Seller, Admin, Customer (user) and Delivery partner apps with independent Node/Express backends. Both APIs share MongoDB and the same data-encryption key so approvals, inventory, and seller signatures stay consistent.

```text
admin/
	frontend/       Admin React/Webpack app
	backend/         Admin API routes
seller/
	frontend/       Seller React/Webpack app
	backend/         Seller API routes
user/
	frontend/       Customer storefront React/Webpack app
	backend/         Customer API routes
delivery/
	frontend/       Delivery partner React/Webpack app (mobile-first)
	backend/         Delivery partner API routes
seller/backend/
	src/             Standalone Seller API
admin/backend/
	src/             Standalone Admin API
```

## Prerequisites

- Node.js 20 or newer
- MongoDB 7 or newer, local or hosted
- An SMTP account for emailed codes and order updates (optional)
- A Fast2SMS account (or an Android phone, see below) for SMS

## Configure the backend

Copy `seller/backend/.env.example` to `seller/backend/.env` and `admin/backend/.env.example` to `admin/backend/.env`. Set the same MongoDB URI and the same base64 32-byte `DATA_ENCRYPTION_KEY` in both files to preserve access to existing encrypted bank data. Set different `JWT_SECRET` values per service; Seller also needs an `OTP_SECRET`. Production admin passwords must be at least 16 characters. Generate secrets with Node.js:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Use a different generated value for each secret, except `DATA_ENCRYPTION_KEY`, which must match between Seller and Admin. Add SMTP and Fast2SMS credentials to the Seller and Admin environments to enable OTP delivery. OTP values are never returned to the browser.

## Run locally

Start MongoDB on `127.0.0.1:27017` (the `MONGODB_URI` in both `.env` files), then from the workspace root:

```powershell
npm run setup   # first time only: installs every app's dependencies
npm run dev     # starts all eight apps; Ctrl+C stops them all
```

| App | URL |
| --- | --- |
| Seller web | http://localhost:5173 |
| Admin web | http://localhost:5174 |
| Customer storefront | http://localhost:5175 |
| Delivery partner app | http://localhost:5176 |
| Seller API | http://localhost:4001 |
| Admin API | http://localhost:4002 |
| Customer API | http://localhost:4003 |
| Delivery API | http://localhost:4004 |

Each frontend dev server proxies `/api` to its API, so open the web URLs rather than calling the APIs directly. The customer and delivery APIs read `seller/backend/.env`. Private seller signatures are stored in `private_uploads/` at the workspace root.

To import the DummyJSON catalog into a fresh database, run `npm run seed` once. It fetches every product from DummyJSON and imports images, reviews, specifications, stock, and pricing into the shared catalog; generated legacy catalog entries are retired without deleting their records. Prices use a default USD-to-INR multiplier of `83.5`, configurable with `DUMMYJSON_PRICE_MULTIPLIER` in `seller/backend/.env`. The seed needs outbound access to `dummyjson.com`.

To run a single app instead, `cd` into its folder and run `npm run dev`.

The Admin API seeds its account from `ADMIN_EMAIL` and `ADMIN_PASSWORD` on first start. The Admin and Seller APIs have separate HTTP-only session cookies and role routes, while sharing Mongo collections and the data-encryption key.

## Database

All three APIs use one MongoDB database (`threadline`). Every schema is defined once in `shared/models.js`; each backend registers it on its own mongoose connection through `src/models/index.js`, so the apps can never disagree about a field.

| Collection | Holds | Links to |
|---|---|---|
| `sellers` | Seller accounts, approval status and the encrypted seller application | |
| `customers` | Customer accounts, profile, addresses, cart and wishlist | |
| `admins` | Admin accounts | |
| `products` | The catalog | `seller` → sellers, `reviewedBy` → admins |
| `orders` | Customer orders, item snapshots, returns and the delivery OTP | `customer` → customers, `items.seller` → sellers, `items.product` → products |
| `reservations` | 30-minute holds on stock while an item sits in a bag | `customer` → customers, `product` → products |
| `restockrequests` | Admin requests for a seller to add stock | `seller` → sellers, `requestedBy` → admins, `product` → products |
| `deliverypartners` | Delivery partner accounts, created by admin | |
| `verifications` | One-time email/SMS codes for seller sign-up (expire automatically) | |

Sellers, customers and admins are separate collections, so an email or mobile number only has to be unique within its own account type: the same person can be a customer and a seller with separate passwords. Order items store a snapshot of the product (name, category, price), so orders and sales reports stay correct if a product is later edited or deleted.

Databases created before this layout kept every account in a single `users` collection. Run `npm run migrate:accounts` once to split it: the script backs up every collection as JSON to `../ravi-db-backup/`, moves each account (keeping its ID so all links still work), checks every document and link, and only then renames the old collection to `users_legacy_backup`. It is safe to re-run.

## Run with Docker

`docker-compose.yml` runs everything in containers: MongoDB, the four APIs and the four websites. Each website is built with webpack and served by nginx, which forwards its `/api` calls to that site's API. You need Docker Desktop running; Node and MongoDB on this computer are not needed for it.

```
npm run docker:up        # same as: docker compose up -d --build
```

| Site | Address |
|---|---|
| Storefront | http://localhost:8080 |
| Seller | http://localhost:8081 |
| Admin | http://localhost:8082 |
| Delivery partners | http://localhost:8083 |

- **Settings** come from the same files as `npm run dev`: `seller/backend/.env` (seller, customer and delivery APIs) and `admin/backend/.env`. They are passed to the containers when they start and are never copied into an image. Only the MongoDB address is replaced, to the `mongo` container.
- **Data** lives in the `mongo-data` Docker volume and survives `docker compose down` (`docker compose down -v` deletes it). The Docker database starts empty; to copy in what you have locally, run `npm run docker:copy-db` while the containers are up (add `-- --force` to replace existing data), then `docker compose restart seller-api admin-api user-api delivery-api`. It is also reachable from this computer at `mongodb://127.0.0.1:27018/threadline`, e.g. in MongoDB Compass.
- **Uploads** (signatures, licence and RC scans) stay in `./private_uploads`, shared with `npm run dev`.
- **Logs:** `docker compose logs -f seller-api` (or any other service name). **Stop:** `npm run docker:down`.
- **Ports:** set `USER_WEB_PORT`, `SELLER_WEB_PORT`, `ADMIN_WEB_PORT`, `DELIVERY_WEB_PORT` or `MONGO_HOST_PORT` in your shell, or in a `.env` file next to `docker-compose.yml`, to use other ports. To host on a server, set `PUBLIC_URL` (e.g. `http://203.0.113.10`) so the links between the sites point at it, and see the production notes below.

The Docker setup and `npm run dev` use different ports, so both can run at the same time.

To host it on a server (AWS EC2 with Ubuntu), follow [DEPLOY.md](DEPLOY.md).

## Production notes

Set `NODE_ENV=production`, use HTTPS, configure allowed frontend origins, and keep environment files and uploads out of source control. The role APIs share `private_uploads/` on disk; use private object storage for a public deployment. Configure Mongo authentication, backups, monitoring, SMTP deliverability, SMS sender registration (DLT), and a production cookie domain before launch. Online payments are not included; the storefront supports cash on delivery only.
## Delivery partners

People apply to become delivery partners in the delivery app at http://localhost:5176 (name, mobile, email, vehicle, vehicle number, driving licence and delivery area; bicycles need neither number nor licence). They can sign in straight away but only see their application status until admin reviews it under **Delivery partners** in the admin console. A rejected applicant sees the reason and can correct the details and resubmit.

Approved partners see the **open pool**: orders the seller has marked **packed** that have no partner yet (UPI orders join once admin confirms the payment). Orders that are not packed yet are never shown to partners, and admin can only assign a partner directly once the order is packed. Before accepting, a partner sees only the pickup sellers and the drop area; the customer's name, phone and exact address appear after they accept. Accepting is first-come-first-served, and a partner can hold at most 5 undelivered orders (`maxOpenJobs` in `shared/deliveryPartners.js`). A partner can release an accepted order back to the pool until they pick it up.

An accepted order moves like this:

1. The seller marks it **packed**, which puts it in the pool (sellers cannot ship or deliver an order once a partner has it).
2. Accepting gives each seller in the order a 4-digit **pickup code**, shown on that seller's orders page. At the pickup the seller reads it out and the partner enters it, confirming the handover; once every seller has handed over, the order is **picked up** (`shipped`). Five wrong codes issue a new one. The partner then marks it **out for delivery**.
3. At the door the partner enters the customer's 4-digit delivery OTP to mark it **delivered**; cash-on-delivery orders are marked paid at the same time.

Admin can still assign or reassign a partner from the pool list or an order's details, edit approved partners, reset their password (there is no self-service reset) and deactivate them once their open orders are reassigned. Orders nobody has accepted keep the original flow, where the seller can update the status and enter the OTP. Partners see the pickup address and phone number from each seller's application (never bank details), but never the delivery OTP or the pickup codes; the customer and admin never see the pickup codes either. Releasing or unassigning an order discards its pickup codes, and a new partner gets new ones.

## SMS, email and OTPs

Every API sends its messages through `shared/notify.js`, configured in `seller/backend/.env` (read by the seller, customer and delivery APIs) and `admin/backend/.env`:

| Setting | Purpose |
|---|---|
| `SMS_PROVIDER` | `fast2sms`, or `android` (your own phone, free; see below) |
| `FAST2SMS_API_KEY` | From the Fast2SMS dashboard under **Dev API**. Sending needs one wallet recharge of ₹100 or more |
| `ANDROID_SMS_URL`, `ANDROID_SMS_USER`, `ANDROID_SMS_PASSWORD` | The Local Server address and login shown in the SMS Gateway for Android app |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Email; for Gmail use `smtp.gmail.com`, `465`, `true` and an App Password |
| `OTP_SECRET` | Key used to hash verification codes (already set) |
| `OTP_DEV_CONSOLE` | `true` prints messages in the API console when a channel has no credentials (ignored in production) |

What is sent:

- **Sign-up:** customers, sellers and delivery partner applicants verify their mobile number with a 6-digit SMS code (and a rejected applicant who changes their number verifies the new one). The email address is only checked for format and that it is not already registered; it is not verified with a code.
- **Login:** customers and partners can sign in with a 6-digit code instead of a password, by SMS to their mobile number or by email to their address.
- **Delivery OTP:** when an order goes out for delivery the customer gets the 4-digit code by SMS (to the delivery address's phone) and email, and again if a new one is issued.
- **Pickup code:** when a partner accepts (or admin assigns) an order, each seller gets their pickup code by SMS and email, and again if a new one is issued.
- **Return codes:** when a partner accepts a return pickup the customer gets a return code, and once the partner has collected it the seller gets theirs.

Every code is generated by the API (codes for sign-up and login are stored only as a hash) and sent as a normal SMS to `+91` numbers through the provider in `SMS_PROVIDER`. Check the setup with `npm run sms:test -- 98XXXXXXXX`. Codes expire after 10 minutes, allow 5 wrong attempts and can be resent after 30 seconds. Verification is required whenever its channel is configured (always in production); until then sign-up works without it and the login-with-code option is hidden. Delivery OTPs, pickup codes and return codes are never shown in the apps: they arrive only by SMS (and email), and customers and sellers can tap **Resend** (once every 30 seconds) if a message does not arrive.

### Free SMS from your own Android phone

To send real OTPs to any number during development without paying gateway fees, route them through your own SIM card. The API posts each message to an app on your phone, and the phone sends it as a normal text.

1. On an Android phone with an active SIM and SMS pack, install **SMS Gateway for Android** from [sms-gate.app](https://sms-gate.app) (free and open source) and allow it to send SMS.
2. In the app, turn on **Local Server** and start it. Note the address (for example `http://192.168.1.20:8080`), username and password it shows.
3. In `seller/backend/.env` set:
   ```
   SMS_PROVIDER=android
   ANDROID_SMS_URL=http://192.168.1.20:8080
   ANDROID_SMS_USER=<username from the app>
   ANDROID_SMS_PASSWORD=<password from the app>
   ```
4. Send yourself a test message: `npm run sms:test -- 98XXXXXXXX`. Then restart `npm run dev`; each API logs `Other SMS: android (http://…)` at startup.

Keep the phone switched on, charged and on the same Wi-Fi as the computer running the APIs, and turn off battery optimisation for the app so Android does not stop it. With `SMS_PROVIDER=android`, every code, including sign-up and login codes, is sent from the phone. Texts count against your SIM plan, and carriers limit how many a personal SIM may send (often about 100 a day), so use a real SMS provider for production.
