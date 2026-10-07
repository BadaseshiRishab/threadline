// Copies the Threadline database from the MongoDB used by `npm run dev` into the one docker-compose runs, so the
// Docker sites start with your existing products, accounts and orders. Run it while `docker compose up` is running:
//   npm run docker:copy-db                 copy, refusing if the Docker database already has data
//   npm run docker:copy-db -- --force      replace whatever the Docker database has
// SOURCE_MONGODB_URI and TARGET_MONGODB_URI override the defaults below.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
// The MongoDB driver comes with mongoose in the seller API's dependencies.
const { MongoClient } = createRequire(path.join(root, 'seller/backend/package.json'))('mongodb')

const sourceUri = process.env.SOURCE_MONGODB_URI || 'mongodb://127.0.0.1:27017/threadline'
const targetUri = process.env.TARGET_MONGODB_URI || `mongodb://127.0.0.1:${process.env.MONGO_HOST_PORT || 27018}/threadline`
const force = process.argv.includes('--force')
const hidden = (uri) => uri.replace(/\/\/[^@/]*@/, '//<credentials>@')

const source = new MongoClient(sourceUri, { serverSelectionTimeoutMS: 5000 })
const target = new MongoClient(targetUri, { serverSelectionTimeoutMS: 5000 })
try {
  await source.connect().catch((error) => { throw new Error(`Cannot reach the source database ${hidden(sourceUri)}: ${error.message}`) })
  await target.connect().catch((error) => { throw new Error(`Cannot reach the Docker database ${hidden(targetUri)}. Is \`docker compose up\` running? (${error.message})`) })
  const from = source.db()
  const to = target.db()
  const collections = (await from.listCollections({}, { nameOnly: true }).toArray()).map((entry) => entry.name).filter((name) => !name.startsWith('system.'))
  if (!force) {
    const filled = []
    for (const name of collections) if (await to.collection(name).estimatedDocumentCount()) filled.push(name)
    if (filled.length) throw new Error(`The Docker database already has data (${filled.join(', ')}). Run again with --force to replace it.`)
  }
  console.log(`Copying ${hidden(sourceUri)} -> ${hidden(targetUri)}`)
  for (const name of collections) {
    const documents = await from.collection(name).find().toArray()
    await to.collection(name).deleteMany({})
    if (documents.length) await to.collection(name).insertMany(documents, { ordered: false })
    console.log(`  ${name}: ${documents.length}`)
  }
  console.log('Done. Restart the APIs so they rebuild their indexes: docker compose restart seller-api admin-api user-api delivery-api')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await Promise.all([source.close(), target.close()])
}
