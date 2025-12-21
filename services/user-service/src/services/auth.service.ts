import prisma from "../config/db.js";
import bcrypt from "bcrypt";
import { generateTokens } from "../utils/jwt.js";
import logger from "../utils/logger.js";
import { randomBytes } from "crypto";
import { CustomError } from "../utils/customError.js";
import { publishToQueue } from "../utils/rabbitmq.js";

export const signup = async (
  email: string,
  password: string,
  gender: string,
  fullname: string
) => {
  // Validate input
  if (!email || !password || !fullname || !gender) {
    logger.warn("Email, password, fullname, and gender are required");
    throw new CustomError(
      "Email, password, fullname, and gender are required",
      400
    );
  }
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: {
      uniq_users_email_isGuest: {
        email: email,
        isGuest: false,
      },
    },
  });
  if (existingUser) {
    logger.warn("User already exists", { email });
    throw new CustomError("User already exists", 409);
  }
  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);
  if (!hashedPassword) {
    logger.error("Failed to hash password");
    throw new CustomError("Failed to hash password", 500);
  }
  // Create the user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      fullname,
      gender,
    },
  });
  logger.info("User created successfully", {
    userId: user.id,
    email: user.email,
  });
  return user;
};

export const login = async (
  email: string,
  password: string,
  device?: string
) => {
  // Validate input
  if (!email || !password) {
    logger.warn("Email and password are required");
    throw new CustomError("Email and password are required", 400);
  }
  // Find the user
  const user = await prisma.user.findUnique({
    where: {
      uniq_users_email_isGuest: {
        email: email,
        isGuest: false,
      },
    },
  });
  if (!user) {
    logger.warn("User not found", { email });
    throw new CustomError("User not found", 404);
  }
  // Check if user is active
  if (!user.isActive) {
    if (device === "mobile") {
      await sendVerifyOtp(email);
    } else {
      await sendVerificationLink(email);
    }
    logger.warn("User account is not active", { email });
    throw new CustomError("User account is not active", 400);
  }
  // Check the password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    logger.warn("Invalid password", { email });
    throw new CustomError("Invalid password", 400);
  }
  // Generate tokens
  const { accessToken, refreshToken } = await generateTokens(
    user.id,
    user.role,
    user.fullname,
    user.avatarUrl,
    user.publicId,
    user.cinemaId ? user.cinemaId : undefined
  );
  logger.info("User logged in successfully", {
    userId: user.id,
    email: user.email,
  });
  return { accessToken, refreshToken };
};

export const refreshAccessToken = async (token: string) => {
  // Validate input
  if (!token) {
    logger.warn("Refresh token is required");
    throw new CustomError("Refresh token is required", 400);
  }
  // Verify the refresh token
  const decoded = await prisma.refreshToken.findUnique({
    where: { token },
    select: {
      user: true,
      expiresAt: true,
    },
  });
  if (!decoded) {
    logger.warn("Invalid refresh token", { token });
    throw new CustomError("Invalid refresh token", 400);
  }
  // Check if the refresh token is expired
  const currentTime = Math.floor(Date.now() / 1000);
  const expiresAtInSeconds = Math.floor(
    new Date(decoded.expiresAt).getTime() / 1000
  );
  if (expiresAtInSeconds < currentTime) {
    logger.warn("Refresh token has expired", { token });
    throw new CustomError("Refresh token has expired", 400);
  }
  // Generate new access token
  const { accessToken, refreshToken } = await generateTokens(
    decoded.user.id,
    decoded.user.role,
    decoded.user.fullname,
    decoded.user.avatarUrl,
    decoded.user.publicId,
    decoded.user.cinemaId ? decoded.user.cinemaId : undefined
  );
  logger.info("Access token refreshed successfully", {
    userId: decoded.user.id,
  });
  return { accessToken, refreshToken };
};

export const logout = async (userId: string, token: string) => {
  // Validate input
  if (!token) {
    logger.warn("Refresh token is required");
    throw new CustomError("Refresh token is required", 400);
  }
  // Delete the refresh token
  const result = await prisma.refreshToken.deleteMany({
    where: { userId, token },
  });
  // Check if the token was deleted
  if (result.count === 0) {
    logger.warn("No refresh token found to delete", { userId, token });
    throw new CustomError("Invalid refresh token", 400);
  }
  logger.info("User logged out successfully", { userId });
  return { message: "Logged out successfully" };
};

export const forgotPassword = async (email: string) => {
  // Validate input
  if (!email) {
    logger.warn("Email is required for password reset");
    throw new CustomError("Email is required for password reset", 400);
  }
  // Find the user
  const user = await prisma.user.findUnique({
    where: {
      uniq_users_email_isGuest: {
        email: email,
        isGuest: false,
      },
    },
  });
  if (!user) {
    logger.warn("User not found for password reset", { email });
    throw new CustomError("User not found", 404);
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = await bcrypt.hash(otp, 10);
  // Store OTP in the database
  await prisma.oTP.create({
    data: {
      userId: user.id,
      otp: hashedOtp,
      expiresAt: new Date(Date.now() + 3 * 60 * 1000), // OTP valid for 3 minutes
    },
  });
  // Send OTP via email
  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px; padding: 30px; background-color: #fafafa;">
    <h2 style="text-align: center; color: #2c3e50;">Đặt lại mật khẩu</h2>
    <p>Xin chào,</p>
    <p>Bạn vừa yêu cầu đặt lại mật khẩu. Vui lòng sử dụng mã OTP bên dưới để tiếp tục:</p>

    <div style="text-align: center; margin: 20px 0;">
      <span style="display: inline-block; font-size: 24px; letter-spacing: 4px; background: #2c3e50; color: #fff; padding: 12px 20px; border-radius: 8px;">
        <strong>{{OTP}}</strong>
      </span>
    </div>

    <p>Mã OTP này sẽ hết hạn sau <strong>3 phút</strong>. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.</p>

    <p style="margin-top: 30px;">Trân trọng,<br><strong>CinemaGo Team</strong></p>

    <hr style="margin-top: 40px;">
    <p style="font-size: 12px; color: #999;">Bạn nhận được email này vì đã yêu cầu quên mật khẩu trên hệ thống CinemaGo.</p>
  </div>
`;
  const htmlContent = html.replace("{{OTP}}", otp);
  await publishToQueue("email.send", {
    from: `"CinemaGo" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: "Yêu cầu đặt lại mật khẩu từ CinemaGo",
    html: htmlContent,
  });
  logger.info("OTP sent successfully", { email });
  return { message: "OTP sent successfully" };
};

export const verifyOtp = async (email: string, otp: string) => {
  // Validate input
  if (!email || !otp) {
    logger.warn("Email and OTP are required for verification");
    throw new CustomError("Email and OTP are required for verification", 400);
  }
  // Find the user
  const user = await prisma.user.findUnique({
    where: {
      uniq_users_email_isGuest: {
        email: email,
        isGuest: false,
      },
    },
  });
  if (!user) {
    logger.warn("User not found for OTP verification", { email });
    throw new CustomError("User not found", 404);
  }
  // Find the OTP in the database
  const otpRecord = await prisma.oTP.findFirst({
    where: {
      userId: user.id,
      expiresAt: {
        gte: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  if (!otpRecord) {
    logger.warn("Invalid or expired OTP", { email, otp });
    throw new CustomError("Invalid or expired OTP", 400);
  }
  // Verify the OTP
  const isOtpValid = await bcrypt.compare(otp, otpRecord.otp);
  logger.info("OTP verified successfully", { email });
  return isOtpValid;
};

export const resetPassword = async (
  email: string,
  otp: string,
  newPassword: string
) => {
  // Validate input
  if (!email || !otp || !newPassword) {
    logger.warn("Email, OTP, and new password are required for reset");
    throw new CustomError(
      "Email, OTP, and new password are required for reset",
      400
    );
  }
  // Verify the OTP
  const isOtpValid = await verifyOtp(email, otp);
  if (!isOtpValid) {
    logger.warn("Invalid OTP for password reset", { email, otp });
    throw new CustomError("Invalid OTP", 400);
  }
  // Hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  if (!hashedPassword) {
    logger.error("Failed to hash new password");
    throw new CustomError("Failed to hash new password", 500);
  }
  // Update the user's password
  const user = await prisma.user.update({
    where: {
      uniq_users_email_isGuest: {
        email: email,
        isGuest: false,
      },
    },
    data: { password: hashedPassword },
  });
  // Delete the OTP record
  await prisma.oTP.deleteMany({
    where: { userId: user.id },
  });
  logger.info("Password reset successfully", { email });
  return { message: "Password reset successfully" };
};

export const sendVerificationLink = async (email: string) => {
  // Validate input
  if (!email) {
    logger.warn("Email is required for verification link");
    throw new CustomError("Email is required for verification link", 400);
  }
  // Find the user
  const user = await prisma.user.findUnique({
    where: {
      uniq_users_email_isGuest: {
        email: email,
        isGuest: false,
      },
    },
  });
  if (!user) {
    logger.warn("User not found for verification link", { email });
    throw new CustomError("User not found", 404);
  }
  // Generate verification token
  const token = randomBytes(32).toString("hex");
  // Store the token in the database
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Token valid for 24 hours
    },
  });
  // Send verification link via email
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}&userId=${user.id}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px; padding: 30px; background-color: #fafafa;">
        <h2 style="text-align: center; color: #2c3e50;">Xác thực Email</h2>
        <p>Xin chào,</p>
        <p>Vui lòng nhấp vào liên kết bên dưới để xác thực địa chỉ email của bạn:</p>
        <p style="text-align: center;">
        <a href="${verificationLink}" style="display: inline-block; padding: 12px 20px; background-color: #2c3e50; color: #fff; text-decoration: none; border-radius: 8px;">Xác thực Email</a>
        </p>
        <p>Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.</p>
        <p style="margin-top: 30px;">Trân trọng,<br><strong>CinemaGo Team</strong></p>
        <hr style="margin-top: 40px;">
        <p style="font-size: 12px; color: #999;">Bạn nhận được email này vì đã đăng ký tài khoản trên hệ thống CinemaGo.</p>
    </div>
    `;
  await publishToQueue("email.send", {
    from: `"CinemaGo" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: "Xác minh tài khoản từ CinemaGo",
    html: html,
  });
  logger.info("Verification link sent successfully", { email });
  return { message: "Verification link sent successfully" };
};

export const verifyAccountByLink = async (userId: string, token: string) => {
  // Validate input
  if (!token || !userId) {
    logger.warn("Token and userId are required for account verification");
    throw new CustomError(
      "Token and userId are required for account verification",
      400
    );
  }
  // Find the verification token in the database
  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      token,
      userId,
      expiresAt: {
        gte: new Date(),
      },
    },
  });
  if (!verificationToken) {
    logger.warn("Invalid or expired verification token", { token, userId });
    throw new CustomError("Invalid or expired verification token", 400);
  }
  // Update the user's active status
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
  });
  // Delete the verification token
  await prisma.verificationToken.deleteMany({
    where: { userId },
  });

  logger.info("Account verified successfully", { userId });
  return { message: "Account verified successfully" };
};

export const changePassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string
) => {
  // Validate input
  if (!oldPassword || !newPassword) {
    logger.warn("Old password and new password are required for change");
    throw new CustomError(
      "Old password and new password are required for change",
      400
    );
  }
  // Find the user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    logger.warn("User not found for password change", { userId });
    throw new CustomError("User not found", 404);
  }
  // Check the old password
  const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
  if (!isOldPasswordValid) {
    logger.warn("Invalid old password", { userId });
    throw new CustomError("Invalid old password", 400);
  }
  // Hash the new password
  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  if (!hashedNewPassword) {
    logger.error("Failed to hash new password");
    throw new CustomError("Failed to hash new password", 500);
  }
  // Update the user's password
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedNewPassword },
  });
  logger.info("Password changed successfully", { userId });
  return { message: "Password changed successfully" };
};

export const sendVerifyOtp = async (email: string) => {
  if (!email) {
    logger.warn("Email is required to send OTP");
    throw new CustomError("Email is required", 400);
  }

  // Check user tồn tại
  const user = await prisma.user.findUnique({
    where: {
      uniq_users_email_isGuest: {
        email: email,
        isGuest: false,
      },
    },
  });

  if (!user) {
    logger.warn("User not found when sending verify OTP", { email });
    throw new CustomError("User not found", 404);
  }

  // Nếu đã active rồi → không cần OTP nữa
  if (user.isActive) {
    logger.warn("User already verified", { email });
    throw new CustomError("Account already verified", 400);
  }

  // Xóa OTP cũ
  await prisma.oTP.deleteMany({
    where: { userId: user.id },
  });

  // Generate OTP (6 digits)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash otp
  const hashedOtp = await bcrypt.hash(otp, 10);

  // Tạo expiry time (3 phút)
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

  // Save OTP
  await prisma.oTP.create({
    data: {
      userId: user.id,
      otp: hashedOtp,
      expiresAt,
    },
  });

  // Gửi email
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px; padding: 30px; background-color: #fafafa;">
      <h2 style="text-align: center; color: #2c3e50;">Xác thực Email</h2>
      <p>Xin chào, ${user.fullname}</p>
      <p>Bạn vừa yêu cầu xác thực email. Vui lòng sử dụng mã OTP bên dưới để tiếp tục:</p>
      <div style="text-align: center; margin: 20px 0;">
        <span style="display: inline-block; font-size: 24px; letter-spacing: 4px; background: #2c3e50; color: #fff; padding: 12px 20px; border-radius: 8px;">
          <strong>${otp}</strong>
        </span>
      </div>
      <p>Mã OTP này sẽ hết hạn sau <strong>3 phút</strong>. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.</p>
      <p style="margin-top: 30px;">Trân trọng,<br><strong>CinemaGo Team</strong></p>
    </div>
  `;

  await publishToQueue("email.send", {
    from: `"CinemaGo" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: "Yêu cầu xác thực tài khoản từ CinemaGo",
    html: htmlContent,
  });

  logger.info("Verification OTP sent successfully", { userId: user.id });

  return { message: "OTP has been sent to your email" };
};

export const verifyAccountByOtp = async (email: string, otp: string) => {
  if (!email || !otp) {
    logger.warn("Email and OTP are required for account verification");
    throw new CustomError("Email and OTP are required", 400);
  }

  // Find the user
  const user = await prisma.user.findUnique({
    where: {
      uniq_users_email_isGuest: {
        email: email,
        isGuest: false,
      },
    },
  });

  if (!user) {
    logger.warn("User not found for OTP verification", { email });
    throw new CustomError("User not found", 404);
  }

  // Verify the OTP
  const isOtpValid = await verifyOtp(email, otp);

  if (!isOtpValid) {
    logger.warn("Invalid OTP for account verification", { email });
    throw new CustomError("Invalid OTP", 400);
  }

  // Update the user's active status
  await prisma.user.update({
    where: { id: user.id },
    data: { isActive: true },
  });

  // Delete the OTP record
  await prisma.oTP.deleteMany({
    where: { userId: user.id },
  });

  logger.info("Account verified successfully via OTP", { userId: user.id });

  return { message: "Account verified successfully" };
};
