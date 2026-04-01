import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const TMDB_GENRES = [
  { id: 28, name: "Action" },
  { id: 12, name: "Aventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comédie" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentaire" },
  { id: 18, name: "Drame" },
  { id: 10751, name: "Familial" },
  { id: 14, name: "Fantastique" },
  { id: 36, name: "Histoire" },
  { id: 27, name: "Horreur" },
  { id: 10402, name: "Musique" },
  { id: 9648, name: "Mystère" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science-Fiction" },
  { id: 10770, name: "Téléfilm" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "Guerre" },
  { id: 37, name: "Western" },
  // TV genres
  { id: 10759, name: "Action & Aventure" },
  { id: 10762, name: "Kids" },
  { id: 10763, name: "News" },
  { id: 10764, name: "Réalité" },
  { id: 10765, name: "Sci-Fi & Fantastique" },
  { id: 10766, name: "Soap" },
  { id: 10767, name: "Talk" },
  { id: 10768, name: "Guerre & Politique" },
];

async function main() {
  console.log("Seeding genres...");

  for (const genre of TMDB_GENRES) {
    await prisma.genre.upsert({
      where: { tmdbId: genre.id },
      update: { name: genre.name },
      create: { name: genre.name, tmdbId: genre.id },
    });
  }

  console.log(`Seeded ${TMDB_GENRES.length} genres.`);

  // Create default admin if no users exist
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const hashedPassword = await hash("admin123", 12);
    const admin = await prisma.user.create({
      data: {
        email: "admin@streamr.local",
        hashedPassword,
        name: "Admin",
        role: "ADMIN",
        profiles: {
          create: { name: "Admin" },
        },
      },
    });
    console.log(`Created admin user: ${admin.email} (password: admin123)`);
  }

  console.log("Seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
