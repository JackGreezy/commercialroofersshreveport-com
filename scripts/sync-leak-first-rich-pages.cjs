const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const manifestPath = path.join(root, "data", "leak-first-funnel.json");
if (!fs.existsSync(manifestPath)) process.exit(0);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
for (const page of manifest.pages || []) {
  const source = path.join(root, page.source);
  const destination = path.join(root, page.destination);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}
const vercelPath = path.join(root, "vercel.json");
if (fs.existsSync(vercelPath)) {
  const vercel = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
  let rewrites = Array.isArray(vercel.rewrites) ? vercel.rewrites : [];
  for (const page of manifest.pages || []) {
    const sources = page.route === "/" ? ["/"] : [page.route, `${page.route}/`];
    rewrites = rewrites.filter((item) => !sources.includes(item.source));
    const broad = rewrites.findIndex((item) => ["/(.*)", "/:path*", "/(.*)*", "/(.*)?"].includes(item.source));
    const index = broad < 0 ? rewrites.length : broad;
    const exact = sources.map((source) => ({ source, destination: `/${page.destination.replace(/^public\//, "")}` }));
    rewrites = [...rewrites.slice(0, index), ...exact, ...rewrites.slice(index)];
  }
  vercel.rewrites = rewrites;
  fs.writeFileSync(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`);
}
console.log(`Synced ${(manifest.pages || []).length} durable leak-first page(s).`);
