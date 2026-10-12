import type { Metadata } from "next";
import { OnboardingForm } from "@/components/OnboardingForm";
import { BRAND } from "@/lib/config";

export const metadata: Metadata = { title: `Welcome · ${BRAND.client}`, robots: { index: false } };

export default function Page() {
  return <OnboardingForm />;
}
