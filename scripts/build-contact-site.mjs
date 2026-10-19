import { spawnSync } from "node:child_process";
const result = spawnSync("node scripts/normalize-contact-forms.mjs && node scripts/finalize-lead-controls.mjs && node scripts/ensure-visible-phone.mjs && node scripts/build-fleet-delivery.mjs && node scripts/inject-turnstile.mjs && node scripts/normalize-contact-forms.mjs && node scripts/repair-contact-surfaces.mjs", { shell: true, stdio: "inherit" });
process.exit(result.status ?? 1);
