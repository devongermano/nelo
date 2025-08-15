-- CreateIndex
CREATE INDEX "Embedding_embedding_idx" ON "Embedding" USING ivfflat ("embedding") WITH (lists = 100);
