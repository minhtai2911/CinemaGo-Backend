import { PrismaClient } from "../generated/prisma/client.js";
import bcrypt from "bcrypt";
import logger from "../src/utils/logger.js";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin@123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@gmail.com" },
    update: {},
    create: {
      email: "admin@gmail.com",
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
