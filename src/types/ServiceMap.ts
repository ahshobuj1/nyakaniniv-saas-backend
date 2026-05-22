import { PrismaClient } from "@/prisma/generated/client";
import { IFileUploader } from "@/utils/IFileUploader";
// import { Redis } from "ioredis";
// import Stripe from "stripe";

export interface ServiceMap {
  prisma: PrismaClient;
  fileUploader: IFileUploader;
  // redis: Redis;
  // stripe: Stripe;
}
