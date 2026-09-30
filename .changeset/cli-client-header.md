---
"@makespdf/cli": patch
---

Send `X-MakesPDF-Client: cli/<version>` on every makesPDF API request — `md`,
`preview`, `render`, `validate`, and the device-flow login — so the API can
classify CLI traffic by client kind instead of guessing from the User-Agent.
