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

/** Update a frame's per-frame override params in place (Phase 4). */
export async function updateFrameOverride(
  id: FrameId,
  overrideParams: ChromaParams | null,
): Promise<void> {
  const db = await getDB();
  const thumb = await db.get(THUMB_STORE, id);
  if (!thumb) return;
  thumb.overrideParams = overrideParams;
  await db.put(THUMB_STORE, thumb);
}

/** Replace a frame's processed (chroma-keyed) result + thumbnail (Phase 4). */
export async function updateFrameProcessed(
  id: FrameId,
  processedBlob: Blob | null,
  thumbBlob?: Blob,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([THUMB_STORE, PIXEL_STORE], "readwrite");
  const [thumb, pixels] = await Promise.all([
    tx.objectStore(THUMB_STORE).get(id),
    tx.objectStore(PIXEL_STORE).get(id),
  ]);
  const ops: Promise<unknown>[] = [tx.done];
  if (pixels) {
    pixels.processedBlob = processedBlob;
    ops.push(tx.objectStore(PIXEL_STORE).put(pixels));
  }
  if (thumb && thumbBlob) {
    thumb.thumbBlob = thumbBlob;
    ops.push(tx.objectStore(THUMB_STORE).put(thumb));
  }
  await Promise.all(ops);
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

/** Read the extraction manifest, or null when none is stored. */
export async function getManifest(): Promise<FrameManifest | null> {
  const db = await getDB();
  return (await db.get(META_STORE, MANIFEST_KEY)) ?? null;
}
