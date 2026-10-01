import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { getPool, query, databaseConfigured } from "./db";

export const auth = betterAuth({
  appName: "Kalkulator HPP Kuliner",
  baseURL: process.env.APP_BASE_URL || "http://localhost:3000",
  secret: process.env.AUTH_SECRET || randomBytes(32).toString("hex"),
  database: getPool(),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 3600,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url, token }) => {
      const { enqueueAccountEmail } = await import("./email");
      await enqueueAccountEmail("password_reset", user.id, user.email, process.env.APP_BASE_URL+"/reset-password?token="+encodeURIComponent(token), token, 3600);
    }
  },
  plugins: [admin({ defaultRole: "user" })],
  rateLimit: { enabled: true, storage: "database", window: 60, max: 30 },
  databaseHooks: { session: { create: { before: async (session) => {
    const profile = await query<{account_status:string}>("SELECT account_status FROM user_profile WHERE user_id=$1",[session.userId]);
    if (profile.rows[0]?.account_status !== "active") throw new APIError("FORBIDDEN",{message:"Akun belum aktif atau sedang ditangguhkan."});
    return { data: session };
  } } } },
  advanced: { database: { joins: true,validateSchema:databaseConfigured() } }
});

export const activationAuth = betterAuth({
  ...auth.options,
  emailAndPassword: {
    ...auth.options.emailAndPassword,
    enabled: true,
    resetPasswordTokenExpiresIn: 86400,
    sendResetPassword: async ({ user, url, token }) => {
      const { enqueueAccountEmail } = await import("./email");
      await enqueueAccountEmail("activation",user.id,user.email,process.env.APP_BASE_URL+"/activate?token="+encodeURIComponent(token),token,86400);
    }
  }
});
