# PantauApp — Application Monitoring (Intentionally Vulnerable)

> ⚠️ **PERINGATAN KEAMANAN**
> Aplikasi ini **sengaja dibuat rentan** sebagai bahan latihan *AppSec* dan *secure SDLC*.
> **Jangan** menjalankannya di jaringan publik atau dengan data nyata. Lab terisolasi saja.

Website monitoring aplikasi (uptime, insiden, tim, billing) milik **Dino Dina** —
dibangun sebagai target assessment untuk menilai kerentanan dari **sisi logika aplikasi**
di sepanjang alur **development → staging → production**.

## Fitur (sebagai permukaan serang)
- Auth: register, login, **MFA/OTP**, lupa & reset password, JWT + API key
- Monitor uptime (probe HTTP, interval, cek manual) dengan **batas sesuai paket**
- Manajemen insiden dengan **workflow approval** (open → investigating → resolved → closed)
- Tim & RBAC (viewer / admin / owner), undangan antar-organisasi (multi-tenant)
- Billing: paket, kupon/diskon, checkout, refund, invoice
- API publik `v1` (legacy), endpoint debug, internal metrics agent

## Menjalankan (lokal)

```bash
npm install
npm run reset      # buat & seed database SQLite
npm start          # http://127.0.0.1:3000
```

Node.js ≥ 22.5 (memakai modul `node:sqlite` bawaan — tanpa dependency DB eksternal).

Dengan Docker:

```bash
docker compose up --build
```

## Pengujian

```bash
npm test
```

## Kerentanan & assessment

Daftar lengkap 30 kelemahan logika yang ditanam, pemetaan OWASP Top 10, lokasi
kode, dan di tahap pipeline mana tiap temuan tertangkap:

➡️ **[`docs/VULNERABILITIES.md`](docs/VULNERABILITIES.md)**

## Pipeline (secure SDLC)

Pipeline mengalir `development → staging → production`, tiap tahap menambah gate keamanan:

| Tahap | Branch | Security gate |
|-------|--------|---------------|
| CI (semua) | semua | SCA (`npm audit`, OSV), Secret scan (Gitleaks), SAST (Semgrep), unit test |
| Development | `development` | build image, DAST baseline (informational) |
| Staging | `staging` | Trivy image scan, **DAST full (ZAP)** |
| Production | `main` | Trivy (blocking-ready), **manual approval**, health check |

Definisi: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) dan
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

Gate sengaja dibuat **non-blocking** di awal (`continue-on-error` / `exit-code: 0`)
agar temuan terlihat utuh saat assessment. Jadikan **blocking** untuk `staging`/`main`
sebagai salah satu latihan "shift-left" & remediasi.

## Struktur

```
src/        server, auth, db, logger, config, internal agent
src/routes/ auth, users, orgs, monitors, incidents, billing, apikeys, admin, v1
public/     SPA dashboard (vanilla JS)
tests/      smoke tests
docs/       katalog kerentanan
.github/    pipeline CI & deploy
```
