import { Request, Response } from "express";
import * as AuthService from "../services/auth.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { AuthenticatedRequest } from "../middlewares/authMiddleware.js";

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  const message = await AuthService.login(email, password);
  res.status(200).json({ message });
});

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { email, fullname, password } = req.body;
  if (!email || !fullname || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const message = await AuthService.signup(email, password, fullname);
  res.status(201).json({ message });
});

export const logout = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { refreshToken } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    await AuthService.logout(userId, refreshToken);
    res.status(200).json({ message: "Logged out successfully" });
  }
);

export const refreshAccessToken = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { refreshToken } = req.body;
    const userId = req.user?.userId;
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await AuthService.refreshAccessToken(userId, refreshToken);
    res
      .status(200)
      .json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  }
);

export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    await AuthService.forgotPassword(email);
    res.status(200).json({ message: "Password reset link sent to your email" });
  }
);

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }
  await AuthService.verifyOtp(email, otp);
  res.status(200).json({ message: "OTP verified successfully" });
});

export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    await AuthService.resetPassword(email, otp, newPassword);
    res.status(200).json({ message: "Password reset successfully" });
  }
);

export const sendVerificationLink = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    await AuthService.sendVerificationLink(email);
    res.status(200).json({ message: "Verification link sent to your email" });
  }
);

export const verifyAccountByLink = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, token } = req.body;
    if (!email || !token) {
      return res.status(400).json({ message: "Email and token are required" });
    }
    await AuthService.verifyAccountByLink(email, token);
    res.status(200).json({ message: "Account verified successfully" });
  }
);

export const changePassword = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?.userId;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Old and new passwords are required" });
    }
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    await AuthService.changePassword(userId, oldPassword, newPassword);
    res.status(200).json({ message: "Password changed successfully" });
  }
);
