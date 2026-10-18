import { redirect } from "next/navigation";

// Старый адрес: сброс пароля теперь в одном месте.
export default function ResetPasswordPage() {
  redirect("/forgot-password");
}
