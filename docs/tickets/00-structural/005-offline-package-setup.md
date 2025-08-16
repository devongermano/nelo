# Ticket: 00-structural/005 - Offline Package Setup

## Priority
**Medium** - Required for PWA support but not blocking core features

## Spec Reference
`/docs/spec-pack.md` sections:
- Tech Stack: "Offline: Service Worker + IndexedDB (Dexie)" (line 26)
- User Story: "Offline authoring with sync" (lines 82-88)
- Section 4: "offline PWA" as MVP requirement (line 54)

## Dependencies
- 00-structural/000 (Complete Typia Setup) - Need Typia for validation

## Current State
- ❌ No offline support exists
- ❌ No Service Worker configuration
- ❌ No IndexedDB setup
- ❌ No offline sync queue
- ❌ No PWA manifest

## Target State
A new `@nelo/offline` package containing:
- Service Worker with Workbox 7 for Next.js
- IndexedDB schema using Dexie with versioning
- Offline queue with exponential backoff
- Smart sync strategies with conflict resolution
- Cache management with size limits
- Background sync API integration
- Optimistic UI updates
- PWA manifest generation

## Acceptance Criteria
- [ ] Package `@nelo/offline` exists at `/packages/offline`
- [ ] Service Worker with Workbox configured
- [ ] IndexedDB schema with proper versioning
- [ ] Offline queue with retry logic
- [ ] Background sync implemented
- [ ] Cache strategies with size limits
- [ ] Conflict resolution for CRDT sync
- [ ] PWA manifest configured
- [ ] Package exports utilities for web app
- [ ] Performance: Offline mode adds <100ms latency

## Implementation Steps

1. **Create package structure**:
   ```bash
   mkdir -p packages/offline/src/{db,queue,sw}
   cd packages/offline
   ```

2. **Create package.json**:
   ```json
   {
     "name": "@nelo/offline",
     "version": "0.0.0",
     "private": true,
     "main": "src/index.ts",
     "types": "src/index.ts",
     "scripts": {
       "test": "vitest",
       "typecheck": "tsc --noEmit",
       "build:sw": "webpack --config webpack.sw.config.js"
     },
     "dependencies": {
       "@nelo/shared-types": "workspace:*",
       "dexie": "^3.2.4",
       "dexie-react-hooks": "^1.1.7",
       "workbox-background-sync": "^7.0.0",
       "workbox-broadcast-update": "^7.0.0",
       "workbox-cacheable-response": "^7.0.0",
       "workbox-core": "^7.0.0",
       "workbox-expiration": "^7.0.0",
       "workbox-navigation-preload": "^7.0.0",
       "workbox-precaching": "^7.0.0",
       "workbox-range-requests": "^7.0.0",
       "workbox-routing": "^7.0.0",
       "workbox-strategies": "^7.0.0",
       "workbox-streams": "^7.0.0"
     },
     "devDependencies": {
       "typescript": "^5.3.0",
       "vitest": "^0.34.0",
       "webpack": "^5.89.0",
       "webpack-cli": "^5.1.4"
     }
   }
   ```

3. **Create IndexedDB schema with Dexie** (`/packages/offline/src/db/schema.ts`):
   ```typescript
   import Dexie, { Table } from 'dexie';
   
   export interface OfflineScene {
     id: string;
     chapterId: string;
     contentMd: string;
     docCrdt: Uint8Array; // Yjs document as binary
     lastModified: Date;
     syncStatus: 'pending' | 'syncing' | 'synced' | 'conflict' | 'error';
     version: number;
     localVersion: number; // For conflict detection
     checksum?: string; // For integrity verification
   }
   
   export interface OfflineEntity {
     id: string;
     type: string;
     name: string;
     aliases: string[];
     traits: string[];
     lastModified: Date;
   }
   
   export interface OfflineCanonFact {
     id: string;
     entityId: string;
     fact: string;
     revealState: string;
     lastModified: Date;
   }
   
   export interface SyncQueue {
     id?: number;
     method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
     url: string;
     body?: any;
     headers?: Record<string, string>;
     timestamp: Date;
     retries: number;
     maxRetries: number;
     status: 'pending' | 'processing' | 'failed' | 'cancelled';
     priority: number; // Higher priority syncs first
     errorMessage?: string;
     nextRetryAt?: Date; // For exponential backoff
   }
   
   export class OfflineDatabase extends Dexie {
     scenes!: Table<OfflineScene>;
     entities!: Table<OfflineEntity>;
     canonFacts!: Table<OfflineCanonFact>;
     syncQueue!: Table<SyncQueue>;
   
     constructor() {
       super('NeloOfflineDB');
       
       // Version 1 - Initial schema
       this.version(1).stores({
         scenes: 'id, chapterId, syncStatus, lastModified',
         entities: 'id, type, name, lastModified',
         canonFacts: 'id, entityId, lastModified',
         syncQueue: '++id, status, timestamp, priority'
       });
       
       // Version 2 - Add indexes for better performance
       this.version(2).stores({
         scenes: 'id, chapterId, syncStatus, lastModified, [chapterId+syncStatus]',
         entities: 'id, type, name, lastModified, [type+name]',
         canonFacts: 'id, entityId, lastModified, revealState',
         syncQueue: '++id, status, timestamp, priority, nextRetryAt'
       }).upgrade(trans => {
         // Migration logic if needed
       });
     }
   }
   
   export const db = new OfflineDatabase();
   ```

4. **Create offline queue manager** (`/packages/offline/src/queue/manager.ts`):
   ```typescript
   import { db, SyncQueue } from '../db/schema';
   
   export class OfflineQueueManager {
     async addToQueue(
       request: Omit<SyncQueue, 'id' | 'timestamp' | 'retries' | 'status' | 'nextRetryAt'>,
       priority: number = 0
     ): Promise<void> {
       await db.syncQueue.add({
         ...request,
         timestamp: new Date(),
         retries: 0,
         maxRetries: 3,
         status: 'pending',
         priority,
         nextRetryAt: new Date()
       });
       
       // Trigger background sync if available
       if ('serviceWorker' in navigator && 'sync' in self.registration) {
         await self.registration.sync.register('sync-queue');
       }
     }
   
     async processQueue(): Promise<void> {
       if (!navigator.onLine) {
         return;
       }
   
       const now = new Date();
       const pendingRequests = await db.syncQueue
         .where('status')
         .equals('pending')
         .and(item => !item.nextRetryAt || item.nextRetryAt <= now)
         .sortBy('priority'); // Process high priority first
   
       for (const request of pendingRequests) {
         try {
           await this.processRequest(request);
         } catch (error) {
           await this.handleFailure(request);
         }
       }
     }
   
     private async processRequest(request: SyncQueue): Promise<void> {
       // Update status to processing
       await db.syncQueue.update(request.id!, { status: 'processing' });
   
       const response = await fetch(request.url, {
         method: request.method,
         headers: {
           'Content-Type': 'application/json',
           ...request.headers
         },
         body: request.body ? JSON.stringify(request.body) : undefined
       });
   
       if (response.ok) {
         // Remove from queue on success
         await db.syncQueue.delete(request.id!);
       } else if (response.status >= 400 && response.status < 500) {
         // Client error - don't retry
         await db.syncQueue.delete(request.id!);
         console.error(`Request failed permanently: ${request.url}`);
       } else {
         // Server error - retry later
         throw new Error(`Server error: ${response.status}`);
       }
     }
   
     private async handleFailure(request: SyncQueue, error: Error): Promise<void> {
       const newRetries = request.retries + 1;
       
       if (newRetries >= request.maxRetries) {
         // Max retries reached
         await db.syncQueue.update(request.id!, { 
           status: 'failed',
           retries: newRetries,
           errorMessage: error.message
         });
         
         // Notify user of permanent failure
         this.notifyFailure(request);
       } else {
         // Exponential backoff: 2^retries * 1000ms
         const delay = Math.min(Math.pow(2, newRetries) * 1000, 300000); // Max 5 minutes
         const nextRetryAt = new Date(Date.now() + delay);
         
         await db.syncQueue.update(request.id!, {
           status: 'pending',
           retries: newRetries,
           nextRetryAt,
           errorMessage: error.message
         });
       }
     }
   }
   ```

5. **Create Service Worker** (`/packages/offline/src/sw/service-worker.ts`):
   ```typescript
   /// <reference lib="webworker" />
   import { precacheAndRoute } from 'workbox-precaching';
   import { registerRoute, NavigationRoute } from 'workbox-routing';
   import { NetworkFirst, StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
   import { CacheableResponsePlugin } from 'workbox-cacheable-response';
   import { ExpirationPlugin } from 'workbox-expiration';
   import { BackgroundSyncPlugin } from 'workbox-background-sync';
   import { BroadcastUpdatePlugin } from 'workbox-broadcast-update';
   
   declare const self: ServiceWorkerGlobalScope;
   
   // Precache static assets
   precacheAndRoute(self.__WB_MANIFEST);
   
   // Cache strategies for different routes
   
   // API requests - network first with background sync
   registerRoute(
     ({ url }) => url.pathname.startsWith('/api/'),
     new NetworkFirst({
       cacheName: 'api-cache',
       networkTimeoutSeconds: 3,
       plugins: [
         new CacheableResponsePlugin({
           statuses: [0, 200]
         }),
         new ExpirationPlugin({
           maxEntries: 50,
           maxAgeSeconds: 5 * 60, // 5 minutes
           purgeOnQuotaError: true
         }),
         new BackgroundSyncPlugin('api-queue', {
           maxRetentionTime: 24 * 60 // Retry for up to 24 hours
         }),
         new BroadcastUpdatePlugin() // Notify clients of updates
       ]
     })
   );
   
   // Special handling for scene saves - optimistic updates
   registerRoute(
     ({ url }) => url.pathname.match(/\/api\/scenes\/[^/]+$/),
     new NetworkOnly({
       plugins: [
         new BackgroundSyncPlugin('scene-queue', {
           maxRetentionTime: 7 * 24 * 60, // Keep for a week
           onSync: async ({ queue }) => {
             // Custom sync logic for scenes
             await syncScenes(queue);
           }
         })
       ]
     })
   );
   
   // Static assets - cache first
   registerRoute(
     ({ request }) => 
       request.destination === 'style' ||
       request.destination === 'script' ||
       request.destination === 'image',
     new CacheFirst({
       cacheName: 'static-cache',
       plugins: [
         new CacheableResponsePlugin({
           statuses: [0, 200]
         }),
         new ExpirationPlugin({
           maxEntries: 100,
           maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
           purgeOnQuotaError: true
         })
       ]
     })
   );
   
   // Documents - stale while revalidate with broadcast updates
   registerRoute(
     ({ request }) => request.mode === 'navigate',
     new StaleWhileRevalidate({
       cacheName: 'document-cache',
       plugins: [
         new BroadcastUpdatePlugin(),
         new ExpirationPlugin({
           maxEntries: 20,
           maxAgeSeconds: 24 * 60 * 60 // 1 day
         })
       ]
     })
   );
   
   // Enable navigation preload for faster page loads
   self.addEventListener('activate', (event) => {
     event.waitUntil(self.registration.navigationPreload?.enable());
   });
   
   // Background sync
   self.addEventListener('sync', (event) => {
     if (event.tag === 'sync-queue') {
       event.waitUntil(syncOfflineQueue());
     }
   });
   
   async function syncOfflineQueue(): Promise<void> {
     // This will be called by the queue manager
     const response = await self.clients.matchAll();
     response.forEach(client => {
       client.postMessage({ type: 'SYNC_START' });
     });
   }
   
   // Listen for messages from the app
   self.addEventListener('message', (event) => {
     if (event.data.type === 'SKIP_WAITING') {
       self.skipWaiting();
     }
   });
   ```

6. **Create cache utilities** (`/packages/offline/src/cache/strategies.ts`):
   ```typescript
   export interface CacheStrategy {
     name: string;
     maxAge?: number;
     maxEntries?: number;
   }
   
   export const cacheStrategies: Record<string, CacheStrategy> = {
     api: {
       name: 'api-cache',
       maxAge: 5 * 60 * 1000, // 5 minutes
       maxEntries: 50
     },
     static: {
       name: 'static-cache',
       maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
       maxEntries: 100
     },
     documents: {
       name: 'document-cache',
       maxAge: 24 * 60 * 60 * 1000, // 1 day
       maxEntries: 20
     },
     scenes: {
       name: 'scenes-cache',
       maxAge: 60 * 60 * 1000, // 1 hour
       maxEntries: 100
     }
   };
   
   export class CacheManager {
     async clearOldCaches(): Promise<void> {
       const cacheNames = await caches.keys();
       const validCaches = Object.values(cacheStrategies).map(s => s.name);
       
       await Promise.all(
         cacheNames
           .filter(name => !validCaches.includes(name))
           .map(name => caches.delete(name))
       );
     }
   
     async getCacheSize(cacheName: string): Promise<number> {
       const cache = await caches.open(cacheName);
       const requests = await cache.keys();
       return requests.length;
     }
   
     async pruneCache(cacheName: string, maxEntries: number): Promise<void> {
       const cache = await caches.open(cacheName);
       const requests = await cache.keys();
       
       if (requests.length > maxEntries) {
         const toDelete = requests.slice(0, requests.length - maxEntries);
         await Promise.all(toDelete.map(req => cache.delete(req)));
       }
     }
   }
   ```

7. **Create sync utilities** (`/packages/offline/src/sync/index.ts`):
   ```typescript
   import { db } from '../db/schema';
   import { OfflineQueueManager } from '../queue/manager';
   
   export class SyncManager {
     private queueManager = new OfflineQueueManager();
     
     async registerSync(): Promise<void> {
       if ('serviceWorker' in navigator && 'SyncManager' in window) {
         const registration = await navigator.serviceWorker.ready;
         await (registration as any).sync.register('sync-queue');
       }
     }
   
     async syncScene(sceneId: string): Promise<void> {
       const offlineScene = await db.scenes.get(sceneId);
       
       if (!offlineScene || offlineScene.syncStatus === 'synced') {
         return;
       }
   
       await db.scenes.update(sceneId, { syncStatus: 'syncing' });
   
       try {
         // Include CRDT update for real-time collaboration
         const response = await fetch(`/api/scenes/${sceneId}`, {
           method: 'PATCH',
           headers: { 
             'Content-Type': 'application/json',
             'If-Match': String(offlineScene.version) // Optimistic concurrency
           },
           body: JSON.stringify({
             contentMd: offlineScene.contentMd,
             docCrdt: Array.from(offlineScene.docCrdt), // Convert Uint8Array to array
             version: offlineScene.version,
             localVersion: offlineScene.localVersion,
             checksum: offlineScene.checksum
           })
         });
   
         if (response.ok) {
           const updated = await response.json();
           await db.scenes.update(sceneId, { 
             syncStatus: 'synced',
             version: updated.version,
             localVersion: updated.version
           });
         } else if (response.status === 409) {
           // Conflict - needs CRDT merge
           await this.handleConflictWithCRDT(sceneId, response);
         } else if (response.status === 412) {
           // Precondition failed - version mismatch
           await db.scenes.update(sceneId, { syncStatus: 'conflict' });
         }
       } catch (error) {
         await db.scenes.update(sceneId, { 
           syncStatus: 'error',
           errorMessage: error.message
         });
         throw error;
       }
     }
     
     private async handleConflictWithCRDT(
       sceneId: string,
       response: Response
     ): Promise<void> {
       // Fetch remote version
       const remoteScene = await response.json();
       const localScene = await db.scenes.get(sceneId);
       
       if (!localScene) return;
       
       // Use Yjs to merge CRDTs
       const Y = await import('yjs');
       const localDoc = new Y.Doc();
       const remoteDoc = new Y.Doc();
       
       Y.applyUpdate(localDoc, localScene.docCrdt);
       Y.applyUpdate(remoteDoc, new Uint8Array(remoteScene.docCrdt));
       
       // Merge documents
       const mergedState = Y.encodeStateAsUpdate(localDoc);
       
       // Save merged state
       await db.scenes.update(sceneId, {
         docCrdt: mergedState,
         syncStatus: 'pending', // Will retry sync with merged state
         version: Math.max(localScene.version, remoteScene.version)
       });
     }
   
     async resolveConflict(sceneId: string, resolution: 'local' | 'remote'): Promise<void> {
       if (resolution === 'local') {
         // Force push local version
         const scene = await db.scenes.get(sceneId);
         if (scene) {
           await this.queueManager.addToQueue({
             method: 'PATCH',
             url: `/api/scenes/${sceneId}`,
             body: { contentMd: scene.contentMd, force: true }
           });
         }
       } else {
         // Pull remote version
         const response = await fetch(`/api/scenes/${sceneId}`);
         const remoteScene = await response.json();
         await db.scenes.update(sceneId, {
           contentMd: remoteScene.contentMd,
           docCrdt: new Uint8Array(remoteScene.docCrdt),
           version: remoteScene.version,
           localVersion: remoteScene.version,
           syncStatus: 'synced'
         });
       }
     }
   }
   ```

8. **Create main export** (`/packages/offline/src/index.ts`):
   ```typescript
   // Database
   export { db, OfflineDatabase } from './db/schema';
   export type { OfflineScene, OfflineEntity, OfflineCanonFact, SyncQueue } from './db/schema';
   
   // Queue
   export { OfflineQueueManager } from './queue/manager';
   
   // Cache
   export { CacheManager, cacheStrategies } from './cache/strategies';
   
   // Sync
   export { SyncManager } from './sync';
   
   // Initialize offline support with PWA features
   export async function initOfflineSupport(): Promise<ServiceWorkerRegistration | undefined> {
     if (!('serviceWorker' in navigator)) {
       console.warn('Service Workers not supported');
       return;
     }
     
     try {
       // Wait for window load for better performance
       await new Promise(resolve => {
         if (document.readyState === 'complete') {
           resolve(void 0);
         } else {
           window.addEventListener('load', resolve);
         }
       });
       
       const registration = await navigator.serviceWorker.register('/sw.js', {
         scope: '/',
         updateViaCache: 'none' // Always check for updates
       });
       
       // Check for updates periodically
       setInterval(() => {
         registration.update();
       }, 60 * 60 * 1000); // Every hour
       
       // Handle updates
       registration.addEventListener('updatefound', () => {
         const newWorker = registration.installing;
         if (newWorker) {
           newWorker.addEventListener('statechange', () => {
             if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
               // New service worker available
               notifyUpdateAvailable();
             }
           });
         }
       });
       
       console.log('Service Worker registered:', registration);
       return registration;
     } catch (error) {
       console.error('Service Worker registration failed:', error);
       throw error;
     }
   }
   
   function notifyUpdateAvailable(): void {
     // Notify user that an update is available
     // This would typically show a toast or banner
     console.log('New version available! Refresh to update.');
   }
   ```

## Testing Requirements

1. **Database tests** (`/packages/offline/test/db.test.ts`):
   - Test Dexie schema creation and migrations
   - Test CRUD operations with large datasets
   - Test sync status transitions
   - Test index performance
   - Test quota management

2. **Queue tests** (`/packages/offline/test/queue.test.ts`):
   - Test queue prioritization
   - Test exponential backoff
   - Test max retry limits
   - Test queue persistence
   - Test batch processing
   - Performance: Queue 1000 requests in <100ms

3. **Sync tests** (`/packages/offline/test/sync.test.ts`):
   - Test scene syncing with CRDT
   - Test conflict detection and auto-merge
   - Test manual conflict resolution
   - Test checksum verification
   - Test sync with network interruptions
   - Test sync queue ordering

## Files to Modify/Create
- `/packages/offline/package.json` - Create new
- `/packages/offline/tsconfig.json` - Create new
- `/packages/offline/src/index.ts` - Main export
- `/packages/offline/src/db/schema.ts` - IndexedDB schema
- `/packages/offline/src/queue/manager.ts` - Queue manager
- `/packages/offline/src/sw/service-worker.ts` - Service Worker
- `/packages/offline/src/cache/strategies.ts` - Cache strategies
- `/packages/offline/src/sync/index.ts` - Sync manager
- `/packages/offline/test/*.test.ts` - Test files

## Validation Commands
```bash
# From project root
cd packages/offline

# Install dependencies
pnpm install

# Run tests
pnpm test

# Check types
pnpm typecheck

# Build service worker
pnpm build:sw
```

## Notes
- Service Worker needs to be in public directory with proper headers:
  - `Service-Worker-Allowed: /`
  - `Cache-Control: no-cache`
- IndexedDB has storage limits (usually 50% of free disk space)
- Implement storage quota management and cleanup
- CRDT sync requires careful version tracking
- Background sync requires HTTPS in production
- Consider implementing:
  - Partial sync for large documents
  - Delta sync to reduce bandwidth
  - Compression for sync payloads
  - Offline analytics
  - Network quality detection
  - Adaptive sync strategies based on connection
- PWA requirements:
  - manifest.json with proper icons
  - HTTPS in production
  - Valid SSL certificate
- Performance targets:
  - Service Worker install: <1s
  - Cache response: <50ms
  - IndexedDB read: <10ms
  - Queue operation: <5ms
- This foundation will be enhanced when implementing Real-time Collaboration (01-core/006)