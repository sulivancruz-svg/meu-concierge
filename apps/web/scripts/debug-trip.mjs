import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const passengerId = 'cmn7hd6zo0001xccs2rvgby9j';
const tripId      = 'cmn7dz8az000310xrzduy7s3x';

const trip = await prisma.trip.findUnique({
  where: { id: tripId },
  select: { id: true, title: true, status: true, startDate: true, endDate: true },
});
console.log('Trip:', trip);

const links = await prisma.tripPassenger.findMany({
  where: { passengerId },
  select: { id: true, tripId: true, name: true },
});
console.log('TripPassenger links:', links);

const now = new Date();
console.log('\nAgora:', now.toISOString());
console.log('Limite startDate (7 dias):', new Date(now.getTime() + 7 * 86400000).toISOString());

await prisma.$disconnect();
