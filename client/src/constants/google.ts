export const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
export const isGoogleAuthEnabled = GOOGLE_CLIENT_ID.length > 0;
