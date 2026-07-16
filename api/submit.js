const contactConfig = {"name": "Commercial Roofers of Shreveport", "domain": "commercialroofersshreveport.com", "address": "401 Edwards St, Suite 1100, Shreveport, LA 71101", "phone": "555-555-6135", "phoneTel": "5555556135", "email": "hello@commercialroofersshreveport.com", "city": "Shreveport", "state": ""};

const DEFAULT_TEMPLATE_ID = "d-15217ab1c55347b5847c2421b1a82847";
const buckets = new Map();
const LIMIT = 5;
const WINDOW_MS = 60 * 1000;
const REQUIRED_FIELDS = ["name", "phone", "email", "timeline", "message"];
const emailTheme = {
  accent: "#c2502a", accentText: "#ffffff", ctaDarkBg: "#1c2426", bg: "#eef1f4", card: "#ffffff",
  headerBg: "#ffffff", headerText: "#1c2426", footerBg: "#f6f8f9", border: "#e3e8ed",
  textDark: "#1c2426", textBody: "#3a4654", textMuted: "#64727f", textFaint: "#9aa6b2",
  fontHeading: "'Lato', Helvetica, Arial, sans-serif", fontBody: "'Lato', Helvetica, Arial, sans-serif",
  fontImport: "https://fonts.googleapis.com/css2?family=Lato:wght@400;700;800&display=swap", logoUrl: "/images/brand/logo.png"
};

function clean(value) { return String(value || "").trim(); }
function unique(values) { return [...new Set(values.map((value) => clean(value).toLowerCase()).filter(Boolean))]; }
function absUrl(siteUrl, url) { const u = clean(url); if (!u) return ""; if (/^https?:\/\//i.test(u)) return u; return `${clean(siteUrl).replace(/\/+$/, "")}/${u.replace(/^\/+/, "")}`; }
function siteUrl(req) { const configured = clean(process.env.NEXT_PUBLIC_SITE_URL); if (configured) return configured.replace(/\/+$/, ""); const host = clean(req.headers["x-forwarded-host"] || req.headers.host) || contactConfig.domain; const protocol = clean(req.headers["x-forwarded-proto"]) || "https"; return `${protocol}://${host}`; }
function siteHost(url) { try { return new URL(url).hostname; } catch { return clean(url).replace(/^https?:\/\//, "").replace(/\/.*$/, "") || contactConfig.domain; } }
function parseRecipients(value) { return clean(value).split(/[\n,;]/).map((entry) => entry.trim()).filter(Boolean); }
function clientIp(req) { return clean(req.headers["cf-connecting-ip"]) || clean(req.headers["x-forwarded-for"]).split(",")[0] || clean(req.headers["x-real-ip"]) || "unknown"; }
function rateLimit(req) { const key = clientIp(req); const now = Date.now(); const current = buckets.get(key) || { count: 0, reset: now + WINDOW_MS }; if (current.reset <= now) { current.count = 0; current.reset = now + WINDOW_MS; } current.count += 1; buckets.set(key, current); return { allowed: current.count <= LIMIT, remaining: Math.max(0, LIMIT - current.count), reset: current.reset }; }
function readBody(req) { return new Promise((resolve, reject) => { let body = ""; req.on("data", (chunk) => { body += chunk; if (body.length > 1_000_000) req.destroy(); }); req.on("end", () => resolve(body)); req.on("error", reject); }); }
async function readPayload(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (req.body && typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return Object.fromEntries(new URLSearchParams(req.body).entries()); } }
  const raw = await readBody(req);
  const type = clean(req.headers["content-type"]);
  if (type.includes("application/json")) return raw ? JSON.parse(raw) : {};
  return Object.fromEntries(new URLSearchParams(raw).entries());
}
function normalizeLead(body, req) {
  const first = clean(body.firstName || body.first_name || body.first);
  const last = clean(body.lastName || body.last_name || body.last);
  const name = clean(body.name || body.fullName || body.full_name || [first, last].filter(Boolean).join(" "));
  const message = clean(body.message || body.projectDetails || body.project_details || body.details || body.info || body.comments || body.notes);
  const address = clean(body.address || body.propertyAddress || body.property_address || body["property-address"] || body.streetAddress || body.street_address || body["street-address"] || body.buildingAddress || body.building_address || body["building-address"] || body.organization);
  const page = clean(body.page || body.sourcePage || req.headers.referer);
  const serviceType = clean(body.serviceType || body.service || body.projectType || body.project_type) || "Commercial Roofing";
  const timeline = clean(body.timeline || body.projectTimeline || body.project_timeline || body.when || body.timeframe);
  return { name, fullName: name, phone: clean(body.phone || body.phoneNumber || body.phone_number || body.telephone || body.tel), email: clean(body.email || body.emailAddress || body.email_address), address, propertyAddress: address, serviceType, projectType: serviceType, timeline, projectTimeline: timeline, message, projectDetails: message, page, submittedAt: new Date().toISOString() };
}
function validateLead(lead) { const missing = REQUIRED_FIELDS.filter((key) => !clean(lead[key])); if (missing.length) return `Missing required field: ${missing.join(", ")}`; if (!/^\S+@\S+\.\S+$/.test(lead.email)) return "Please enter a valid email address."; const phoneDigits = lead.phone.replace(/\D/g, ""); if (phoneDigits.length < 7 || !/^[0-9()+\-\s.]+$/.test(lead.phone)) return "Please enter a valid phone number."; return ""; }
async function sendTemplateEmail(params) {
  const apiKey = clean(process.env.SENDGRID_API_KEY); if (!apiKey) throw new Error("SENDGRID_API_KEY is missing.");
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: { email: params.fromEmail, name: params.fromName }, reply_to: { email: params.replyTo, name: params.fromName }, template_id: params.templateId, categories: ["contact-form", params.siteHost.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "website-contact", params.notificationType], personalizations: [{ to: [{ email: params.to }], dynamic_template_data: params.dynamicTemplateData }], custom_args: { notification_type: params.notificationType, site_host: params.siteHost, from_name: params.fromName } }) });
  if (!response.ok) { const details = await response.text().catch(() => ""); throw new Error(`SendGrid request failed (${response.status}): ${details}`); }
}
async function sendLeadEmails(lead, req) {
  const url = siteUrl(req); const host = siteHost(url);
  const from = { email: clean(process.env.SENDGRID_FROM_EMAIL) || clean(process.env.BUSINESS_EMAIL) || contactConfig.email || `info@${host}`, name: clean(process.env.SENDGRID_FROM_NAME) || clean(process.env.BUSINESS_NAME) || contactConfig.name };
  const replyTo = clean(process.env.SENDGRID_REPLY_TO) || clean(process.env.BUSINESS_EMAIL) || contactConfig.email || from.email;
  const templateId = clean(process.env.SENDGRID_TEMPLATE_ID || process.env.SENDGRID_TEMPLATE_CONFIRMATION || DEFAULT_TEMPLATE_ID);
  const recipients = unique([process.env.RANKHOUND_NOTIFICATION_EMAIL || "rankhoundseo@gmail.com", ...parseRecipients(process.env.CONTACT_NOTIFICATION_RECIPIENTS), process.env.CONTRACTOR_EMAIL, process.env.LEAD_NOTIFICATION_EMAIL]);
  const serviceLabel = clean(lead.serviceType || lead.projectType) || "Commercial Roofing";
  const callPhone = clean(process.env.BUSINESS_PHONE || process.env.CONTRACTOR_PHONE || process.env.NEXT_PUBLIC_BUSINESS_PHONE || process.env.NEXT_PUBLIC_PHONE || contactConfig.phone);
  const callPhonePlain = callPhone.replace(/\D/g, "") || clean(contactConfig.phoneTel).replace(/\D/g, "");
  const submittedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const leadData = { name: lead.name, fullName: lead.name, email: lead.email, emailAddress: lead.email, phone: lead.phone, phoneNumber: lead.phone, phone_plain: lead.phone.replace(/\D/g, ""), address: lead.address, propertyAddress: lead.address, projectType: serviceLabel, serviceType: serviceLabel, timeline: lead.timeline, projectTimeline: lead.timeline, projectDescription: lead.message, projectDetails: lead.message, message: lead.message, page: lead.page, submittedAt: lead.submittedAt };
  const dynamicTemplateData = { lead: leadData, ...leadData, subject: `Thanks for your ${serviceLabel} Inquiry`, preheader: `Thanks${lead.name ? ` ${lead.name}` : ""}, we received your ${serviceLabel} inquiry and will follow up shortly.`, company_name: from.name, companyName: from.name, brand_title: from.name, logo_url: absUrl(url, clean(process.env.SENDGRID_LOGO_URL) || emailTheme.logoUrl), logoUrl: absUrl(url, clean(process.env.SENDGRID_LOGO_URL) || emailTheme.logoUrl), header_bg: process.env.SENDGRID_HEADER_BG || emailTheme.headerBg || "", city_state: "", brand_accent: process.env.SENDGRID_BRAND_ACCENT || emailTheme.accent, accent_text: process.env.SENDGRID_ACCENT_TEXT || emailTheme.accentText, cta_dark_bg: process.env.SENDGRID_CTA_DARK_BG || emailTheme.ctaDarkBg, bg_color: process.env.SENDGRID_BG_COLOR || emailTheme.bg, text_dark: process.env.SENDGRID_TEXT_DARK || emailTheme.textDark, text_muted: process.env.SENDGRID_TEXT_MUTED || emailTheme.textMuted, text_body: process.env.SENDGRID_TEXT_BODY || emailTheme.textBody, text_faint: process.env.SENDGRID_TEXT_FAINT || emailTheme.textFaint, border_color: process.env.SENDGRID_BORDER_COLOR || emailTheme.border, card_header_bg: process.env.SENDGRID_CARD_HEADER_BG || emailTheme.footerBg, font_family: process.env.SENDGRID_FONT_FAMILY || emailTheme.fontBody, heading_font_family: process.env.SENDGRID_HEADING_FONT || emailTheme.fontHeading, body_font_family: process.env.SENDGRID_BODY_FONT || emailTheme.fontBody, font_import: process.env.SENDGRID_FONT_IMPORT || emailTheme.fontImport, hero_title: lead.name ? `Thanks, ${lead.name}. We received your ${serviceLabel} inquiry.` : `We received your ${serviceLabel} inquiry.`, hero_subtitle: "Our team will review your details and reach out shortly.", details_title: "Your project details", call_cta_label: "Call Now", call_phone: callPhone, call_phone_plain: callPhonePlain, site_cta_label: "Go To Site", site_url: url, siteUrl: url, site_host: host, supportEmail: replyTo, supportPhone: callPhone, address_line: "", footer_note: "This confirmation is a transactional email related to your request.", submitted_date: submittedDate, source: url, page: lead.page };
  await Promise.all([sendTemplateEmail({ to: lead.email, fromEmail: from.email, fromName: from.name, replyTo, templateId, notificationType: "customer_confirmation", siteHost: host, dynamicTemplateData: { ...dynamicTemplateData, notification_type: "customer_confirmation" } }), ...recipients.map((to) => sendTemplateEmail({ to, fromEmail: from.email, fromName: from.name, replyTo, templateId, notificationType: "internal_notification", siteHost: host, dynamicTemplateData: { ...dynamicTemplateData, notification_type: "internal_notification" } }))]);
}
function sendJson(res, status, body, headers = {}) { Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v)); res.statusCode = status; res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(body)); }
module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return sendJson(res, 405, { ok: false, success: false, error: "Method not allowed." }); }
  const rate = rateLimit(req); const headers = { "X-RateLimit-Limit": String(LIMIT), "X-RateLimit-Remaining": String(rate.remaining), "X-RateLimit-Reset": String(rate.reset) };
  if (!rate.allowed) { const retryAfter = Math.ceil((rate.reset - Date.now()) / 1000); return sendJson(res, 429, { ok: false, success: false, error: "Rate limit exceeded. Please try again later.", retryAfter }, { ...headers, "Retry-After": String(retryAfter) }); }
  let body; try { body = await readPayload(req); } catch { return sendJson(res, 400, { ok: false, success: false, message: "Invalid request payload.", error: "Invalid request payload." }, headers); }
  if (clean(body._company) || clean(body.website)) return sendJson(res, 200, { ok: true, success: true }, headers);
  const lead = normalizeLead(body, req); const validationError = validateLead(lead);
  if (validationError) return sendJson(res, 400, { ok: false, success: false, message: validationError, error: validationError }, headers);
  try { await sendLeadEmails(lead, req); } catch (error) { console.error("Contact email send failed", error); const message = error && error.message === "SENDGRID_API_KEY is missing." ? "Email service is not configured." : "We could not submit your request right now. Please call us directly."; return sendJson(res, 500, { ok: false, success: false, message, error: "email-send-failed" }, headers); }
  return sendJson(res, 200, { ok: true, success: true, message: "Your request has been received. Our team will follow up shortly." }, headers);
};
