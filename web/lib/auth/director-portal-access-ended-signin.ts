import { CredentialsSignin } from "next-auth";

/** All director memberships are past the 90-day portal window — sign-in is denied (spec: cannot authenticate). */
export class DirectorPortalAccessEndedSignin extends CredentialsSignin {
  code = "portal_access_ended";
}
