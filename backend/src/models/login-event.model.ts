import mongoose, { Document, Schema } from "mongoose";

export interface LoginEventDocument extends Document {
  user: mongoose.Types.ObjectId;
  provider: string;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
}

const loginEventSchema = new Schema<LoginEventDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    success: {
      type: Boolean,
      required: true,
      default: true,
    },
    ipAddress: {
      type: String,
      required: true,
      trim: true,
    },
    userAgent: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

loginEventSchema.index({ user: 1, createdAt: -1 });

const LoginEventModel = mongoose.model<LoginEventDocument>(
  "LoginEvent",
  loginEventSchema
);

export default LoginEventModel;
