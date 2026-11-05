// One-off: download the referenced objects from DigitalOcean Spaces. Usage: node download-spaces.cjs <keys.json> <outDir>
const path = require('path');
const fs = require('fs');
const backend = path.join(__dirname, '..', '..', 'backend');
require(path.join(backend, 'node_modules', 'dotenv')).config({ path: path.join(backend, '.env') });
const { S3Client, GetObjectCommand } = require(path.join(backend, 'node_modules', '@aws-sdk', 'client-s3'));

const norm = (v) => String(v).replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/[“”"']/g, '').trim();
const s3 = new S3Client({
  endpoint: `https://${norm(process.env.DO_SPACES_ENDPOINT)}`,
  region: process.env.REGION,
  credentials: { accessKeyId: process.env.DO_SPACES_KEY, secretAccessKey: process.env.DO_SPACES_SECRET }
});
const bucket = norm(process.env.DO_SPACES_BUCKET);
const [keysFile, outDir] = process.argv.slice(2);

(async () => {
  const keys = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
  const report = { ok: 0, missing: [], bytes: 0 };
  for (const key of keys) {
    try {
      const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const buf = Buffer.from(await r.Body.transformToByteArray());
      const dest = path.join(outDir, ...key.split('/'));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      fs.writeFileSync(dest + '.ct', r.ContentType || 'application/octet-stream');
      report.ok++; report.bytes += buf.length;
    } catch (e) { report.missing.push(key + ' :: ' + e.name); }
  }
  console.log('downloaded', report.ok, 'files', (report.bytes / 1048576).toFixed(1), 'MB; missing', report.missing.length);
  report.missing.slice(0, 10).forEach((m) => console.log(' ', m));
})();
