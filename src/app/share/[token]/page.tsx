import { SharedReport } from "./shared-report";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;
  return {
    title: `Shared Scan Report — Repo Rot Detector`,
    description: "View the shared repository health scan report.",
    robots: { index: false, follow: false },
    openGraph: {
      title: "Repo Rot Detector — Shared Report",
      description: "View the shared repository health scan report.",
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  return <SharedReport token={token} />;
}
