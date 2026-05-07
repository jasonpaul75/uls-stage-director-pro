"use server";

import { signOut } from "@/auth";

export async function producerSignOutAction() {
  await signOut({ redirectTo: "/login?callbackUrl=%2Fproducer" });
}
