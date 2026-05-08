import Link from "next/link";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { PublicAuthChrome } from "@/components/public-auth-chrome";
import { publicHeaderTrailingClassName } from "@/components/public-minimal-header";
import { buttonClassName } from "@/components/ui";

export default function Home() {
  return (
    <PublicAuthChrome
      headerTrailing={<Link href="/login" className={publicHeaderTrailingClassName}>Sign in</Link>}
      mainExtraClassName="items-center bg-transparent py-24"
    >
      <div className="w-full max-w-xl px-4 sm:px-0">
        <ProducerGlassCard as="div" className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-accent">Universal Light &amp; Sound</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-uls-text">ULS Stage Director PRO</h1>
          <p className="mt-4 text-pretty text-uls-muted leading-relaxed">
            The ULS director portal and production desk in one product: show intake, proposal and contract milestones with
            DocuSign and phased Stripe billing, collaborative run-of-show (including freeze windows when production locks edits),
            music and video show-media rundowns when those playlists are published for your show, Production files for director reference uploads
            (separate from rundown cues), informational show-day flags, post-show gallery
            and replay pointers when published, and in-project support ticketing. Directors start shows from the dashboard with{" "}
            <strong className="font-medium text-uls-muted">New intake</strong> after sign-in.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-uls-subtle">
            Directors use the portal after a producer invitation. Production opens the inbox, event workspace, cross-show media
            library, Production files from directors, and admin tools with internal credentials.
          </p>
          <nav className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
            <Link href="/login" className={buttonClassName("primary", "md", "w-full sm:w-auto sm:min-w-[10rem]")}>
              Sign in
            </Link>
            <Link href="/portal" className={buttonClassName("secondary", "md", "w-full sm:w-auto sm:min-w-[10rem]")}>
              Director dashboard
            </Link>
            <Link href="/producer" className={buttonClassName("secondary", "md", "w-full sm:w-auto sm:min-w-[10rem]")}>
              Production
            </Link>
          </nav>
        </ProducerGlassCard>
      </div>
    </PublicAuthChrome>
  );
}
