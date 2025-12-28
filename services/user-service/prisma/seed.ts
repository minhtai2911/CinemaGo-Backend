import { PrismaClient } from "../generated/prisma/client.js";
import bcrypt from "bcrypt";
import logger from "../src/utils/logger.js";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash(`${process.env.ADMIN_PASSWORD}`, 10);

  const admin = await prisma.user.upsert({
    where: { email: `${process.env.ADMIN_EMAIL}` },
    update: {},
    create: {
      email: `${process.env.ADMIN_EMAIL}`,
      password: hashedPassword,
      fullname: "Admin",
      gender: "MALE",
      role: "ADMIN",
      isActive: true,
    },
  });

  logger.info("Admin user created:", admin);
}

main()
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
