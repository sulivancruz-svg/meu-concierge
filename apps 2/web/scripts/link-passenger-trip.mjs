import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const passengerId = 'cmn7hd6zo0001xccs2rvgby9j';
const tripId      = 'cmn7dz8az000310xrzduy7s3x';

const passenger = await prisma.passenger.findUnique({ where: { id: passengerId } });
if (!passenger) { console.error('Passageiro não encontrado'); process.exit(1); }

const existing = await prisma.tripPassenger.findFirst({ where: { tripId, passengerId } });
if (existing) { console.log('Vínculo já existe:', existing.id); process.exit(0); }

const link = await prisma.tripPassenger.create({
  data: {
    tripId,
    passengerId,
    name:    passenger.name,
    email:   passenger.email,
    phone:   passenger.phone,
    isLead:  true,
  },
});
console.log('Vínculo criado:', link.id);
await prisma.$disconnect();
