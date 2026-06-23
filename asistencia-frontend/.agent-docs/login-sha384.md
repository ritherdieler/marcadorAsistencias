# Login password SHA-384

Build verified: `npm run build` (2026-06-16).

## Change

Added `src/utils/sha384.ts` with `encryptWithSHA384()` using Web Crypto (`SHA-384`, UTF-8, lowercase hex).

Applied before sending passwords to backend in:

- `authService.login`
- `userService.createUser`
- `recognitionService.verifyAttendanceWithPassword`

Matches Android `String.encryptWithSHA384()` in IpsAdmin.
