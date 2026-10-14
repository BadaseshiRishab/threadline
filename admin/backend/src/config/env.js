// Loads the settings from .env next to package.json; server.js imports this first, so they are in place before
// anything reads them. A value that is already set, e.g. by docker-compose, is never replaced.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env'), quiet: true })
