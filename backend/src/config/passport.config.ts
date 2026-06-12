import passport from "passport";
import { Request } from "express";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";

import { config } from "./app.config";
import { NotFoundException } from "../utils/appError";
import { ProviderEnum } from "../enums/account-provider.enum";
import {
  loginOrCreateAccountService,
  verifyUserService,
} from "../services/auth.service";
import UserModel from "../models/user.model";

if (config.GOOGLE_OAUTH_ENABLED) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        callbackURL: config.GOOGLE_CALLBACK_URL,
        scope: ["profile", "email"],
        passReqToCallback: true,
        state: true,
      },
      async (req: Request, accessToken, refreshToken, profile, done) => {
        try {
          const { email, sub: googleId, picture } = profile._json;

          if (!googleId) {
            throw new NotFoundException("Google ID (sub) is missing");
          }

          const { user } = await loginOrCreateAccountService({
            provider: ProviderEnum.GOOGLE,
            displayName: profile.displayName,
            providerId: googleId,
            picture: picture,
            email: email,
          });
          done(null, user);
        } catch (error) {
          done(error, false);
        }
      }
    )
  );
}

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
      session: true,
    },
    async (email, password, done) => {
      try {
        const user = await verifyUserService({ email, password });
        return done(null, user);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Invalid email or password";
        return done(error, false, { message });
      }
    }
  )
);

passport.serializeUser((user: Express.User, done) => done(null, user._id));
passport.deserializeUser(async (userId: string, done) => {
  try {
    const user = await UserModel.findById(userId).select("-password");
    done(null, user || false);
  } catch (error) {
    done(error, false);
  }
});
