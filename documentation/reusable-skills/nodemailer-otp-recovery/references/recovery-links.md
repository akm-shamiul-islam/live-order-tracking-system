# Adding recovery links alongside OTPs

This is an implementation design for another project, or a future explicitly requested application change. It is **not currently wired into KitchenToDoor**. Endpoint names below are proposed contracts; adapt them to the target backend and validate them at runtime. Keep both methods in the same recovery workflow.

## Authority model

For each active reset challenge/generation, persist:

| Field | Rule |
| --- | --- |
| `id`, `generation`, `purpose` | Random challenge ID, current generation and `password_reset` |
| `userId`, `email`, `userSecurityVersion` | Captured server identity; optional null account for enumeration-safe dummy challenges |
| `codeHash` | Keyed hash of current OTP, purpose, challenge and generation |
| `linkTokenHash` | SHA-256 hash of a separate high-entropy random link credential |
| `expiresAt`, `resendAvailableAt`, `attempts` | Server-enforced lifetime/cooldown/guess budgets |
| `verifiedAt`, `consumedAt`, `grantHash`, `grantExpiresAt` | Atomic one-method verification and final reset authority |

Use a cryptographically random link secret of at least 32 bytes; encode safely. A public challenge ID/generation may accompany it for lookup but provides no authority without the secret. Do not reuse the six-digit OTP as the link secret or store the raw credential. Bind grants to the account and captured security version.

Enforce one current challenge per normalized account/email and purpose, or invalidate all prior challenges when issuing a replacement. A per-record single-use flag alone permits several independently valid reset links if multiple active records can be created. Update generation, OTP/link hashes, resend time and grant invalidation together under a uniqueness/conditional-write constraint.

## Proposed API contracts

These routes extend the source API. Validate strict bodies, bounded identifiers, a safe nonnegative generation integer, a base64url secret of the chosen fixed length and allowed purposes. Return no-store responses and generic errors for invalid, expired or used credentials. Never accept a target account ID or redirect URL from these bodies.

| Endpoint | Request | Successful result / authority |
| --- | --- | --- |
| `POST /api/auth/forgot-password` | `{ email }` | Safe challenge metadata (`challengeId`, `expiresAt`, `resendAvailableAt`); the email contains both methods. Known/unknown-address replies have the same shape. |
| `POST /api/auth/reset-password/verify` | `{ challengeId, code }` | `{ resetToken }`; atomically verifies the current OTP generation and issues one restricted grant. |
| `POST /api/auth/reset-password/link/inspect` | `{ challengeId, generation, secret }` | `{ valid: true, expiresAt }`; non-consuming inspection only, suitable for loading the password form. |
| `POST /api/auth/reset-password/link/exchange` | `{ challengeId, generation, secret }` | `{ resetToken }`; an explicit user submission claims the link generation once. |
| `POST /api/auth/reset-password` | `{ token, password, confirmPassword }` | Success after grant consumption and a conditional account update; both methods use this endpoint. |

Inspection and exchange must return a uniform failure contract; response wording must not reveal a target email/account. Rate-limit inspection/exchange as well as request, resend and final reset. A caller holding an arbitrary fragment must not receive a grant merely because its syntax passes validation.

## Generate and send

1. Create/rotate OTP and link authority together, under the same cooldown/generation predicate. Resend replaces **both** and removes outstanding grants. A generation must not mint unlimited grants after one method succeeds.
2. Build a URL from the configured, validated HTTPS `PUBLIC_APP_URL`; reject credentials and unexpected query/fragment components in that base, and use a fixed reset route. Never use an untrusted request Host header, open redirect or caller-supplied destination. The source's generic URL setting alone does not enforce this stricter extension policy.
3. Example shape: `/account/reset#challenge=<id>&generation=<version>&recovery=<secret>`. A fragment keeps the secret out of the HTTP URL request and ordinary server access logs. If the host needs a query token for server rendering, explicitly redact it from logs and clean the URL promptly.
4. Put a “Reset Password” button and plain-text URL beside the OTP alternative. State lifetime and that either method works once. Escape HTML attributes including quotation marks as well as text, and use a URL builder for query/fragment encoding. The source mailer's text-node escaping helper is insufficient by itself for interpolating an arbitrary `href`. Avoid provider click-tracking wrappers on recovery links where configurable.

## Safe landing and form

Email scanners and browser prefetches can follow links. A GET, render, prefetch or automatic page-load request must not consume recovery authority or change a password.

- The landing page reads the credential client-side where appropriate, retains it in scoped memory, then removes it from the address bar using a history replacement. Do not put it in persistent storage, analytics, third-party assets or error telemetry. Serve a no-store page with a no-referrer policy and the host's safe CSP.
- An optional non-consuming POST inspection endpoint validates the hash/generation/expiry/current account version and returns only a valid/expired result. Rate-limit it. It must not mint a grant or mark the challenge verified. A forged URL cannot unlock a server-authorized reset.
- Show New Password and Confirm Password when the link is valid, with the same styling, validation and password controls as the OTP path. For invalid/expired/used links offer a new request without revealing whether the address exists.
- Keep the raw link credential available only for this active form. Refresh after cleaning a fragment may require reopening the email; explain that state or use a deliberate restricted server-side recovery-session design. Never fix that UX by storing a long-lived reset bearer in localStorage.

## Converge both methods atomically

```text
Current OTP --explicit verification--> one restricted reset grant
Current link --explicit form submit--> one restricted reset grant
                                      |
                                      v
                    validated password + confirmation
                    consume grant + update current account
                    invalidate all recovery/session authority
```

When the link user submits the password form, validate both password fields before requesting an exchange. Verify/exchange the link through an explicit POST. Check the current account security version, then atomically match `purpose`, captured version, generation, secret hash, expiry, unverified/unconsumed state and absence of an existing grant. Mark verification and create the same restricted reset grant used by OTP; disable both link/OTP verification paths. The browser then submits the new/confirm password with that grant, or the backend performs exchange + reset in one transaction with the same semantics. Derive the target account from that authority even if another account is already signed in in this browser.

Keep a successfully returned grant for a retry after password-validation errors; do not exchange the consumed link again. A lost exchange response may require a fresh email unless the target deliberately implements an idempotent restricted recovery session. Preserve single-use authority when addressing that UX. Give grants their own explicit expiry, and retain the challenge record until that deadline so a TTL cleanup cannot delete a still-valid grant. In the source, a grant receives a fresh configured lifetime after OTP exchange; choose that policy explicitly for the extension.

The OTP verification must use the corresponding conditional predicate too. If OTP and link race, **only one** may exchange the current generation for authority. A second successful-looking form cannot mint another grant. Final reset consumes a matching unexpired grant, updates a current active/verified account, increments security version, clears trusted devices and revokes old sessions. Use a transaction for these coupled writes if the target's topology supports it; otherwise design and test a durable recovery path. A signature check alone cannot enforce single use without stored state.

Keep the final reset page separate from general sign-in authority. Resetting a password should show completion and proceed through normal login policy. Send a security notice without a secret or password. Resend, account email/password/role/access changes, logout policy and security-version changes invalidate old recovery credentials.

## Configuration and tests

Reuse authenticated SMTP, `PUBLIC_APP_URL`, account database/auth settings and `AUTH_OTP_TTL_SECONDS` for link lifetime initially. A separately configurable link lifetime is optional and requires an explicitly added validated setting; it is not an existing source flag. Keep secrets server-only and both methods within the same abuse budgets.

Test non-consuming GET/prefetch/scanner visits, valid link to the form, URL cleanup, altered/expired/used/other-generation tokens, malicious Host/redirect inputs, resend rotation, multiple concurrent reset requests, OTP-versus-link races and single final password update. Test account changes between issuance/inspection/exchange/reset, another signed-in browser identity, mail failure, rate limits, password mismatch/retry, lost exchange responses, cleanup at the grant deadline and replay after success. Consult [OWASP's recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) when implementing the target's policy.
