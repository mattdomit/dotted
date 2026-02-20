import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "@dotted/db";
import { UserRole } from "@dotted/shared";
import { signToken } from "../middleware/auth";

export function initPassport() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log("Google OAuth not configured — skipping passport setup");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.API_URL || "http://localhost:4000"}/api/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("No email returned from Google"));
          }

          // Try to find existing user by googleId
          let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

          if (!user) {
            // Try to find by email (link existing account)
            user = await prisma.user.findUnique({ where: { email } });

            if (user) {
              // Link Google account to existing user
              user = await prisma.user.update({
                where: { id: user.id },
                data: { googleId: profile.id, avatarUrl: user.avatarUrl || profile.photos?.[0]?.value },
              });
            } else {
              // Create new user
              user = await prisma.user.create({
                data: {
                  email,
                  name: profile.displayName || email.split("@")[0],
                  role: "CONSUMER",
                  googleId: profile.id,
                  avatarUrl: profile.photos?.[0]?.value,
                },
              });
            }
          }

          const token = signToken({
            userId: user.id,
            email: user.email,
            role: user.role as unknown as UserRole,
          });

          done(null, { user, token });
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}

export function isOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
