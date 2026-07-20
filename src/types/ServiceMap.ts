import { PrismaClient } from "@/prisma/generated/client";
import { IFileUploader } from "@/utils/IFileUploader";
// import { Redis } from "ioredis";
// import Stripe from "stripe";

import { IEmailProvider } from "@/providers/EmailProvider";

export interface ServiceMap {
  prisma: PrismaClient;
  fileUploader: IFileUploader;
  email: IEmailProvider;
}
