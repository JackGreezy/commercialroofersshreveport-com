import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const growthUrl = '/rankhound-conversion-events.js?v=' + crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'public/rankhound-conversion-events.js'))).digest('hex').slice(0, 12);
const tag = '<script defer src="' + growthUrl + '"></script>';
const legacyFiles = fs.readdirSync(path.join(root,'public')).filter(name => /-conversion-events\.js$/.test(name) && name !== 'rankhound-conversion-events.js').filter(name => {
 const content=fs.readFileSync(path.join(root,'public',name),'utf8').replace(/__\w+ConversionEvents/g,'__legacyConversionEvents');
 return crypto.createHash('sha256').update(content).digest('hex') === '668fcf5aac098d3edeb9050bde1cf0d8efb69d1be5e3a5fc6ddb8e304eb70ca1';
});
const legacyPattern = legacyFiles.length ? new RegExp('(<script\\b[^>]*\\bsrc=)["\']/(' + legacyFiles.map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')(?:\\?[^"\']*)?["\']','gi') : null;
function replaceLegacy(html) { return legacyPattern ? html.replace(legacyPattern, '$1"' + growthUrl + '"') : html; }
const scriptTag = /<script\b[^>]*\bsrc=["']\/(?:rankhound|fgfll)-conversion-events\.js(?:\?[^"']*)?["'][^>]*>/i;
function optionalFields(html) {
  return html.replace(/<(?:input|select|textarea)\b[^>]*>/gi, opening =>
    /\bname=["'](?:timeline|address|message)["']/i.test(opening)
      ? opening.replace(/\srequired(?:=(?:["'][^"']*["']|\{true\}|true))?/gi, '') : opening);
}
function transform(html) {
  let next = replaceLegacy(optionalFields(html)).replace(/(<script\b[^>]*\bsrc=)["']\/(?:rankhound|fgfll)-conversion-events\.js(?:\?[^"']*)?["']/gi, '$1' + '"' + growthUrl + '"');
  if (!scriptTag.test(next)) {
    const index = next.toLowerCase().lastIndexOf('</body>');
    next = index < 0 ? next + tag : next.slice(0, index) + tag + next.slice(index);
  }
  var seenGrowth = false;
  next = next.replace(/<script\b[^>]*\bsrc=["']\/rankhound-conversion-events\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gi, element => { if (seenGrowth) return ''; seenGrowth = true; return element; });
  return next.replace(/<script\b[^>]*\bsrc=["']\/(?:rankhound|fgfll)-conversion-events\.js(?:\?[^"']*)?["'][^>]*>/gi, opening =>
    opening.replace(/integrity=(["'])(.*?)\1/i, (_, quote, values) => {
      const bytes = fs.readFileSync(path.join(root, 'public/rankhound-conversion-events.js'));
      const hashes = values.split(/\s+/).map(value => {
        const algorithm = value.split('-')[0];
        return ['sha256', 'sha384', 'sha512'].includes(algorithm) ? algorithm + '-' + crypto.createHash(algorithm).update(bytes).digest('base64') : value;
      });
      return 'integrity=' + quote + hashes.join(' ') + quote;
    }));
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.html?$/i.test(entry.name)) {
      const before = fs.readFileSync(file, 'utf8'); const after = transform(before);
      if (after !== before) fs.writeFileSync(file, after);
    }
  }
}
walk(path.join(root, 'public'));
execFileSync(process.execPath, [path.join(root, 'scripts/ensure-roofing-home-locality.mjs')], { cwd: root, stdio: 'inherit' });
for (const relative of ['app/lib/sitePage.tsx', 'app/ContactHydrator.tsx', 'app/site-renderer.jsx']) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8'); const after = optionalFields(before);
  if (after !== before) fs.writeFileSync(file, after);
}
for (const relative of ['app/layout.tsx', 'app/layout.jsx', 'app/layout.js']) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  if (!before.includes('</body>')) continue;
  let after = replaceLegacy(before).replace(/<script\b[^>]*\bsrc=["']\/turnstile-contact\.js["'][^>]*\/?>\s*(?:<\/script>)?/gi, '');
  after = after.replace(/(<script\b[^>]*\bsrc=)["']\/(?:rankhound|fgfll)-conversion-events\.js(?:\?[^"']*)?["']/gi, '$1' + '"' + growthUrl + '"');
  if (!after.includes('data-rh-growth-react')) after = after.replace(/<html\b/, '<html data-rh-growth-react=""');
  if (!after.includes('import RankHoundGrowth')) after = after.replace(/^(\s*["']use client["'];?\s*)?/, (prefix) => prefix + 'import RankHoundGrowth from "./RankHoundGrowth";\n');
  if (!after.includes('<RankHoundGrowth')) after = after.replace('</body>', '<RankHoundGrowth /></body>');
  if (!after.includes('/rankhound-conversion-events.js')) after = after.replace('</body>', '<script defer src="' + growthUrl + '" /></body>');
  fs.writeFileSync(file, after);
  const contactLoader = fs.existsSync(path.join(root, 'public/turnstile-contact.js')) ? `
    if (!document.querySelector('script[data-rh-contact-ready]')) {
      const script = document.createElement('script');
      script.src = '/turnstile-contact.js';
      script.dataset.rhContactReady = 'true';
      document.body.appendChild(script);
    }` : '';
  fs.writeFileSync(path.join(root, 'app/RankHoundGrowth.jsx'), `"use client";
import { useEffect } from "react";
export default function RankHoundGrowth() {
  useEffect(() => {
    window.__rankhoundGrowthHydrated = true;
    document.dispatchEvent(new Event("rankhound:hydrated"));${contactLoader}
  }, []);
  return null;
}
`);
}

// Stop a build if an earlier generator changes the existing security controls.
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'data/roofing-growth-security-baseline.json'), 'utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const handlerSource = fs.readFileSync(path.join(root, baseline.handlerFile), 'utf8');
const normalizedHandler = handlerSource.replace(/const REQUIRED_FIELDS = \[[^\]]+\];/, 'const REQUIRED_FIELDS = ["name", "phone", "email"];').replace(/leadAccepted: true,\s*/g, '');
if (sha256(normalizedHandler) !== baseline.handlerNormalizedSha256) throw new Error('Existing lead security or mail routing was changed by a build generator');
if (!/const REQUIRED_FIELDS = \["name", "phone", "email"\];/.test(handlerSource) || !handlerSource.includes('leadAccepted: true')) throw new Error('Callback handler was overwritten by a build generator');
const currentPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (sha256(JSON.stringify({dependencies:currentPackage.dependencies||{},devDependencies:currentPackage.devDependencies||{}})) !== baseline.dependenciesSha256) throw new Error('Contact rollout must preserve dependency versions');
for (const file of baseline.securityFiles) {
  if (sha256(fs.readFileSync(path.join(root, file.path))) !== file.sha256) throw new Error('Existing security file was changed: ' + file.path);
}
