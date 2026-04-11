/**
 * Liste les voix Mistral (prédéfinies + personnalisées) : GET /v1/audio/voices
 * Usage : npx tsx scripts/list-mistral-voices.ts
 * Charge MISTRAL_API_KEY depuis `.env` à la racine.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import { mistralGetJson } from '../server/src/mistralClient.js';

type VoiceItem = {
  id: string;
  name?: string | null;
  created_at?: string | null;
  user_id?: string | null;
};

type VoicesPage = {
  items?: VoiceItem[];
  total?: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
};

async function fetchAllVoices(): Promise<{ items: VoiceItem[]; apiTotal: number | undefined }> {
  /** L’API Mistral pagine avec `offset` + `limit` (le paramètre `page` ne change pas les résultats). */
  const limit = 50;
  const byId = new Map<string, VoiceItem>();
  let apiTotal: number | undefined;
  let offset = 0;
  while (offset < 100_000) {
    const q = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    const raw = await mistralGetJson<VoicesPage>(`/audio/voices?${q.toString()}`);
    if (apiTotal === undefined) apiTotal = raw.total;
    const items = raw.items ?? [];
    if (items.length === 0) break;
    for (const v of items) {
      byId.set(v.id, v);
    }
    if (items.length < limit) break;
    if (apiTotal !== undefined && byId.size >= apiTotal) break;
    offset += limit;
  }
  return { items: [...byId.values()], apiTotal };
}

async function main(): Promise<void> {
  const k = process.env.MISTRAL_API_KEY?.trim();
  if (!k) {
    console.error('MISTRAL_API_KEY absente — ajoutez-la dans .env à la racine du repo.');
    process.exit(1);
  }
  try {
    const { items, apiTotal } = await fetchAllVoices();
    console.log(
      `Voix uniques : ${items.length}${apiTotal !== undefined ? ` (total déclaré par l’API : ${apiTotal})` : ''}\n`
    );
    for (const v of items) {
      const name = v.name ?? '—';
      const when = v.created_at ?? '—';
      console.log(`${v.id}\t${name}\t${when}`);
    }
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string; body?: string };
    console.error('Erreur :', err.message ?? e);
    if (typeof err.status === 'number') console.error('HTTP', err.status);
    if (err.body) console.error('Corps (extrait) :', err.body.slice(0, 1200));
    process.exit(1);
  }
}

main();
