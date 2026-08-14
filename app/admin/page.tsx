"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Application = {
  id: string;
  status: string;
  form_data: {
    display_name?: string;
    age?: string;
    city?: string;
    bio?: string;
    photo_url?: string;
  };
  season_id: string;
  user_id: string;
  created_at: string;
};

export default function AdminPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadApplications() {
    setLoading(true);
    const { data } = await supabase
      .from("applications")
      .select("id, status, form_data, season_id, user_id, created_at")
      .eq("status", "submitted")
      .order("created_at", { ascending: false });
    setApplications((data as Application[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadApplications();
  }, []);

  async function handleApprove(app: Application) {
    setBusyId(app.id);

    await supabase
      .from("applications")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", app.id);

    await supabase.from("participants").insert({
      user_id: app.user_id,
      season_id: app.season_id,
      application_id: app.id,
      display_name: app.form_data.display_name ?? "Без имени",
      bio: app.form_data.bio ?? null,
      photo_url: app.form_data.photo_url ?? null,
    });

    await loadApplications();
    setBusyId(null);
  }

  async function handleReject(app: Application) {
    setBusyId(app.id);

    await supabase
      .from("applications")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        rejection_reason: "Отклонено модератором",
      })
      .eq("id", app.id);

    await loadApplications();
    setBusyId(null);
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <h1 className="text-3xl font-semibold text-gold mb-2 text-center">
        Модерация анкет
      </h1>
      <p className="text-muted text-center mb-10">
        Анкеты на рассмотрении: {applications.length}
      </p>

      {loading && <p className="text-muted text-center">Загрузка...</p>}

      {!loading && applications.length === 0 && (
        <p className="text-muted text-center">Новых анкет нет.</p>
      )}

      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        {applications.map((app) => (
          <div
            key={app.id}
            className="bg-bgSurface border border-muted rounded-xl p-5"
          >
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl text-gold font-semibold">
                {app.form_data.display_name ?? "Без имени"}
              </h2>
              <span className="text-muted text-sm">
                {new Date(app.created_at).toLocaleDateString("ru-RU")}
              </span>
            </div>
            <p className="text-offwhite text-sm mb-1">
              Возраст: {app.form_data.age ?? "—"} · Город:{" "}
              {app.form_data.city ?? "—"}
            </p>
            {app.form_data.bio && (
              <p className="text-muted text-sm mb-3">{app.form_data.bio}</p>
            )}
            {app.form_data.photo_url && (
              <a
                href={app.form_data.photo_url}
                target="_blank"
                rel="noreferrer"
                className="text-rose text-sm underline block mb-3"
              >
                Ссылка на фото
              </a>
            )}

            <div className="flex gap-3 mt-3">
              <button
                onClick={() => handleApprove(app)}
                disabled={busyId === app.id}
                className="bg-success text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm disabled:opacity-50"
              >
                Одобрить
              </button>
              <button
                onClick={() => handleReject(app)}
                disabled={busyId === app.id}
                className="bg-danger text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm disabled:opacity-50"
              >
                Отклонить
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
