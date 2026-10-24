"use client";
import PageHeader from "@/components/PageHeader";
import ChannelForm from "@/components/ChannelForm";

export default function NewChannelPage() {
  return (
    <main className="min-h-screen pb-20">
      <PageHeader />
      <h1 className="px-6 mb-4 text-2xl font-semibold text-offwhite max-w-md mx-auto">Новый канал</h1>
      <ChannelForm />
    </main>
  );
}
