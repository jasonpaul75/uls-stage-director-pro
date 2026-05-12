"use server";

import { signOut } from "@/auth";

export async function staffSignOutAction() {
  await signOut({ redirectTo: "/login?callbackUrl=%2Fstaff" });
}
