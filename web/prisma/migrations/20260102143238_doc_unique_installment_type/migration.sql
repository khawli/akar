/*
  Warnings:

  - A unique constraint covering the columns `[installmentId,type]` on the table `Document` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Document_installmentId_type_key" ON "Document"("installmentId", "type");
