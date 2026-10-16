// Minimal IndexedDB key/value store for user-loaded files too large for localStorage (e.g. .nam models)

const DB_NAME = 'fretwiki-files'
const STORE = 'files'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => { dbPromise = null; reject(req.error) }
    })
  }
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const req = op(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  }))
}

export function getFile(key: string): Promise<string | undefined> {
  return run<string | undefined>('readonly', s => s.get(key))
}

export function setFile(key: string, value: string): Promise<void> {
  return run<void>('readwrite', s => s.put(value, key))
}

export function deleteFile(key: string): Promise<void> {
  return run<void>('readwrite', s => s.delete(key)).catch(() => {})
}
