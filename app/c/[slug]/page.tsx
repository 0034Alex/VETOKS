"use client";
import { useParams } from "next/navigation";
import ChannelView from "@/components/ChannelView";

export default function ChannelSlugPage() {
  const { slug } = useParams<{ slug: string }>();
  return <ChannelView keyStr={slug} />;
}
