// Для какой возрастной категории показывается реклама.
// По умолчанию — только взрослые (MISS и LADY): подросткам реклама показывается лишь с явной отметкой TEEN.
export const DEFAULT_AUDIENCE = ["main", "adult"];

export function adAllowed(audience: string[] | null | undefined, myCategory: string | null | undefined): boolean {
  const a = audience && audience.length ? audience : DEFAULT_AUDIENCE;
  return a.includes(myCategory || "main");
}
