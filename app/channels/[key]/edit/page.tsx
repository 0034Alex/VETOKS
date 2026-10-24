"use client";
import { useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ChannelForm from "@/components/ChannelForm";

export default function EditChannelPage() {
  const { key } = useParams<{ key: string }>();
  return (
    <main className="min-h-screen pb-20">
      <PageHeader />
      <h1 className="px-6 mb-4 text-2xl font-semibold text-offwhite max-w-md mx-auto">Настройки канала</h1>
      <ChannelForm editId={key} />
    </main>
  );
}
