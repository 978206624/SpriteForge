import type { ChromaParams, Frame, FrameId } from "@/types";
import { getPixels, saveProcessedFrame } from "@/lib/frames/store";
import type {
  ChromaWorkerRequest,
  ChromaWorkerResponse,
} from "@/workers/chroma-key.worker";

/** Grid thumbnail height in px; must match the extractor's THUMB_HEIGHT. */
const THUMB_HEIGHT = 120;

class AbortError extends Error {
  constructor() {
    super("aborted");
    this.name = "AbortError";
  }
}

// ---- Workers + id-correlated request/response ----
//
// Preview and encode use SEPARATE worker instances so live slider previews and
// heavy batch encoding never queue behind / contend with each other. A single
// shared pending map is fine because request ids are globally unique.

type WorkerKind = "preview" | "encode";

let seq = 0;
const workers: Partial<Record<WorkerKind, Worker>> = {};
const pending = new Map<
  string,
  {
    kind: WorkerKind;
    resolve: (r: ChromaWorkerResponse) => void;
    reject: (e: Error) => void;
  }
>();

function disposeWorker(kind: WorkerKind) {
  workers[kind]?.terminate();
  delete workers[kind];
}

function getWorker(kind: WorkerKind): Worker {
  let w = workers[kind];
  if (!w) {
    w = new Worker(
      new URL("../../workers/chroma-key.worker.ts", import.meta.url),
      { type: "module" },
    );
    w.addEventListener("message", (e: MessageEvent<ChromaWorkerResponse>) => {
      const res = e.data;
      const p = pending.get(res.id);
      if (!p) return;
      pending.delete(res.id);
      if (res.kind === "error") p.reject(new Error(res.error));
      else p.resolve(res);
    });
    w.addEventListener("error", () => {
      // a crashed worker can't be reused — reject its pendings and respawn next
      for (const [id, p] of [...pending]) {
        if (p.kind === kind) {
          pending.delete(id);
          p.reject(new Error("抠图 worker 错误"));
        }
      }
      disposeWorker(kind);
    });
    workers[kind] = w;
  }
  return w;
}

/**
 * Send a request to the worker and await its id-matched response. If `signal`
 * aborts while pending, the entry is dropped (a late worker response is then
 * ignored) and the call rejects — callers must re-check `signal` before any
 * write so a superseded run can't persist stale results.
 */
function call(
  req: ChromaWorkerRequest,
  transfer: Transferable[] = [],
  signal?: AbortSignal,
): Promise<ChromaWorkerResponse> {
  const kind: WorkerKind = req.kind === "preview" ? "preview" : "encode";
  const w = getWorker(kind);
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortError());
    const onAbort = () => {
      pending.delete(req.id);
      reject(new AbortError());
    };
    pending.set(req.id, {
      kind,
      resolve: (r) => {
        signal?.removeEventListener("abort", onAbort);
        resolve(r);
      },
      reject: (e) => {
        signal?.removeEventListener("abort", onAbort);
        reject(e);
      },
    });
    signal?.addEventListener("abort", onAbort, { once: true });
    w.postMessage(req, transfer);
  });
}

// ---- Live preview (modal slider drags) ----

export interface PreviewResult {
  imageData: ImageData;
  needsAttention: boolean;
}

/**
 * Chroma-key a source frame for live preview. The source ImageData is left
 * intact (a copy of its buffer is transferred to the worker), so the same
 * source can be re-previewed on every slider change.
 */
export async function previewChroma(
  source: ImageData,
  params: ChromaParams,
  signal?: AbortSignal,
): Promise<PreviewResult> {
  const id = `prev-${seq++}`;
  const copy = source.data.slice(); // Uint8ClampedArray copy (source stays usable)
  const res = await call(
    {
      kind: "preview",
      id,
      width: source.width,
      height: source.height,
      data: copy.buffer,
      params,
    },
    [copy.buffer],
    signal,
  );
  if (res.kind !== "preview") throw new Error("预览返回异常");
  return {
    imageData: new ImageData(
      new Uint8ClampedArray(res.data),
      res.width,
      res.height,
    ),
    needsAttention: res.needsAttention,
  };
}

// ---- Persisting processed frames ----

/**
 * Process one frame with `params` and persist the result. `overrideParams` is
 * what gets stored on the frame (the params themselves for a single-frame
 * override, or null when the frame follows the global params). Returns the
 * updated frame metadata, or null if the frame is gone.
 */
export async function processFrame(
  id: FrameId,
  params: ChromaParams,
  overrideParams: ChromaParams | null,
  signal?: AbortSignal,
): Promise<Pick<Frame, "overrideParams" | "processed" | "needsAttention" | "rev"> | null> {
  const pixels = await getPixels(id);
  if (!pixels || signal?.aborted) return null;
  const reqId = `enc-${id}-${seq++}`;
  const res = await call(
    {
      kind: "encode",
      id: reqId,
      blob: pixels.originalBlob,
      params,
      thumbHeight: THUMB_HEIGHT,
    },
    [],
    signal,
  );
  if (res.kind !== "encode") throw new Error("抠图返回异常");
  // a superseding run aborted us after encode — must not write stale results
  if (signal?.aborted) return null;
  const rev = await saveProcessedFrame(
    id,
    {
      overrideParams,
      processedBlob: res.processedBlob,
      thumbBlob: res.thumbBlob,
      needsAttention: res.needsAttention,
    },
    signal,
  );
  if (rev === null) return null;
  return {
    overrideParams,
    processed: true,
    needsAttention: res.needsAttention,
    rev,
  };
}

/** Effective chroma params for a frame: its override, else the global params. */
export function effectiveParams(frame: Frame, global: ChromaParams): ChromaParams {
  return frame.overrideParams ?? global;
}

/**
 * Process every frame with its effective params (override ?? global),
 * sequentially, reporting progress. Per-frame results are reported via
 * `onFrame` so the grid can update incrementally. Abort-safe.
 */
export async function applyToAllFrames(
  frames: Frame[],
  global: ChromaParams,
  callbacks: {
    onProgress?: (done: number, total: number) => void;
    onFrame?: (
      id: FrameId,
      meta: Pick<Frame, "overrideParams" | "processed" | "needsAttention" | "rev">,
    ) => void;
    signal?: AbortSignal;
  } = {},
): Promise<void> {
  const { onProgress, onFrame, signal } = callbacks;
  const total = frames.length;
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw new AbortError();
    const frame = frames[i];
    const meta = await processFrame(
      frame.id,
      effectiveParams(frame, global),
      frame.overrideParams,
      signal,
    );
    if (signal?.aborted) throw new AbortError();
    if (meta) onFrame?.(frame.id, meta);
    onProgress?.(i + 1, total);
  }
}
