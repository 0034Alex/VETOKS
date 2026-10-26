import { settingsForCountry, countryOfUser } from "@/lib/countryServer";
import { COIN_KEYS, coinSettingsFrom, type CoinSettings } from "@/lib/coins";

export async function coinSettingsFor(countryId: string | null): Promise<CoinSettings> {
  return coinSettingsFrom(await settingsForCountry(COIN_KEYS, countryId));
}

export async function coinSettingsOfUser(uid: string): Promise<CoinSettings> {
  return coinSettingsFor(await countryOfUser(uid));
}
