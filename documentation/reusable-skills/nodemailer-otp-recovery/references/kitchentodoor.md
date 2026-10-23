# KitchenToDoor mail source map and feature boundary

| Repository-relative source | Responsibility |
| --- | --- |
| `backend/src/auth/recovery-mailer.ts` | Nodemailer 10.2.1 transport, bounded SMTP IO, disabled file/URL access, EN/JA OTP subjects/body and an English security notice; HTML/plain-text alternatives |
| `backend/src/auth/auth-otp.service.ts` | CSPRNG codes/IDs, HMAC hashes, purpose/device binding, conditional resend/verify and hashed reset-grant exchange/consumption |
| `backend/src/auth/auth.service.ts` | Inactive registration, verification/new-device session issue, dummy reset challenges, final password/security-version change |
| `backend/src/auth/auth.controller.ts` | `/register`, `/email/verify`, `/login/verify`, `/otp/resend`, `/forgot-password`, `/reset-password/verify`, `/reset-password` under `/api/auth` |
| `backend/src/database/schemas/auth-challenge.schema.ts` | Durable challenge lifecycle and hidden secret fields |
| `shared/src/schemas/auth.schema.ts` | Purpose enum, six-digit code string, challenge metadata and reset-token/password contracts |
| `frontend/src/pages/AccountPage.tsx`, `frontend/src/components/auth/OtpVerificationForm.tsx` | Email -> verification -> password/confirmation stages, error/cooldown/restart feedback |
| `backend/src/testing/test-smtp.ts` | Local mail capture for isolated tests |
| `documentation/docs/CONFIGURATION.md` | Gmail setup, SMTP requirements and validated code settings |

**Implemented:** OTP registration, device verification, OTP-to-reset-grant recovery, expiry/resend/attempt controls, account-change invalidation and password-changed notices. Registration codes can be verified from a different device; new-device login challenges compare the issuing device hash. The source uses a code hash/`lastSentAt` snapshot to distinguish replacements rather than an explicit generation integer. Its reset grant receives a fresh configured lifetime after code exchange, and the frontend carries that grant in a URL fragment. It does not inspect an emailed recovery link before showing a reset form.

OTP HMAC/device hashes depend on `JWT_SECRET`; changing it invalidates old OTP hashes and device matching. Existing opaque reset grants and refresh tokens are SHA-256-hashed independently, so they are not revoked by that change alone. Increment account security versions/revoke stored authority when that is the intended action. A new app may use separately managed domain-specific secrets with an explicit rotation policy.

The source enforces per-handler IP request limits and a per-challenge resend cooldown; a separate sustained per-account mail-send budget is an additional control for a new implementation. Password-change notices and fixed mail branding remain English even when OTP copy is Japanese.

**Extension:** the current `sendOtp` sends a code, expiry and safety copy without a recovery URL. `PUBLIC_APP_URL` already exists for app hosting/CSP; it is not evidence that clickable reset links are implemented. A reset schema's historical “open the link” message is not an endpoint or feature. Implement `recovery-links.md` and its tests in the receiving app before advertising the link path.

Existing verification: `auth-otp.service.spec.ts`, `auth.service.spec.ts`, `auth.http.spec.ts`, `orders.integration.ts` and `scripts/verify-browser.ts` exercise real local SMTP/code/password flow. Those tests do not establish recovery-link support or durable mail-queue delivery.
