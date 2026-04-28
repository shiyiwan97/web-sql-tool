type StoredHandle = FileSystemDirectoryHandle;

const DB_NAME = "sql-web-tool";
const STORE = "fs-handles";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirectoryHandle(key: string, handle: StoredHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(handle, key);
  });
  db.close();
}

export async function loadDirectoryHandle(key: string): Promise<StoredHandle | null> {
  const db = await openDb();
  const out = await new Promise<StoredHandle | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as StoredHandle) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

