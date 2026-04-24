-- CreateTable
CREATE TABLE "AIPromptLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "feature" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "inputTok" INTEGER NOT NULL,
    "outputTok" INTEGER NOT NULL,
    "costInr" DECIMAL(10,4) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIPromptLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIPromptLog_userId_at_idx" ON "AIPromptLog"("userId", "at");

-- CreateIndex
CREATE INDEX "AIPromptLog_feature_at_idx" ON "AIPromptLog"("feature", "at");
