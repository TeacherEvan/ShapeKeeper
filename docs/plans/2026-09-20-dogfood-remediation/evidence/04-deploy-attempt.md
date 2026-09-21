# Evidence: Deployment Authorization + Attempt

User authorization granted (message: "authorized").
`APPROVAL_REQUIRED` gate released.
Attempt: `npx vercel deploy --prod --yes` (vercel CLI v59.23.2 available).
Result: Timed out (likely requires interactive auth / VERCEL_TOKEN missing from env).
Next step: User completes `vercel deploy --prod` with token; verify 200.
