// Machine-local secret, gitignored — never commit the real value.
// Setup:
//   cp src/config/secrets.example.ts src/config/secrets.ts
// then fill in VITE_VC_API_KEY below. Get the real value from the team
// (it's the x-api-key sent to Nexus, api.nexus.codeimplants.com).
export const VITE_VC_API_KEY = '';
