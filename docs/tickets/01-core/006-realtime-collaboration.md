# Ticket: 01-core/006 - Real-time Collaboration

## Priority
**High** - Essential for collaborative writing

## Spec Reference
`/docs/spec-pack.md` sections:
- Tech Stack: "Realtime: Yjs CRDTs" (line 24)
- User Story: "Realtime co-edit with presence" (lines 90-97)
- WebSocket Events (lines 807-841)

## Dependencies
- 01-core/001 (Scene Markdown Editor)

## Current State
- Basic WebSocket gateway exists
- No Yjs integration
- No CRDT support
- No presence tracking

## Target State
- Yjs documents stored in Scene.docCrdt
- Real-time sync via WebSocket
- Presence with cursors
- Conflict-free collaborative editing

## Acceptance Criteria
- [ ] Yjs document created for each scene
- [ ] Changes sync in real-time
- [ ] Multiple users can edit simultaneously
- [ ] Cursors show other users' positions
- [ ] Offline edits merge correctly
- [ ] No data loss on conflicts

## ✨ Optimized Implementation

### Key Improvements:
1. **Binary CRDT Storage**: Store as binary blob, not base64
2. **Yjs Awareness Protocol**: Proper presence with cursor colors
3. **Garbage Collection**: Automatic CRDT compaction
4. **Incremental Updates**: Only send deltas, not full state
5. **Connection Recovery**: Handle reconnects gracefully
6. **Compression**: Use LZ4 for CRDT compression

## Implementation Steps

1. **Install Yjs dependencies** (`/packages/collab/package.json`):
   ```json
   {
     "dependencies": {
       "yjs": "^13.6.0",
       "y-websocket": "^1.5.0",
       "y-prosemirror": "^1.2.0",
       "lib0": "^0.2.0"
     }
   }
   ```

2. **Create Yjs document manager** (`/packages/collab/src/doc-manager.ts`):
   ```typescript
   import * as Y from 'yjs';
   import { applyUpdate, encodeStateAsUpdate } from 'yjs';
   
   export class DocManager {
     private docs = new Map<string, Y.Doc>();
     
     getDoc(sceneId: string): Y.Doc {
       if (!this.docs.has(sceneId)) {
         const doc = new Y.Doc();
         this.docs.set(sceneId, doc);
         this.loadFromDatabase(sceneId, doc);
       }
       return this.docs.get(sceneId)!;
     }
     
     async loadFromDatabase(sceneId: string, doc: Y.Doc) {
       const scene = await prisma.scene.findUnique({
         where: { id: sceneId },
         select: { docCrdt: true }
       });
       
       if (scene?.docCrdt) {
         // OPTIMIZED: Store as binary, not base64
         const update = scene.docCrdt as Buffer;
         if (update) {
           applyUpdate(doc, new Uint8Array(update));
         }
       }
     }
     
     async saveToDatabase(sceneId: string, doc: Y.Doc) {
       // OPTIMIZED: Store as binary blob with compression
       const update = encodeStateAsUpdate(doc);
       const compressed = await this.compress(update);
       
       await prisma.scene.update({
         where: { id: sceneId },
         data: { 
           docCrdt: compressed,
           crdtSize: compressed.length,
           crdtVersion: doc.clientID
         }
       });
       
       // Garbage collect if needed
       if (compressed.length > 100000) { // 100KB threshold
         await this.garbageCollect(sceneId, doc);
       }
     }
     
     async applyUpdate(sceneId: string, update: Uint8Array) {
       const doc = this.getDoc(sceneId);
       
       // Apply update with conflict resolution
       try {
         applyUpdate(doc, update);
       } catch (error) {
         // Handle conflicting updates
         console.error('CRDT update conflict:', error);
         // Merge states instead of failing
         const state = encodeStateAsUpdate(doc);
         const merged = Y.mergeUpdates([state, update]);
         applyUpdate(doc, merged);
       }
       
       // Batch saves to reduce DB writes
       this.scheduleSave(sceneId, doc);
     }
     
     private saveQueue = new Map<string, NodeJS.Timeout>();
     
     private scheduleSave(sceneId: string, doc: Y.Doc) {
       // Cancel existing save
       const existing = this.saveQueue.get(sceneId);
       if (existing) clearTimeout(existing);
       
       // Schedule new save (batch updates)
       const timeout = setTimeout(() => {
         this.saveToDatabase(sceneId, doc);
         this.saveQueue.delete(sceneId);
       }, 1000); // Save after 1 second of inactivity
       
       this.saveQueue.set(sceneId, timeout);
     }
     
     private async compress(data: Uint8Array): Promise<Buffer> {
       // Use LZ4 compression for speed
       const lz4 = require('lz4');
       return lz4.encode(Buffer.from(data));
     }
     
     private async decompress(data: Buffer): Promise<Uint8Array> {
       const lz4 = require('lz4');
       return new Uint8Array(lz4.decode(data));
     }
     
     private async garbageCollect(sceneId: string, doc: Y.Doc) {
       // Compact the CRDT to reduce size
       const stateVector = Y.encodeStateVector(doc);
       const snapshot = Y.snapshot(doc);
       
       // Store snapshot for history
       await prisma.crdtSnapshot.create({
         data: {
           sceneId,
           snapshot: Buffer.from(snapshot),
           stateVector: Buffer.from(stateVector),
           createdAt: new Date()
         }
       });
       
       // Clean old snapshots (keep last 10)
       const snapshots = await prisma.crdtSnapshot.findMany({
         where: { sceneId },
         orderBy: { createdAt: 'desc' },
         skip: 10
       });
       
       if (snapshots.length > 0) {
         await prisma.crdtSnapshot.deleteMany({
           where: {
             id: { in: snapshots.map(s => s.id) }
           }
         });
       }
     }
   }
   ```

3. **Enhanced Presence Manager with Awareness** (`/packages/collab/src/presence.ts`):
   ```typescript
   import * as Y from 'yjs';
   import { Awareness } from 'y-websocket';
   
   export interface UserPresence {
     userId: string;
     name: string;
     color: string;
     cursor?: { from: number; to: number };
     selection?: { anchor: number; head: number };
     lastSeen: Date;
   }
   
   export class PresenceManager {
     private awareness = new Map<string, Awareness>();
     private presence = new Map<string, Map<string, UserPresence>>();
     private colorPool = [
       '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
       '#DDA0DD', '#98D8C8', '#FFD700', '#FF69B4', '#00CED1'
     ];
     private usedColors = new Set<string>();
     
     joinScene(sceneId: string, user: UserPresence, doc: Y.Doc) {
       // Initialize awareness if needed
       if (!this.awareness.has(sceneId)) {
         const awareness = new Awareness(doc);
         this.awareness.set(sceneId, awareness);
         
         // Set up awareness change handler
         awareness.on('change', (changes: any) => {
           this.handleAwarenessChange(sceneId, changes);
         });
       }
       
       const awareness = this.awareness.get(sceneId)!;
       const color = this.assignColor(user.userId);
       
       // Set local state in awareness
       awareness.setLocalStateField('user', {
         id: user.userId,
         name: user.name,
         color
       });
       
       // Track in presence map
       if (!this.presence.has(sceneId)) {
         this.presence.set(sceneId, new Map());
       }
       this.presence.get(sceneId)!.set(user.userId, {
         ...user,
         color,
         lastSeen: new Date()
       });
     }
     
     private assignColor(userId: string): string {
       // Try to give consistent colors to users
       const hash = userId.split('').reduce((acc, char) => {
         return char.charCodeAt(0) + ((acc << 5) - acc);
       }, 0);
       
       const index = Math.abs(hash) % this.colorPool.length;
       return this.colorPool[index];
     }
     
     private handleAwarenessChange(sceneId: string, changes: any) {
       // Broadcast awareness changes to all clients
       // This is handled by y-websocket automatically
     }
     
     leaveScene(sceneId: string, userId: string) {
       this.presence.get(sceneId)?.delete(userId);
     }
     
     updateCursor(sceneId: string, userId: string, cursor: any) {
       const user = this.presence.get(sceneId)?.get(userId);
       if (user) {
         user.cursor = cursor;
       }
     }
     
     getPresence(sceneId: string): UserPresence[] {
       return Array.from(this.presence.get(sceneId)?.values() || []);
     }
   }
   ```

4. **Update WebSocket gateway** (`/apps/api/src/gateway/collab.gateway.ts`):
   ```typescript
   import { DocManager } from '@nelo/collab';
   import { PresenceManager } from '@nelo/collab';
   
   @WebSocketGateway({
     namespace: 'collab',
     cors: true
   })
   export class CollabGateway {
     private docManager = new DocManager();
     private presenceManager = new PresenceManager();
     
     @SubscribeMessage('join.scene')
     async handleJoinScene(
       @ConnectedSocket() client: Socket,
       @MessageBody() data: { sceneId: string; user: any }
     ) {
       // Join room
       client.join(`scene:${data.sceneId}`);
       
       // Add to presence
       this.presenceManager.joinScene(data.sceneId, {
         userId: data.user.id,
         name: data.user.name,
         color: this.generateColor(data.user.id)
       });
       
       // OPTIMIZED: Send incremental updates only
       const doc = this.docManager.getDoc(data.sceneId);
       
       // Get client's state vector
       const clientStateVector = data.stateVector 
         ? new Uint8Array(Buffer.from(data.stateVector, 'base64'))
         : null;
       
       // Send only missing updates
       const update = clientStateVector
         ? Y.encodeStateAsUpdate(doc, clientStateVector)
         : Y.encodeStateAsUpdate(doc);
       
       // Compress before sending
       const compressed = await this.compress(update);
       
       client.emit('doc.sync', {
         sceneId: data.sceneId,
         update: compressed.toString('base64'),
         isIncremental: !!clientStateVector
       });
       
       // Broadcast presence
       this.broadcastPresence(data.sceneId);
     }
     
     @SubscribeMessage('doc.update')
     async handleDocUpdate(
       @ConnectedSocket() client: Socket,
       @MessageBody() data: { sceneId: string; update: string; clientId: number }
     ) {
       // Decompress update
       const compressed = Buffer.from(data.update, 'base64');
       const update = await this.decompress(compressed);
       
       // Apply update with conflict resolution
       await this.docManager.applyUpdate(data.sceneId, update);
       
       // Broadcast to others with origin info
       client.to(`scene:${data.sceneId}`).emit('doc.update', {
         sceneId: data.sceneId,
         update: data.update,
         origin: client.data.userId,
         timestamp: Date.now()
       });
       
       // Track update metrics
       this.metrics.recordUpdate(data.sceneId, update.length);
     }
     
     @SubscribeMessage('cursor.update')
     handleCursorUpdate(
       @ConnectedSocket() client: Socket,
       @MessageBody() data: { sceneId: string; cursor: any }
     ) {
       const userId = client.data.userId;
       
       this.presenceManager.updateCursor(
         data.sceneId,
         userId,
         data.cursor
       );
       
       // Broadcast cursor position
       client.to(`scene:${data.sceneId}`).emit('presence.update', {
         userId,
         cursor: data.cursor
       });
     }
     
     @SubscribeMessage('leave.scene')
     handleLeaveScene(
       @ConnectedSocket() client: Socket,
       @MessageBody() data: { sceneId: string }
     ) {
       client.leave(`scene:${data.sceneId}`);
       this.presenceManager.leaveScene(data.sceneId, client.data.userId);
       this.broadcastPresence(data.sceneId);
     }
     
     private broadcastPresence(sceneId: string) {
       const presence = this.presenceManager.getPresence(sceneId);
       this.server.to(`scene:${sceneId}`).emit('presence.list', presence);
     }
     
     private generateColor(userId: string): string {
       const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
       const index = userId.charCodeAt(0) % colors.length;
       return colors[index];
     }
   }
   ```

5. **Create Markdown-Yjs sync** (`/packages/collab/src/markdown-sync.ts`):
   ```typescript
   import * as Y from 'yjs';
   
   export class MarkdownSync {
     static markdownToYDoc(markdown: string): Y.Doc {
       const doc = new Y.Doc();
       const text = doc.getText('content');
       text.insert(0, markdown);
       return doc;
     }
     
     static yDocToMarkdown(doc: Y.Doc): string {
       const text = doc.getText('content');
       return text.toString();
     }
     
     static syncMarkdownToDoc(markdown: string, doc: Y.Doc) {
       const text = doc.getText('content');
       
       // Simple replace - in production use diff algorithm
       doc.transact(() => {
         text.delete(0, text.length);
         text.insert(0, markdown);
       });
     }
   }
   ```

## Testing Requirements
- Test concurrent editing
- Test conflict resolution
- Test presence tracking
- Test offline sync
- Test large documents

## Files to Modify/Create
- `/packages/collab/src/doc-manager.ts`
- `/packages/collab/src/presence.ts`
- `/packages/collab/src/markdown-sync.ts`
- `/apps/api/src/gateway/collab.gateway.ts`
- `/apps/api/src/gateway/gateway.module.ts` - Add CollabGateway
- Test files

## Validation Commands
```bash
cd packages/collab
pnpm install
pnpm test

# Test WebSocket connection
wscat -c ws://localhost:3001/collab
```

## Notes
- Yjs handles conflict resolution automatically
- Consider document size limits
- Implement periodic saves to database
- Add reconnection handling