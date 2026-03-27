import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const tripId = 'cmn7dz8az000310xrzduy7s3x';
const now    = new Date();
const end    = new Date(now.getTime() + 10 * 86400000); // 10 dias a partir de hoje

const trip = await prisma.trip.update({
  where: { id: tripId },
  data: {
    status:    'READY',
    startDate: now,
    endDate:   end,
  },
  select: { id: true, title: true, status: true, startDate: true, endDate: true },
});

console.log('Trip atualizada:', trip);
await prisma.$disconnect();
