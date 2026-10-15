import { redirect } from "next/navigation";

// Рейтинг теперь внутри раздела «Участницы» (вкладка «Рейтинг»).
export default function RatingPage() {
  redirect("/participants?tab=rating");
}
