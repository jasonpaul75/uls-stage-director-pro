import type { GlobalRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    globalRole?: GlobalRole;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      globalRole?: GlobalRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    globalRole?: GlobalRole;
  }
}
