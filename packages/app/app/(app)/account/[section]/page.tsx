"use client";

import { notFound, useParams } from "next/navigation";
import {
  CreditsSection,
  NotificationsSection,
  ProfileSection,
  ReferralSection,
  WalletSection,
} from "@/components/account/sections";

const SECTIONS: Record<string, () => React.ReactNode> = {
  wallet: () => <WalletSection />,
  referral: () => <ReferralSection />,
  profile: () => <ProfileSection />,
  notifications: () => <NotificationsSection />,
  credits: () => <CreditsSection />,
};

/** One account section: Wallet, Referral, Profile, Notifications or Credits. */
export default function AccountSectionPage() {
  const { section } = useParams<{ section: string }>();
  const render = SECTIONS[section];
  if (!render) notFound();
  return <>{render()}</>;
}
