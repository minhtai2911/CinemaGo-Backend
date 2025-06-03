-- CreateTable
CREATE TABLE "showtimes" (
    "id" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "cinemaId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "price" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'vi',
    "subtitle" BOOLEAN NOT NULL DEFAULT true,
    "format" TEXT NOT NULL DEFAULT '2D',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showtimes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_showtime_movie_id" ON "showtimes"("movieId");

-- CreateIndex
CREATE INDEX "idx_showtime_room_id" ON "showtimes"("roomId");
