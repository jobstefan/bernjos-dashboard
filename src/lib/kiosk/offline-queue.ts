"use client";

/**
 * IndexedDB-backed queue for kiosk entries logged while offline (§6/§9.7).
 * Entries keep their original client timestamp and are replayed on reconnect.
 * A "kiosk-queue-changed" window event fires on every mutation so open screens
 * can recompute their optimistic on-hand.
 */

export interface QueuedEntry {
  clientId: string;
  sessionId: string;
  productId: string;
  type: "restock" | "wastage";
  quantity: number;
  reason?: string | null;
  note?: string | null;
  enteredAt: string; // ISO
}

const DB_NAME = "bernjos-kiosk";
const STORE = "entries";
export const QUEUE_EVENT = "kiosk-queue-changed";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "clientId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(STORE, mode).objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

function notify() {
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export async function enqueueEntry(entry: Omit<QueuedEntry, "clientId" | "enteredAt">): Promise<void> {
  const full: QueuedEntry = {
    ...entry,
    clientId: crypto.randomUUID(),
    enteredAt: new Date().toISOString(),
  };
  await tx("readwrite", (s) => s.add(full));
  notify();
}

export async function allQueued(): Promise<QueuedEntry[]> {
  return tx<QueuedEntry[]>("readonly", (s) => s.getAll());
}

export async function removeQueued(clientIds: string[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite");
    const store = t.objectStore(STORE);
    for (const id of clientIds) store.delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  notify();
}

export async function queuedCount(): Promise<number> {
  return tx<number>("readonly", (s) => s.count());
}
