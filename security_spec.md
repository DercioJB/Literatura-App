# Firestore Security Specification

This document defines the zero-trust data invariants, potential attack vector payloads ("Dirty Dozen"), and validation criteria to guarantee a hardened Firestore ruleset.

## 1. Data Invariants
- **Identity Integrity**: All write operations matching `books`, `history`, or `backups` must be authenticated.
- **Relational Integrity**: Records must be successfully isolated and routed strictly under the `global_workspace` scope.
- **Type/Boundary Security**: Numerical fields for stock metrics (`origin`, `in`, `out`) must be strictly numbers. Strings like names and codes must be bounded to prevent wallet denial or resource exhaustion attacks.

## 2. The "Dirty Dozen" Payloads (Red Team Attack Vectors)

1. **Anonymous Write Attack**: Attempt to write/create a book or a history document without a signed-in auth token.
2. **Outside Workspace Scope**: Attempt to write a book with a workspace ID other than `global_workspace`.
3. **Workspace Hijacking**: Attempting to write/update other user settings or create workspaces arbitrarily.
4. **Invalid Integer Poisoning**: Setting `origin` to a string or float array to cause runtime mathematical crashes on client calculators.
5. **Denial of Wallet Document ID**: Writing a book with an ID size above 128 characters or containing unsafe, non-URL-safe parameters.
6. **Negative Value Poisoning**: Injecting extremely large negative buffers for `in` and `out`.
7. **Banned Field Injection**: Injecting arbitrary shadow keys (e.g., `isAdmin: true` or `role: "admin"`) on workspace or book documents.
8. **PII Scraping**: Attempting to query another user's email profile or personal details without ownership matches.
9. **History Blueprint Spoofing**: Injecting corrupt, unsafe structured JSON objects or random blobs into `history` snapshot fields.
10. **Cloud Backup Overwrite**: Attempting to modify or overwrite someone else's backed-up payload directly from the client.
11. **Impersonation Attempt**: Attempting to write users profile with a different `userId` match than the authenticated credentials.
12. **Cascade Privilege Modification**: Authenticated normal users trying to set access control boundaries on shared templates.

## 3. Deployment & Rules Verification

The final production ruleset guarantees that all 12 validation breaches fail instantly on the server side returning `PERMISSION_DENIED`.
