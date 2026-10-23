---
name: nodemailer-otp-recovery
description: Implement branded transactional email for registration and new-device OTP verification plus password recovery through both an expiring code and a single-use recovery link, with typed contracts and abuse controls.
---

# Nodemailer OTP and recovery

Inspect the host's account/session model, mail provider, canonical origin and design/locale system. Use [the implementation map](references/kitchentodoor.md) for the existing OTP path. For a feature supporting **both OTP and clickable recovery links**, also implement [the recovery-link design](references/recovery-links.md); it is an extension to the source project.

## Challenge contract and delivery

- Model a typed purpose such as `email_verification | new_device_login | password_reset`. Store a random challenge ID, normalized email, optional real account ID, account security version, device binding where required, code hash, expiry, resend-available timestamp, attempt count and verified/consumed state. Return only safe metadata to the browser.
- Generate six-digit codes cryptographically, including leading zeros. Use a keyed hash bound to purpose + challenge ID + code; low-entropy OTPs need protection against offline guessing. Use constant-time hash comparison and never log or return codes in production responses.
- Enforce expiry, resend cooldown and bounded attempts on the server using conditional writes. UI countdowns derive from returned timestamps and are feedback only. TTL indexes clean old records; they do not replace expiry checks.
- Resend atomically rotates the current generation, invalidates the previous code/grants and records new timestamps. A delayed verification of an old snapshot must not consume the replacement code. Bound requests per IP and per account/challenge so inbox floods and brute force cannot bypass limits through reconnects.
- Provide the same reset/request response structure for unknown, disabled and known accounts, using dummy challenges where needed. Avoid synchronous SMTP latency revealing account existence; evaluate timing as well as wording. The reference uses asynchronous reset mail and has no durable queue. Add a bounded durable job/outbox if the host needs restart-safe delivery.

## Registration and new-device flow

1. Validate registration and hash the password, allowing only the ordinary user role. Create the account as unverified/inactive and send the verification challenge. Keep pending registration data/photos separate from approved public profile state.
2. Show the destination, code entry, expiry/resend countdown, clear field error and change/restart options. Use `autocomplete="one-time-code"`, numeric input hints and accessible labels; never parse a leading-zero code as a number.
3. Verify purpose, active generation, attempts, expiry and any device binding established at issuance, then atomically consume verification authority. Activate the matching current account and issue a session according to the host policy. KitchenToDoor registration codes are not bound to an issuing device: verification requires a valid device ID, remembers that device and issues an authenticated session. New-device login codes do check the device hash captured when issued.
4. For a new device, verify the password first, then challenge the device. Only successful verification records its bounded trusted-device hash and issues a session. A browser-generated UUID is not hardware proof; apply the host's stronger authentication policy where needed.

## Password reset with an OTP

```text
Email request -> expiring OTP challenge -> verify code
             -> short-lived, hashed, single-use reset grant
             -> New Password + Confirm Password -> revoke sessions -> sign in normally
```

After valid code verification, exchange authority once for a restricted reset grant. Store the grant hash server-side; prefer keeping the raw grant in scoped browser memory or a restricted server recovery session. KitchenToDoor currently transfers its OTP-issued grant in `/account/reset#token=...` and restores it from that fragment. The fragment stays in browser history and is JavaScript-readable even though it is absent from the HTTP request; a new implementation should remove it after transfer and define reload behavior. The reset form sends only the grant + new/confirm password through HTTPS POST. Never trust a client boolean such as `emailVerified=true` or a URL email address to authorize the password write.

Validate both password fields on client/server, hash using the target policy and atomically update only the matching account/security version. Consume the grant once; clear trusted devices, invalidate old sessions/recovery authority, and send a password-changed notice with no password content. Show success and return to ordinary sign-in. Restarting the flow clears the old grant and both password fields. A consumed grant may require restarting after a storage failure; report that honestly rather than silently retrying with new authority.

Keep code expiry, resend cooldown and reset-grant expiry distinct. The source issues a reset grant for another `AUTH_OTP_TTL_SECONDS` from successful code exchange, extending the challenge record's cleanup deadline to match it. A resend of an unverified challenge rotates its code; once verified, that resend endpoint requires restarting the request. Choose and test the equivalent lifetime/restart policy in the receiving app.

The link route follows the same final form and account/version checks. Do not implement it as `?verified=true`, an email address or the OTP itself in a URL. Follow the linked design for generation, validation, replay control, scanners and convergence with the OTP path.

## Mail and form design

Use the receiving project's brand name, logo, semantic accent/surface/text colors, type scale and supported locales. The reference has a centered bounded card, branded header, purpose/title, large high-contrast copyable code, expiry, safety guidance and security footer; its dark slate/teal palette is only an example. Add a clearly labelled recovery button **and a plain-text URL** when implementing links.

Send HTML and plain-text alternatives, with language set and escaped interpolated content. Use email-safe inline styles, readable fallback fonts, mobile padding and a usable CTA; validate in representative email clients including forced dark mode. Do not load the site's JavaScript/styles into email. A fixed email/print palette can express the brand without mirroring the user's active UI theme. The source localizes OTP subjects/body copy in EN/JA; its brand footer/tagline and password-changed security notice remain English. Localize those too when the target requires fully localized mail.

Reuse existing form controls for OTP/new password/confirmation and errors. Provide per-field visibility buttons, pending feedback, retry/cooldown and expired/used-code states. Keep the layout and tooltip/focus colors consistent with the host, including its light/dark modes.

## SMTP and environment

All settings here are **server-only**. Copy values into the target secret manager or ignored environment file; commit placeholders only. Nodemailer runs in a compatible Node runtime, not an Edge runtime without SMTP/TCP support. A non-Node backend can use its native SMTP library with the same contracts.

| Variable | Default / requirement |
| --- | --- |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Required together; provider host, authenticated credential and authorized sender |
| `SMTP_FROM_NAME` | Host brand; source default `KitchenToDoor` |
| `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS` | `587`, `false`, `true` for STARTTLS; 465 normally requires secure true |
| `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_SOCKET_TIMEOUT_MS` | `10000`, `15000` |
| `PUBLIC_APP_URL` | Canonical allowlisted app origin; HTTPS in production; used to build the extension's links |
| `AUTH_OTP_TTL_SECONDS` | `600`; validated maximum `3600` in source |
| `AUTH_OTP_RESEND_SECONDS` | `60`; must be less than code lifetime |
| `AUTH_OTP_MAX_ATTEMPTS` | `5`; source bounds 1–20 |
| `AUTH_TRUSTED_DEVICES_MAX` | `20` |
| `OTP_REQUEST_RATE_LIMIT_MAX`, `OTP_VERIFY_RATE_LIMIT_MAX`, `RESET_RATE_LIMIT_MAX` | `5`, `10`, `5` per `RATE_LIMIT_TTL_MS=60000` |
| `MONGODB_URI`, `JWT_SECRET` | Existing private account/challenge DB and signing/HMAC secret |
| `PASSWORD_HASH_ROUNDS` | `12` for reference bcryptjs, with 72-byte input bound |
| `FRONTEND_URL`, `AUTH_COOKIE_SECURE` | Existing exact origins/cookie policy; true Secure cookies for HTTPS sessions |

Use the same configured challenge lifetime for recovery links initially; a separate link lifetime would require explicit new schema/config wiring. No link-specific environment variable currently enables links in KitchenToDoor.

Keep certificate verification enabled. Configure `disableFileAccess` and `disableUrlAccess` for mail content that should never read arbitrary paths/URLs. With Gmail, use a provider-approved App Password or explicitly implement OAuth; the reference config supports username/password only. Production sender domains need their provider's SPF/DKIM/DMARC setup and delivery monitoring. These are DNS/provider settings, not invented application environment keys. See [Nodemailer SMTP](https://nodemailer.com/smtp) and [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Acceptance criteria

Capture mail in an isolated local SMTP service. Check HTML/plain-text branding, locale, leading-zero codes, correct expiry and link destination. Verify inactive registration, wrong device/purpose, wrong code, exhausted attempts, expiry, server cooldown and concurrent resend/verify. Test unknown-address parity, SMTP failure and restart behavior. For reset, test grant replay, account/security changes, password mismatch, normal sign-in with the new password, old-session revocation, code/link races, link replay and scanner-safe GETs. Never send test codes to real customers.
