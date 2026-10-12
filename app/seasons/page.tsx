import { redirect } from "next/navigation";

// Страница «Сезоны» скрыта до второго сезона.
export default function SeasonsPage() {
  redirect("/");
}
