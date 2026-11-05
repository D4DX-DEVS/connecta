// One-off: dump every Mongo collection to JSON. Usage: node -r ../../backend/dev-dns.js dump-mongo.cjs <outfile>
const path = require('path');
const backend = path.join(__dirname, '..', '..', 'backend');
require(path.join(backend, 'node_modules', 'dotenv')).config({ path: path.join(backend, '.env') });
const mongoose = require(path.join(backend, 'node_modules', 'mongoose'));
const fs = require('fs');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const out = {};
  for (const { name } of await db.listCollections().toArray()) {
    out[name] = await db.collection(name).find({}).toArray();
    console.log(name.padEnd(20), out[name].length);
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out));
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
