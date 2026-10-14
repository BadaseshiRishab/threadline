// Loads the settings; server.js imports this first, so they are in place before anything reads them.
// This API's own .env (delivery/backend/.env) is read first, then the MongoDB, JWT_SECRET and SMS settings it shares
// with the seller and customer APIs (seller/backend/.env, or the file named by DELIVERY_ENV_FILE). Sessions are still
// separate because each role derives its own key. A value that is already set, e.g. by docker-compose, is never replaced.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
dotenv.config({ path: path.join(backendDir, '.env'), quiet: true })
dotenv.config({ path: process.env.DELIVERY_ENV_FILE || path.join(backendDir, '../../seller/backend/.env'), quiet: true })
