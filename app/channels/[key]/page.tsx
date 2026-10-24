"use client";
import { useParams } from "next/navigation";
import ChannelView from "@/components/ChannelView";

export default function ChannelPage() {
  const { key } = useParams<{ key: string }>();
  return <ChannelView keyStr={key} />;
}
