ALTER TABLE "Product"
ADD COLUMN "fakeStoreId" INTEGER,
ADD COLUMN "ratingRate" DOUBLE PRECISION,
ADD COLUMN "ratingCount" INTEGER;

CREATE UNIQUE INDEX "Product_fakeStoreId_key" ON "Product"("fakeStoreId");
