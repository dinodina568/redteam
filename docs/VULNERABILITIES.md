# PantauApp — Catatan Kerentanan (untuk AppSec Assessment)

> ⚠️ **Aplikasi ini sengaja dibuat rentan** untuk latihan secure SDLC / AppSec.
> Jangan deploy ke internet publik. Jalankan hanya di lab/lingkungan terisolasi.

Dokumen ini memetakan kelemahan **logika aplikasi** yang ditanam, agar bisa
dinilai di tiap tahap SDLC: *threat modeling → secure coding review → SAST/SCA/secret-scan →
DAST di staging → pentest*. Tiap temuan mencantumkan lokasi kode, kategori OWASP, dan ide perbaikan.

Legenda dampak: 🔴 kritikal · 🟠 tinggi · 🟡 sedang

| # | Kerentanan | OWASP | File | Dampak |
|---|-----------|-------|------|--------|
| 1 | IDOR — akses monitor/invoice lintas-organisasi | A01 Broken Access Control | `src/routes/monitors.js` (`GET /:id`), `billing.js` (`GET /invoices/:id`) | 🔴 |
| 2 | Missing function-level authorization (viewer bisa edit monitor) | A01 | `src/routes/monitors.js` (`PUT /:id`) | 🟠 |
| 3 | Mass assignment — `PUT /users/me` menerima `role`, `org_id`, `verified` | A01 / A08 | `src/routes/users.js` | 🔴 |
| 4 | Broken object-level auth pada `GET /orgs/:id/members` (bocorkan hash lintas-org) | A01 | `src/routes/orgs.js` | 🔴 |
| 5 | Privilege escalation via undangan — `role` dari body saat accept invite | A01 | `src/routes/orgs.js` (`/invites/accept`) | 🟠 |
| 6 | SQL Injection | A03 Injection | `src/routes/monitors.js` (`GET /search`) | 🔴 |
| 7 | JWT: klaim dipercaya tanpa cek DB → token lama tetap sah setelah role dicabut | A01 / A07 | `src/auth.js` (`requireAuth`) | 🟠 |
| 8 | MFA bypass — `pending_token` dari `/login` sudah token penuh | A07 Auth Failures | `src/routes/auth.js` (`/login`, `/mfa`) | 🔴 |
| 9 | Broken password reset — token lemah (md5, 12 char) + `!=` longgar + bocor via DEBUG | A07 | `src/routes/auth.js` (`/forgot`, `/reset`) | 🔴 |
| 10 | API key tanpa enforcement scope → key "read" bisa menulis | A01 | `src/auth.js` (TODO PANTAU-212) | 🟠 |
| 11 | Business logic: harga & kupon dari client (`price` di body, diskon negatif → kredit) | A04 Insecure Design | `src/routes/billing.js` (`/checkout`) | 🔴 |
| 12 | Business logic: refund dari client (`refund_amount`) tanpa validasi | A04 | `src/routes/billing.js` (`/cancel`) | 🟠 |
| 13 | Kupon `INTERNAL100` (100% + max_uses 0 = unlimited) + race pada `uses` | A04 | `src/db.js`, `billing.js` | 🟡 |
| 14 | Incident workflow bypass — `approver_role` dari body melewati approval owner | A01 / A04 | `src/routes/incidents.js` (`/approve`) | 🟠 |
| 15 | Stored XSS — `notes` insiden dirender sebagai HTML mentah | A03 | `public/app.js` (`viewIncidents`) | 🟠 |
| 16 | SSRF — `POST /monitors/test` & `/monitors` probe URL apa pun (termasuk loopback/metadata) | A10 SSRF | `src/routes/monitors.js` (`probe`) | 🔴 |
| 17 | Prototype pollution — `_.merge` pada preferences (lodash 4.17.4) & body `__proto__` | A06 Vuln Components | `src/routes/users.js`, `package.json` | 🟠 |
| 18 | Shadow/legacy API tanpa auth — `/api/v1/*` ekspor user+hash by `org_id` | A01 / A09 | `src/routes/v1.js` | 🔴 |
| 19 | Debug endpoint membocorkan seluruh config + `process.env` (secret) | A05 Misconfig | `src/routes/admin.js` (`/debug/config`) | 🔴 |
| 20 | Admin gate lewat klaim JWT `is_superadmin` (bisa diinjeksi via #3/#17) | A01 | `src/routes/admin.js` | 🟠 |
| 21 | Internal agent di loopback: `/secrets`, `/admin/reset-password` tanpa auth (target SSRF #16) | A01 / A05 | `src/agent.js` | 🔴 |
| 22 | Sensitive logging — password & OTP & reset-token ditulis ke `logs/app.log` | A09 Logging | `src/routes/auth.js` | 🟠 |
| 23 | Log directory di-serve statis → `/logs/app.log` publik | A05 | `src/server.js` | 🔴 |
| 24 | Secret hardcoded + `.env` di-commit & masuk image Docker | A05 / secret-scan | `src/config.js`, `.env`, `.dockerignore` | 🔴 |
| 25 | CORS reflektif + `Allow-Credentials: true` → CSRF/kredensial lintas-origin | A05 | `src/server.js` | 🟠 |
| 26 | Error handler membocorkan stack trace + request body | A05 | `src/server.js` | 🟡 |
| 27 | Password di-hash SHA-1 tanpa salt | A02 Crypto Failures | `src/db.js` (`hash`) | 🟠 |
| 28 | JWT secret lemah & statis, `expiresIn` 30 hari, tanpa revocation | A02 / A07 | `src/config.js`, `auth.js` | 🟡 |
| 29 | Container berjalan sebagai root, `data/`+`.env` ikut ter-build | CIS / A05 | `Dockerfile` | 🟡 |
| 30 | Dependensi usang (lodash 4.17.4, dll) tertangkap SCA | A06 | `package.json` | 🟡 |

## Pemetaan ke pipeline (di mana tiap temuan "tertangkap")

- **Secret scanning (Gitleaks)** → #24 (`.env`, hardcoded secret).
- **SCA (npm audit / OSV)** → #17, #30 (lodash 4.17.4 prototype pollution).
- **SAST (Semgrep)** → #6 (SQLi string concat), #15 (XSS innerHTML), #16 (SSRF fetch), #26 (stack leak).
- **DAST (ZAP di staging)** → #1, #8, #18, #19, #23, #25 (akses runtime, header, endpoint terbuka).
- **Manual review / threat model** → #11–#14 (business logic), #5, #20 (authz desain).

## Kredensial seed (lab)

| Akun | Password | Role | Org |
|------|----------|------|-----|
| admin@pantau.local | admin123 | owner | 1 (Dino Dina Corp) |
| budi@dinodina.local | budi123 | viewer | 1 |
| rina@dinodina.local | Rina!2024 | admin (MFA) | 1 |
| sari@acme.local | S4ri-Acme#Prod | owner (MFA) | 2 (Acme Rival) |

Org 2 (Acme) ada untuk menguji isolasi tenant (#1, #4, #18).

## Catatan perbaikan (ringkas)

Perbaikan utama yang diharapkan dari peserta assessment:
1. Query berparameter + authz berbasis `org_id` di setiap handler objek.
2. Allowlist field untuk update, hapus field privilege dari input user.
3. MFA: `pending_token` bertipe terpisah/ber-scope, bukan token penuh.
4. Hitung harga/diskon/refund **di server** dari sumber tepercaya.
5. Validasi SSRF (blok IP privat/loopback/metadata), jangan serve `logs/`.
6. Pindahkan secret ke secret manager; blokir `.env` di git & image.
7. Jadikan gate SCA/SAST/secret-scan **blocking** di branch `staging` & `main`.
