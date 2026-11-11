/**
 * Short links to the Worksheet: an answer links /w/<id> (~55 characters)
 * instead of the script in the address (~400 for a cycle), and /w/<id>
 * redirects to that address. The id is the script's SHA-256 in base 62, so
 * the same script always has the same link and is kept once.
 *
 * Unlike the long address, a short one needs this Worker and its database:
 * if either is down, an answer links the long one instead. A link is kept
 * while it is used: `last_used`, the day it was last opened or answered,
 * lets those unused for a year be deleted (answers say so).
 */

/** The part of D1's API used here. */
export interface LinkStore {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T>(): Promise<T | null>;
    };
  };
}

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** 10 characters of base 62: ~59 bits, no collision among billions. */
const ID_LENGTH = 10;

async function idOf(script: string): Promise<string> {
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(script)),
  );
  let n = 0n;
  for (const byte of hash) n = (n << 8n) | BigInt(byte);
  let id = "";
  while (id.length < ID_LENGTH) {
    id += ALPHABET[Number(n % 62n)];
    n /= 62n;
  }
  return id;
}

/** Keeps `script` and answers its short link; null if it could not be kept. */
export async function shortLink(
  store: LinkStore,
  origin: string,
  script: string,
): Promise<string | null> {
  try {
    const id = await idOf(script);
    // A script linked before is only marked used, once a day at most.
    await store
      .prepare(
        `INSERT INTO links (id, script, last_used) VALUES (?, ?, date('now'))
         ON CONFLICT (id) DO UPDATE SET last_used = excluded.last_used
         WHERE links.last_used IS NOT excluded.last_used`,
      )
      .bind(id, script)
      .run();
    return `${origin}/w/${id}`;
  } catch (e) {
    console.error(JSON.stringify({ link: "not kept", error: String(e) }));
    return null;
  }
}

/** The script a short link keeps; null for an id it does not know. */
export async function scriptOf(
  store: LinkStore,
  id: string,
): Promise<string | null> {
  if (!/^[0-9A-Za-z]{10}$/.test(id)) return null;
  const row = await store
    .prepare("SELECT script FROM links WHERE id = ?")
    .bind(id)
    .first<{ script: string }>();
  return row?.script ?? null;
}

/** Marks a link opened today, once a day at most. */
export async function touch(store: LinkStore, id: string): Promise<void> {
  await store
    .prepare(
      "UPDATE links SET last_used = date('now') WHERE id = ? AND last_used IS NOT date('now')",
    )
    .bind(id)
    .run();
}
