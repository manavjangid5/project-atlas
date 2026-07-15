import passport from "passport";
import { Strategy as GoogleStrategy, Profile as GoogleProfile } from "passport-google-oauth20";
import { Strategy as GitHubStrategy, Profile as GitHubProfile } from "passport-github2";

type VerifyDone = (error: any, user?: any) => void;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "/api/v1/auth/google/callback",
    },
    (
      _accessToken: string,
      _refreshToken: string,
      profile: GoogleProfile,
      done: VerifyDone
    ) => {
      done(null, {
        provider: "google",
        providerId: profile.id,
        email: profile.emails?.[0]?.value || "",
        name: profile.displayName,
      });
    }
  )
);

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: "/api/v1/auth/github/callback",
    },
    (
      _accessToken: string,
      _refreshToken: string,
      profile: GitHubProfile,
      done: VerifyDone
    ) => {
      done(null, {
        provider: "github",
        providerId: profile.id,
        email: (profile.emails?.[0]?.value as string) || `${profile.username}@github.local`,
        name: profile.displayName || profile.username,
      });
    }
  )
);

export default passport;