// Loads the settings; server.js imports this first, so they are in place before anything reads them.
// This API's own .env (customer/backend/.env) is read first, then the settings it shares with the seller and delivery
// APIs (seller/backend/.env, or the file named by CUSTOMER_ENV_FILE). A value that is already set, e.g. by
// docker-compose, is never replaced.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
dotenv.config({ path: path.join(backendDir, '.env'), quiet: true })
dotenv.config({ path: process.env.CUSTOMER_ENV_FILE || path.join(backendDir, '../../seller/backend/.env'), quiet: true })
