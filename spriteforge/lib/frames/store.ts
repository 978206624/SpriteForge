import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ChromaParams, Frame, FrameId } from "@/types";
import {
  type FrameManifest,
  type FramePixels,
  type FrameThumb,
  toFrameMeta,
} from "./model";

/** Singleton DB name/version for the per-browser frame cache. */
const DB_NAME = "spriteforge-frames";
const DB_VERSION = 1;
const THUMB_STORE = "thumbs";
const PIXEL_STORE = "pixels";
const META_STORE = "meta";
/** Key under which the extraction manifest is stored in `meta`. */
const MANIFEST_KEY = "manifest";

interface FrameDB extends DBSchema {
  [THUMB_STORE]: {
    key: FrameId;
    value: FrameThumb;
    indexes: { "by-index": number };
  };
  [PIXEL_STORE]: {
    key: FrameId;
    value: FramePixels;
  };
  [META_STORE]: {
    key: string;
    value: FrameManifest;
  };
}

let dbPromise: Promise<IDBPDatabase<FrameDB>> | null = null;

/** Lazily open the DB. Guards against SSR / non-browser contexts. */
function getDB(): Promise<IDBPDatabase<FrameDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB 不可用"));
  }
  if (!dbPromise) {
    dbPromise = openDB<FrameDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const thumbs = db.createObjectStore(THUMB_STORE, { keyPath: "id" });
        thumbs.createIndex("by-index", "index");
        db.createObjectStore(PIXEL_STORE, { keyPath: "id" });
        db.createObjectStore(META_STORE);
      },
    });
  }
  return dbPromise;
}

/** Persist one extracted frame (light + heavy records) atomically. */
export async function putFrame(
  thumb: FrameThumb,
  pixels: FramePixels,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([THUMB_STORE, PIXEL_STORE], "readwrite");
  await Promise.all([
    tx.objectStore(THUMB_STORE).put(thumb),
    tx.objectStore(PIXEL_STORE).put(pixels),
    tx.done,
  ]);
}

/** All light thumbnail records, ordered by frame index (grid + restore). */
export async function getAllThumbs(): Promise<FrameThumb[]> {
  const db = await getDB();
  return db.getAllFromIndex(THUMB_STORE, "by-index");
}

/** All frame metadata (no blobs), ordered by frame index. */
export async function getAllFrameMeta(): Promise<Frame[]> {
  return (await getAllThumbs()).map(toFrameMeta);
}

/** Thumbnail blob for one frame (grid display), or undefined if absent. */
export async function getThumb(id: FrameId): Promise<Blob | undefined> {
  const db = await getDB();
  return (await db.get(THUMB_STORE, id))?.thumbBlob;
}

/** Heavy pixel record for one frame (on-demand chroma input), or undefined. */
export async function getPixels(id: FrameId): Promise<FramePixels | undefined> {
  const db = await getDB();
  return db.get(PIXEL_STORE, id);
}

/** Number of frames currently persisted. */
export async function countFrames(): Promise<number> {
  const db = await getDB();
  return db.count(THUMB_STORE);
}

export interface ProcessedFrameUpdate {
  /** per-frame chroma override (null = follows global params) */
  overrideParams: ChromaParams | null;
  /** chroma-keyed full-resolution result (PNG with alpha) */
  processedBlob: Blob;
  /** transparent grid thumbnail (PNG) */
  thumbBlob: Blob;
  /** residual-background heuristic flag */
  needsAttention: boolean;
}

/**
 * Commit a frame's chroma-keyed result: writes the processed pixels, the
 * transparent thumbnail, the override params, the attention flag, and bumps
 * `rev` so thumbnail URL caches reload. Returns the new `rev`, or null if the
 * frame no longer exists.
 */
export async function saveProcessedFrame(
  id: FrameId,
  update: ProcessedFrameUpdate,
  signal?: AbortSignal,
): Promise<number | null> {
  const db = await getDB();
  const tx = db.transaction([THUMB_STORE, PIXEL_STORE], "readwrite");
  const done = tx.done;
  // keep a no-op handler so an aborted/early-returned transaction's rejected
  // `done` never surfaces as an unhandled promise rejection
  void done.catch(() => {});

  let abortedBySignal = false;
  const onAbort = () => {
    abortedBySignal = true;
    try {
      tx.abort();
    } catch {
      /* already settled */
    }
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const [thumb, pixels] = await Promise.all([
      tx.objectStore(THUMB_STORE).get(id),
      tx.objectStore(PIXEL_STORE).get(id),
    ]);
    // superseded by a newer run — roll back without writing
    if (signal?.aborted) {
      onAbort();
      return null;
    }
    // frame no longer exists (e.g. deleted) — not an error
    if (!thumb || !pixels) return null;

    const rev = thumb.rev + 1;
    thumb.overrideParams = update.overrideParams;
    thumb.thumbBlob = update.thumbBlob;
    thumb.processed = true;
    thumb.needsAttention = update.needsAttention;
    thumb.rev = rev;
    pixels.processedBlob = update.processedBlob;
    tx.objectStore(THUMB_STORE).put(thumb);
    tx.objectStore(PIXEL_STORE).put(pixels);
    await done; // commit — throws on a real IndexedDB/quota failure
    return rev;
  } catch (err) {
    // an intentional abort is not an error; a real DB/quota failure must surface
    if (abortedBySignal || signal?.aborted) return null;
    throw err;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Wipe all frames and the extraction manifest. */
export async function clearFrames(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    [THUMB_STORE, PIXEL_STORE, META_STORE],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore(THUMB_STORE).clear(),
    tx.objectStore(PIXEL_STORE).clear(),
    tx.objectStore(META_STORE).delete(MANIFEST_KEY),
    tx.done,
  ]);
}

/** Persist the extraction manifest (video + params + total + status). */
export async function setManifest(manifest: FrameManifest): Promise<void> {
  const db = await getDB();
  await db.put(META_STORE, manifest, MANIFEST_KEY);
}

/** Patch the stored manifest's global chroma params (after "apply to all"),
 *  leaving the rest intact. No-op if no manifest exists yet. */
export async function updateManifestGlobalParams(
  globalChromaParams: ChromaParams,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(META_STORE, "readwrite");
  const manifest = await tx.store.get(MANIFEST_KEY);
  if (manifest) {
    manifest.globalChromaParams = globalChromaParams;
    await tx.store.put(manifest, MANIFEST_KEY);
  }
  await tx.done;
}

/** Read the extraction manifest, or null when none is stored. */
export async function getManifest(): Promise<FrameManifest | null> {
  const db = await getDB();
  return (await db.get(META_STORE, MANIFEST_KEY)) ?? null;
}
