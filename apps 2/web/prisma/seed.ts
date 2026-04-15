import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

function addDays(base: Date, days: number, hours = 10, minutes = 0) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function storagePath(agencyId: string, tripId: string, documentId: string, fileName: string) {
  return `agencies/${agencyId}/trips/${tripId}/documents/${documentId}/${fileName}`;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function ensureAuthUser(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: {
    email: string;
    password: string;
    name: string;
    role: string;
    userType: 'agency_user' | 'passenger';
  },
) {
  if (!supabase) {
    return null;
  }

  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) {
    throw new Error(`Failed to list Supabase users for ${input.email}: ${listError.message}`);
  }

  const existing = listed.users.find((user) => user.email?.toLowerCase() === input.email.toLowerCase());
  if (existing) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.name,
        role: input.role,
        user_type: input.userType,
      },
    });

    if (updateError) {
      throw new Error(`Failed to update Supabase user ${input.email}: ${updateError.message}`);
    }

    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.name,
      role: input.role,
      user_type: input.userType,
    },
  });

  if (error || !data.user) {
    throw new Error(`Failed to create Supabase user ${input.email}: ${error?.message ?? 'unknown error'}`);
  }

  return data.user.id;
}

async function main() {
  console.log('Seeding Concierge do Passageiro...');

  const supabase = getSupabaseAdmin();
  const today = new Date();

  const agency = await prisma.agency.upsert({
    where: { slug: 'atlas-concierge-demo' },
    update: {
      name: 'Atlas Concierge Viagens',
      supportEmail: 'suporte@atlasconcierge.com',
      supportPhone: '+551133334444',
      supportWhatsApp: '+5511998877665',
      plan: 'PRO',
      status: 'ACTIVE',
    },
    create: {
      id: 'demo-agency-atlas',
      slug: 'atlas-concierge-demo',
      name: 'Atlas Concierge Viagens',
      supportEmail: 'suporte@atlasconcierge.com',
      supportPhone: '+551133334444',
      supportWhatsApp: '+5511998877665',
      plan: 'PRO',
      status: 'ACTIVE',
    },
  });

  const ownerAuthId = await ensureAuthUser(supabase, {
    email: 'admin@atlasconcierge.com',
    password: 'AtlasAdmin123!',
    name: 'Helena Costa',
    role: 'OWNER',
    userType: 'agency_user',
  });

  const agentAuthId = await ensureAuthUser(supabase, {
    email: 'operacao@atlasconcierge.com',
    password: 'AtlasAdmin123!',
    name: 'Renato Lima',
    role: 'AGENT',
    userType: 'agency_user',
  });

  const anaAuthId = await ensureAuthUser(supabase, {
    email: 'ana.bezerra@demo.com',
    password: 'Passageiro123!',
    name: 'Ana Bezerra',
    role: 'PASSENGER',
    userType: 'passenger',
  });

  const brunoAuthId = await ensureAuthUser(supabase, {
    email: 'bruno.carvalho@demo.com',
    password: 'Passageiro123!',
    name: 'Bruno Carvalho',
    role: 'PASSENGER',
    userType: 'passenger',
  });

  const owner = await prisma.agencyUser.upsert({
    where: { agencyId_email: { agencyId: agency.id, email: 'admin@atlasconcierge.com' } },
    update: {
      authUserId: ownerAuthId,
      name: 'Helena Costa',
      role: 'OWNER',
      status: 'ACTIVE',
    },
    create: {
      id: 'demo-user-owner',
      agencyId: agency.id,
      authUserId: ownerAuthId,
      email: 'admin@atlasconcierge.com',
      name: 'Helena Costa',
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  const agent = await prisma.agencyUser.upsert({
    where: { agencyId_email: { agencyId: agency.id, email: 'operacao@atlasconcierge.com' } },
    update: {
      authUserId: agentAuthId,
      name: 'Renato Lima',
      role: 'AGENT',
      status: 'ACTIVE',
    },
    create: {
      id: 'demo-user-agent',
      agencyId: agency.id,
      authUserId: agentAuthId,
      email: 'operacao@atlasconcierge.com',
      name: 'Renato Lima',
      role: 'AGENT',
      status: 'ACTIVE',
    },
  });

  const ana = await prisma.passenger.upsert({
    where: { id: 'demo-passenger-ana' },
    update: {
      authUserId: anaAuthId,
      agencyId: agency.id,
      name: 'Ana Bezerra',
      email: 'ana.bezerra@demo.com',
      phone: '+5511981112200',
      passportNumber: 'YA009911',
      nationality: 'Brasileira',
      portalStatus: anaAuthId ? 'ACTIVE' : 'INVITED',
      portalInvitedAt: today,
      portalActivatedAt: anaAuthId ? today : null,
      notes: 'Prefere voos diurnos e quarto em andar alto.',
    },
    create: {
      id: 'demo-passenger-ana',
      authUserId: anaAuthId,
      agencyId: agency.id,
      name: 'Ana Bezerra',
      email: 'ana.bezerra@demo.com',
      phone: '+5511981112200',
      passportNumber: 'YA009911',
      nationality: 'Brasileira',
      portalStatus: anaAuthId ? 'ACTIVE' : 'INVITED',
      portalInvitedAt: today,
      portalActivatedAt: anaAuthId ? today : null,
      notes: 'Prefere voos diurnos e quarto em andar alto.',
    },
  });

  const bruno = await prisma.passenger.upsert({
    where: { id: 'demo-passenger-bruno' },
    update: {
      authUserId: brunoAuthId,
      agencyId: agency.id,
      name: 'Bruno Carvalho',
      email: 'bruno.carvalho@demo.com',
      phone: '+5511981113300',
      passportNumber: 'YA002288',
      nationality: 'Brasileira',
      portalStatus: brunoAuthId ? 'ACTIVE' : 'INVITED',
      portalInvitedAt: today,
      portalActivatedAt: brunoAuthId ? today : null,
      notes: 'Executivo. Solicita recibos organizados por etapa.',
    },
    create: {
      id: 'demo-passenger-bruno',
      authUserId: brunoAuthId,
      agencyId: agency.id,
      name: 'Bruno Carvalho',
      email: 'bruno.carvalho@demo.com',
      phone: '+5511981113300',
      passportNumber: 'YA002288',
      nationality: 'Brasileira',
      portalStatus: brunoAuthId ? 'ACTIVE' : 'INVITED',
      portalInvitedAt: today,
      portalActivatedAt: brunoAuthId ? today : null,
      notes: 'Executivo. Solicita recibos organizados por etapa.',
    },
  });

  const camila = await prisma.passenger.upsert({
    where: { id: 'demo-passenger-camila' },
    update: {
      agencyId: agency.id,
      name: 'Camila Moura',
      email: 'camila.moura@demo.com',
      phone: '+5511981114400',
      passportNumber: 'YA007744',
      nationality: 'Brasileira',
      portalStatus: 'PENDING',
      notes: 'Ainda nao ativou o portal do passageiro.',
    },
    create: {
      id: 'demo-passenger-camila',
      agencyId: agency.id,
      name: 'Camila Moura',
      email: 'camila.moura@demo.com',
      phone: '+5511981114400',
      passportNumber: 'YA007744',
      nationality: 'Brasileira',
      portalStatus: 'PENDING',
      notes: 'Ainda nao ativou o portal do passageiro.',
    },
  });

  const companion = await prisma.passengerCompanion.upsert({
    where: { id: 'demo-companion-rafael' },
    update: {
      agencyId: agency.id,
      passengerId: ana.id,
      name: 'Rafael Bezerra',
      relationship: 'Conjuge',
      phone: '+5511989990011',
      passportNumber: 'YA004455',
      structuredMetadata: { mealPreference: 'vegetarian' },
    },
    create: {
      id: 'demo-companion-rafael',
      agencyId: agency.id,
      passengerId: ana.id,
      name: 'Rafael Bezerra',
      relationship: 'Conjuge',
      phone: '+5511989990011',
      passportNumber: 'YA004455',
      structuredMetadata: { mealPreference: 'vegetarian' },
    },
  });

  const futureTrip = await prisma.trip.upsert({
    where: { id: 'demo-trip-japan' },
    update: {
      agencyId: agency.id,
      createdById: agent.id,
      title: 'Primavera no Japao',
      destination: 'Toquio e Kyoto, Japao',
      startDate: addDays(today, 24, 10, 15),
      endDate: addDays(today, 35, 20, 0),
      status: 'READY',
      internalNotes: 'Cliente quer roteiro premium com foco em gastronomia e sakura.',
      structuredMetadata: { salesChannel: 'concierge', priority: 'high' },
    },
    create: {
      id: 'demo-trip-japan',
      agencyId: agency.id,
      createdById: agent.id,
      title: 'Primavera no Japao',
      destination: 'Toquio e Kyoto, Japao',
      startDate: addDays(today, 24, 10, 15),
      endDate: addDays(today, 35, 20, 0),
      status: 'READY',
      internalNotes: 'Cliente quer roteiro premium com foco em gastronomia e sakura.',
      structuredMetadata: { salesChannel: 'concierge', priority: 'high' },
    },
  });

  const liveTrip = await prisma.trip.upsert({
    where: { id: 'demo-trip-portugal' },
    update: {
      agencyId: agency.id,
      createdById: owner.id,
      title: 'Circuito Portugal',
      destination: 'Lisboa e Porto, Portugal',
      startDate: addDays(today, -2, 7, 0),
      endDate: addDays(today, 6, 21, 45),
      status: 'IN_PROGRESS',
      internalNotes: 'Acompanhar status dos voos de retorno. Cliente corporativo.',
      structuredMetadata: { salesChannel: 'b2b', account: 'Grupo Luz' },
    },
    create: {
      id: 'demo-trip-portugal',
      agencyId: agency.id,
      createdById: owner.id,
      title: 'Circuito Portugal',
      destination: 'Lisboa e Porto, Portugal',
      startDate: addDays(today, -2, 7, 0),
      endDate: addDays(today, 6, 21, 45),
      status: 'IN_PROGRESS',
      internalNotes: 'Acompanhar status dos voos de retorno. Cliente corporativo.',
      structuredMetadata: { salesChannel: 'b2b', account: 'Grupo Luz' },
    },
  });

  const pastTrip = await prisma.trip.upsert({
    where: { id: 'demo-trip-patagonia' },
    update: {
      agencyId: agency.id,
      createdById: agent.id,
      title: 'Patagonia Essencial',
      destination: 'El Calafate e Ushuaia, Argentina',
      startDate: addDays(today, -48, 9, 30),
      endDate: addDays(today, -39, 19, 0),
      status: 'COMPLETED',
      internalNotes: 'Viagem concluida sem ocorrencias. Solicitar depoimento.',
      structuredMetadata: { salesChannel: 'instagram' },
    },
    create: {
      id: 'demo-trip-patagonia',
      agencyId: agency.id,
      createdById: agent.id,
      title: 'Patagonia Essencial',
      destination: 'El Calafate e Ushuaia, Argentina',
      startDate: addDays(today, -48, 9, 30),
      endDate: addDays(today, -39, 19, 0),
      status: 'COMPLETED',
      internalNotes: 'Viagem concluida sem ocorrencias. Solicitar depoimento.',
      structuredMetadata: { salesChannel: 'instagram' },
    },
  });

  const tripIds = [futureTrip.id, liveTrip.id, pastTrip.id];
  const conversationIds = ['demo-conv-japan', 'demo-conv-portugal', 'demo-conv-patagonia'];
  const flightIds = ['demo-flight-japan-01', 'demo-flight-japan-02', 'demo-flight-portugal-01', 'demo-flight-portugal-02', 'demo-flight-patagonia-01'];
  const documentIds = ['demo-doc-japan-eticket', 'demo-doc-portugal-voucher', 'demo-doc-patagonia-insurance'];

  await prisma.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
  await prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } });
  await prisma.alert.deleteMany({ where: { tripId: { in: tripIds } } });
  await prisma.internalNote.deleteMany({ where: { tripId: { in: tripIds } } });
  await prisma.documentChunk.deleteMany({ where: { documentId: { in: documentIds } } });
  await prisma.document.deleteMany({ where: { id: { in: documentIds } } });
  await prisma.flightStatusHistory.deleteMany({ where: { flightId: { in: flightIds } } });
  await prisma.flightSegment.deleteMany({ where: { id: { in: flightIds } } });
  await prisma.hotelBooking.deleteMany({ where: { tripId: { in: tripIds } } });
  await prisma.transportBooking.deleteMany({ where: { tripId: { in: tripIds } } });
  await prisma.tourBooking.deleteMany({ where: { tripId: { in: tripIds } } });
  await prisma.trainBooking.deleteMany({ where: { tripId: { in: tripIds } } });
  await prisma.insurancePolicy.deleteMany({ where: { tripId: { in: tripIds } } });
  await prisma.tripPassenger.deleteMany({ where: { tripId: { in: tripIds } } });

  await prisma.tripPassenger.createMany({
    data: [
      {
        id: 'demo-trip-passenger-japan-ana',
        tripId: futureTrip.id,
        passengerId: ana.id,
        name: ana.name,
        email: ana.email,
        phone: ana.phone,
        passportNumber: ana.passportNumber,
        isLead: true,
      },
      {
        id: 'demo-trip-passenger-japan-rafael',
        tripId: futureTrip.id,
        companionId: companion.id,
        name: companion.name,
        phone: companion.phone,
        passportNumber: companion.passportNumber,
        isLead: false,
      },
      {
        id: 'demo-trip-passenger-portugal-bruno',
        tripId: liveTrip.id,
        passengerId: bruno.id,
        name: bruno.name,
        email: bruno.email,
        phone: bruno.phone,
        passportNumber: bruno.passportNumber,
        isLead: true,
      },
      {
        id: 'demo-trip-passenger-patagonia-camila',
        tripId: pastTrip.id,
        passengerId: camila.id,
        name: camila.name,
        email: camila.email,
        phone: camila.phone,
        passportNumber: camila.passportNumber,
        isLead: true,
      },
    ],
  });

  await prisma.flightSegment.createMany({
    data: [
      {
        id: 'demo-flight-japan-01',
        tripId: futureTrip.id,
        airline: 'JL',
        airlineName: 'Japan Airlines',
        flightNumber: 'JL760',
        origin: 'GRU',
        destination: 'NRT',
        departureAt: addDays(today, 24, 10, 15),
        arrivalAt: addDays(today, 25, 11, 30),
        pnr: 'JPNH22',
        cabinClass: 'premium_economy',
        baggageInfo: '2 malas de 23kg',
        statusCode: 'SCHEDULED',
        departureTerminal: '3',
        sortOrder: 1,
      },
      {
        id: 'demo-flight-japan-02',
        tripId: futureTrip.id,
        airline: 'NH',
        airlineName: 'All Nippon Airways',
        flightNumber: 'NH743',
        origin: 'KIX',
        destination: 'NRT',
        departureAt: addDays(today, 33, 12, 0),
        arrivalAt: addDays(today, 33, 13, 25),
        pnr: 'KYT090',
        cabinClass: 'economy',
        baggageInfo: '1 mala de 23kg',
        statusCode: 'SCHEDULED',
        sortOrder: 2,
      },
      {
        id: 'demo-flight-portugal-01',
        tripId: liveTrip.id,
        airline: 'TP',
        airlineName: 'TAP Air Portugal',
        flightNumber: 'TP058',
        origin: 'LIS',
        destination: 'OPO',
        departureAt: addDays(today, 1, 9, 30),
        arrivalAt: addDays(today, 1, 10, 25),
        pnr: 'PTL508',
        cabinClass: 'economy',
        baggageInfo: '1 mala de 23kg',
        statusCode: 'DELAYED',
        departureTerminal: '1',
        departureGate: '24',
        lastCheckedAt: addDays(today, 0, 8, 15),
        sortOrder: 1,
      },
      {
        id: 'demo-flight-portugal-02',
        tripId: liveTrip.id,
        airline: 'TP',
        airlineName: 'TAP Air Portugal',
        flightNumber: 'TP087',
        origin: 'OPO',
        destination: 'LIS',
        departureAt: addDays(today, 5, 18, 15),
        arrivalAt: addDays(today, 5, 19, 5),
        pnr: 'PTL509',
        cabinClass: 'economy',
        baggageInfo: '1 mala de 23kg',
        statusCode: 'SCHEDULED',
        sortOrder: 2,
      },
      {
        id: 'demo-flight-patagonia-01',
        tripId: pastTrip.id,
        airline: 'AR',
        airlineName: 'Aerolineas Argentinas',
        flightNumber: 'AR1874',
        origin: 'AEP',
        destination: 'FTE',
        departureAt: addDays(today, -48, 13, 15),
        arrivalAt: addDays(today, -48, 16, 30),
        pnr: 'PAT303',
        cabinClass: 'economy',
        baggageInfo: '1 mala de 15kg',
        statusCode: 'LANDED',
        actualDepartureAt: addDays(today, -48, 13, 18),
        actualArrivalAt: addDays(today, -48, 16, 28),
        sortOrder: 1,
      },
    ],
  });

  await prisma.flightStatusHistory.createMany({
    data: [
      {
        id: 'demo-flight-history-portugal-01',
        flightId: 'demo-flight-portugal-01',
        statusCode: 'ON_TIME',
        provider: 'cirium',
        summary: 'Voo publicado pontual na checagem inicial.',
        observedAt: addDays(today, 0, 6, 30),
      },
      {
        id: 'demo-flight-history-portugal-02',
        flightId: 'demo-flight-portugal-01',
        statusCode: 'DELAYED',
        provider: 'cirium',
        summary: 'Atraso operacional de 55 minutos reportado pela cia.',
        payload: { delayMinutes: 55 },
        observedAt: addDays(today, 0, 8, 5),
      },
      {
        id: 'demo-flight-history-patagonia-01',
        flightId: 'demo-flight-patagonia-01',
        statusCode: 'LANDED',
        provider: 'cirium',
        summary: 'Trecho concluido sem intercorrencias.',
        observedAt: addDays(today, -48, 16, 35),
      },
    ],
  });

  await prisma.hotelBooking.createMany({
    data: [
      {
        id: 'demo-hotel-japan-01',
        tripId: futureTrip.id,
        hotelName: 'The Capitol Hotel Tokyu',
        address: '2 Chome-10-3 Nagatacho, Chiyoda City, Tokyo',
        checkIn: addDays(today, 25, 15, 0),
        checkOut: addDays(today, 30, 11, 0),
        roomType: 'Deluxe King',
        confirmationCode: 'TOK-8821',
        boardType: 'Cafe da manha',
        nights: 5,
        sortOrder: 1,
      },
      {
        id: 'demo-hotel-portugal-01',
        tripId: liveTrip.id,
        hotelName: 'Memmo Principe Real',
        address: 'Rua Dom Pedro V 56J, Lisboa',
        checkIn: addDays(today, -2, 15, 0),
        checkOut: addDays(today, 2, 11, 0),
        roomType: 'Superior Double',
        confirmationCode: 'LIS-9988',
        nights: 4,
        sortOrder: 1,
      },
      {
        id: 'demo-hotel-patagonia-01',
        tripId: pastTrip.id,
        hotelName: 'Los Alamos',
        address: 'Ing. Hector Guatti 1350, El Calafate',
        checkIn: addDays(today, -48, 15, 0),
        checkOut: addDays(today, -44, 11, 0),
        roomType: 'Standard',
        confirmationCode: 'PAT-5501',
        nights: 4,
        sortOrder: 1,
      },
    ],
  });

  await prisma.transportBooking.createMany({
    data: [
      {
        id: 'demo-transport-japan-01',
        tripId: futureTrip.id,
        type: 'TRANSFER',
        name: 'Transfer Narita -> Hotel',
        scheduledAt: addDays(today, 25, 12, 30),
        pickupPoint: 'Terminal 2 - Narita',
        dropoffPoint: 'The Capitol Hotel Tokyu',
        provider: 'Tokyo Executive Ride',
        confirmationCode: 'TRF-JP-21',
        vehicleType: 'Alphard',
      },
      {
        id: 'demo-transport-portugal-01',
        tripId: liveTrip.id,
        type: 'TRANSFER',
        name: 'Transfer hotel -> aeroporto',
        scheduledAt: addDays(today, 6, 17, 15),
        pickupPoint: 'Memmo Principe Real',
        dropoffPoint: 'Aeroporto Humberto Delgado',
        provider: 'Blacklane',
        confirmationCode: 'TRF-PT-45',
        vehicleType: 'Sedan',
      },
      {
        id: 'demo-transport-patagonia-01',
        tripId: pastTrip.id,
        type: 'BUS',
        name: 'Shuttle aeroporto -> hotel',
        scheduledAt: addDays(today, -48, 17, 0),
        pickupPoint: 'Aeroporto El Calafate',
        dropoffPoint: 'Los Alamos',
        provider: 'Patagonia Shuttle',
      },
    ],
  });

  await prisma.tourBooking.createMany({
    data: [
      {
        id: 'demo-tour-japan-01',
        tripId: futureTrip.id,
        name: 'Private Hanami Experience',
        scheduledAt: addDays(today, 27, 8, 30),
        durationMinutes: 300,
        meetingPoint: 'Lobby do hotel',
        provider: 'Tokyo Select Guides',
        confirmationCode: 'TOUR-JP-01',
        isEssential: true,
      },
      {
        id: 'demo-tour-portugal-01',
        tripId: liveTrip.id,
        name: 'Tour Douro Premium',
        scheduledAt: addDays(today, 3, 8, 0),
        durationMinutes: 540,
        meetingPoint: 'Recepcao do hotel',
        provider: 'Lusitania Private Tours',
        confirmationCode: 'TOUR-PT-12',
        isEssential: true,
      },
      {
        id: 'demo-tour-patagonia-01',
        tripId: pastTrip.id,
        name: 'Glaciar Perito Moreno',
        scheduledAt: addDays(today, -46, 9, 0),
        durationMinutes: 420,
        meetingPoint: 'Lobby do hotel',
        provider: 'Patagonia Ice',
        confirmationCode: 'TOUR-PAT-8',
      },
    ],
  });

  await prisma.trainBooking.createMany({
    data: [
      {
        id: 'demo-train-japan-01',
        tripId: futureTrip.id,
        operator: 'JR',
        trainNumber: 'Nozomi 233',
        origin: 'Tokyo Station',
        destination: 'Kyoto Station',
        departureAt: addDays(today, 30, 9, 3),
        arrivalAt: addDays(today, 30, 11, 16),
        seatClass: 'Green Car',
        confirmationCode: 'JR-2233',
        sortOrder: 1,
      },
      {
        id: 'demo-train-portugal-01',
        tripId: liveTrip.id,
        operator: 'Comboios de Portugal',
        trainNumber: 'AP123',
        origin: 'Lisboa Oriente',
        destination: 'Porto Campanha',
        departureAt: addDays(today, 2, 7, 39),
        arrivalAt: addDays(today, 2, 10, 25),
        seatClass: 'Conforto',
        confirmationCode: 'CP-8844',
        sortOrder: 1,
      },
    ],
  });

  await prisma.insurancePolicy.createMany({
    data: [
      {
        id: 'demo-insurance-japan-01',
        tripId: futureTrip.id,
        provider: 'Assist Card',
        policyNumber: 'AC-JP-1001',
        coverageType: 'Premium Asia',
        startDate: addDays(today, 24, 0, 0),
        endDate: addDays(today, 35, 23, 59),
        emergencyPhone: '+55 11 3191-8700',
        assistanceUrl: 'https://www.assistcard.com',
      },
      {
        id: 'demo-insurance-portugal-01',
        tripId: liveTrip.id,
        provider: 'GTA',
        policyNumber: 'GTA-PT-205',
        coverageType: 'Europa Plus',
        startDate: addDays(today, -2, 0, 0),
        endDate: addDays(today, 6, 23, 59),
        emergencyPhone: '+55 11 3150-4520',
      },
      {
        id: 'demo-insurance-patagonia-01',
        tripId: pastTrip.id,
        provider: 'Universal Assistance',
        policyNumber: 'UA-PA-303',
        coverageType: 'Adventure',
        startDate: addDays(today, -48, 0, 0),
        endDate: addDays(today, -39, 23, 59),
      },
    ],
  });

  await prisma.document.createMany({
    data: [
      {
        id: 'demo-doc-japan-eticket',
        agencyId: agency.id,
        tripId: futureTrip.id,
        passengerId: ana.id,
        uploadedById: agent.id,
        name: 'E-ticket internacional',
        category: 'FLIGHT',
        storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'passenger-documents',
        storagePath: storagePath(agency.id, futureTrip.id, 'demo-doc-japan-eticket', 'e-ticket-japao.pdf'),
        mimeType: 'application/pdf',
        fileSizeBytes: 328145,
        isEssential: true,
        processingStatus: 'DONE',
        structuredMetadata: { source: 'seed', documentType: 'eticket' },
      },
      {
        id: 'demo-doc-portugal-voucher',
        agencyId: agency.id,
        tripId: liveTrip.id,
        passengerId: bruno.id,
        uploadedById: owner.id,
        name: 'Voucher hotel Lisboa',
        category: 'HOTEL',
        storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'passenger-documents',
        storagePath: storagePath(agency.id, liveTrip.id, 'demo-doc-portugal-voucher', 'voucher-lisboa.pdf'),
        mimeType: 'application/pdf',
        fileSizeBytes: 189204,
        isEssential: true,
        processingStatus: 'DONE',
        structuredMetadata: { source: 'seed', documentType: 'voucher' },
      },
      {
        id: 'demo-doc-patagonia-insurance',
        agencyId: agency.id,
        tripId: pastTrip.id,
        passengerId: camila.id,
        uploadedById: agent.id,
        name: 'Apolice seguro viagem',
        category: 'INSURANCE',
        storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'passenger-documents',
        storagePath: storagePath(agency.id, pastTrip.id, 'demo-doc-patagonia-insurance', 'seguro-patagonia.pdf'),
        mimeType: 'application/pdf',
        fileSizeBytes: 210334,
        processingStatus: 'DONE',
        structuredMetadata: { source: 'seed', documentType: 'insurance' },
      },
    ],
  });

  await prisma.internalNote.createMany({
    data: [
      {
        id: 'demo-note-japan-01',
        tripId: futureTrip.id,
        authorId: agent.id,
        body: 'Solicitar early check-in no hotel de Toquio e menu vegetariano para Rafael.',
      },
      {
        id: 'demo-note-portugal-01',
        tripId: liveTrip.id,
        authorId: owner.id,
        body: 'Monitorar atraso do trecho Lisboa-Porto e reacomodar motorista se passar de 60 minutos.',
      },
      {
        id: 'demo-note-patagonia-01',
        tripId: pastTrip.id,
        authorId: agent.id,
        body: 'Trip encerrada. Cliente sinalizou interesse em roteiro no Atacama para 2027.',
      },
    ],
  });

  await prisma.conversation.createMany({
    data: [
      {
        id: 'demo-conv-japan',
        agencyId: agency.id,
        tripId: futureTrip.id,
        passengerId: ana.id,
        phone: ana.phone ?? '+5511981112200',
        status: 'OPEN',
        contextSummary: 'Troca de mensagens sobre documentos e roteiro do Japao.',
        lastMessageAt: addDays(today, -1, 17, 15),
      },
      {
        id: 'demo-conv-portugal',
        agencyId: agency.id,
        tripId: liveTrip.id,
        passengerId: bruno.id,
        phone: bruno.phone ?? '+5511981113300',
        status: 'OPEN',
        contextSummary: 'Operacao acompanhando atraso de voo e traslado.',
        lastMessageAt: addDays(today, 0, 8, 20),
      },
      {
        id: 'demo-conv-patagonia',
        agencyId: agency.id,
        tripId: pastTrip.id,
        passengerId: camila.id,
        phone: camila.phone ?? '+5511981114400',
        status: 'CLOSED',
        contextSummary: 'Pos-viagem com feedback e entrega de comprovantes.',
        lastMessageAt: addDays(today, -37, 15, 40),
      },
    ],
  });

  await prisma.message.createMany({
    data: [
      {
        id: 'demo-msg-japan-01',
        conversationId: 'demo-conv-japan',
        role: 'USER',
        direction: 'INBOUND',
        body: 'Voces conseguem me mandar o ticket do trem para Kyoto no portal?',
        waStatus: 'READ',
      },
      {
        id: 'demo-msg-japan-02',
        conversationId: 'demo-conv-japan',
        role: 'ASSISTANT',
        direction: 'OUTBOUND',
        body: 'Sim. O ticket ja esta vinculado ao seu portal e tambem no bucket de documentos da viagem.',
        waStatus: 'DELIVERED',
        aiModel: 'claude-3-5-sonnet-20241022',
      },
      {
        id: 'demo-msg-portugal-01',
        conversationId: 'demo-conv-portugal',
        role: 'SYSTEM',
        direction: 'OUTBOUND',
        body: 'Alerta operacional: voo TP058 com atraso previsto de 55 minutos.',
        waStatus: 'DELIVERED',
        payload: { delayMinutes: 55, flightNumber: 'TP058' },
      },
      {
        id: 'demo-msg-portugal-02',
        conversationId: 'demo-conv-portugal',
        role: 'USER',
        direction: 'INBOUND',
        body: 'Perfeito, mantenham o transfer atualizado por favor.',
        waStatus: 'READ',
      },
      {
        id: 'demo-msg-patagonia-01',
        conversationId: 'demo-conv-patagonia',
        role: 'ASSISTANT',
        direction: 'OUTBOUND',
        body: 'Encerramos sua viagem e liberamos a apolice e o voucher finalizados no portal.',
        waStatus: 'READ',
      },
    ],
  });

  await prisma.alert.createMany({
    data: [
      {
        id: 'demo-alert-portugal-delay',
        agencyId: agency.id,
        tripId: liveTrip.id,
        flightSegmentId: 'demo-flight-portugal-01',
        type: 'FLIGHT_DELAY',
        severity: 'WARNING',
        title: 'Voo TP058 com atraso',
        body: 'Trecho Lisboa -> Porto atualizado com atraso operacional de 55 minutos.',
        data: { delayMinutes: 55, source: 'cirium' },
      },
      {
        id: 'demo-alert-japan-document',
        agencyId: agency.id,
        tripId: futureTrip.id,
        type: 'DOCUMENT_ADDED',
        severity: 'INFO',
        title: 'E-ticket liberado',
        body: 'Documento principal do trecho internacional ja esta disponivel para a passageira.',
      },
      {
        id: 'demo-alert-patagonia-system',
        agencyId: agency.id,
        tripId: pastTrip.id,
        type: 'SYSTEM',
        severity: 'INFO',
        title: 'Trip concluida',
        body: 'Viagem concluida e preparada para etapa de pos-venda.',
        resolvedAt: addDays(today, -38, 12, 0),
      },
    ],
  });

  // ── WhatsApp Demo: Passengers, Trips & TripItems ───────────────────────────
  console.log('Seeding WhatsApp demo data...');

  // Check if already seeded
  const waDemoCount = await prisma.tripItem.count({ where: { agencyId: agency.id } });

  if (waDemoCount === 0) {
    // Passengers
    const carlos = await prisma.passenger.upsert({
      where: { id: 'demo-passenger-carlos' },
      update: { agencyId: agency.id, name: 'Carlos Eduardo Ferreira', phone: '+5511999990001', email: 'carlos@email.com' },
      create: { id: 'demo-passenger-carlos', agencyId: agency.id, name: 'Carlos Eduardo Ferreira', phone: '+5511999990001', email: 'carlos@email.com' },
    });

    const rebeca = await prisma.passenger.upsert({
      where: { id: 'demo-passenger-rebeca' },
      update: { agencyId: agency.id, name: 'Rebeca Lima Santos', phone: '+5521999990002', email: 'rebeca@email.com' },
      create: { id: 'demo-passenger-rebeca', agencyId: agency.id, name: 'Rebeca Lima Santos', phone: '+5521999990002', email: 'rebeca@email.com' },
    });

    const sulivan = await prisma.passenger.upsert({
      where: { id: 'demo-passenger-sulivan' },
      update: { agencyId: agency.id, name: 'Sulivan Oliveira', phone: '+5548999990003', email: 'sulivan@email.com' },
      create: { id: 'demo-passenger-sulivan', agencyId: agency.id, name: 'Sulivan Oliveira', phone: '+5548999990003', email: 'sulivan@email.com' },
    });

    // Trip 1: Paris
    const parisStart = addDays(today, 7, 10, 0);
    const parisEnd = addDays(today, 17, 10, 0);

    const parisTrip = await prisma.trip.upsert({
      where: { id: 'demo-trip-paris' },
      update: {
        agencyId: agency.id,
        createdById: owner.id,
        title: 'Paris & Riviera Francesa',
        destination: 'Paris, França',
        startDate: parisStart,
        endDate: parisEnd,
        status: 'IN_PROGRESS',
        isActiveForWhatsapp: true,
      },
      create: {
        id: 'demo-trip-paris',
        agencyId: agency.id,
        createdById: owner.id,
        title: 'Paris & Riviera Francesa',
        destination: 'Paris, França',
        startDate: parisStart,
        endDate: parisEnd,
        status: 'IN_PROGRESS',
        isActiveForWhatsapp: true,
      },
    });

    // Trip 2: NY
    const nyStart = addDays(today, 30, 10, 0);
    const nyEnd = addDays(today, 37, 10, 0);

    const nyTrip = await prisma.trip.upsert({
      where: { id: 'demo-trip-ny' },
      update: {
        agencyId: agency.id,
        createdById: agent.id,
        title: 'Nova York Clássica',
        destination: 'Nova York, EUA',
        startDate: nyStart,
        endDate: nyEnd,
        status: 'READY',
        isActiveForWhatsapp: false,
      },
      create: {
        id: 'demo-trip-ny',
        agencyId: agency.id,
        createdById: agent.id,
        title: 'Nova York Clássica',
        destination: 'Nova York, EUA',
        startDate: nyStart,
        endDate: nyEnd,
        status: 'READY',
        isActiveForWhatsapp: false,
      },
    });

    // Trip 3: Lisboa
    const lisbonStart = addDays(today, -60, 10, 0);
    const lisbonEnd = addDays(today, -50, 10, 0);

    const lisbonTrip = await prisma.trip.upsert({
      where: { id: 'demo-trip-lisbon-wa' },
      update: {
        agencyId: agency.id,
        createdById: owner.id,
        title: 'Lisboa e Porto',
        destination: 'Lisboa & Porto, Portugal',
        startDate: lisbonStart,
        endDate: lisbonEnd,
        status: 'COMPLETED',
        isActiveForWhatsapp: false,
      },
      create: {
        id: 'demo-trip-lisbon-wa',
        agencyId: agency.id,
        createdById: owner.id,
        title: 'Lisboa e Porto',
        destination: 'Lisboa & Porto, Portugal',
        startDate: lisbonStart,
        endDate: lisbonEnd,
        status: 'COMPLETED',
        isActiveForWhatsapp: false,
      },
    });

    // TripPassengers
    await prisma.tripPassenger.upsert({
      where: { id: 'demo-tp-paris-carlos' },
      update: { tripId: parisTrip.id, passengerId: carlos.id, name: carlos.name, isLead: true },
      create: { id: 'demo-tp-paris-carlos', tripId: parisTrip.id, passengerId: carlos.id, name: carlos.name, email: carlos.email, phone: carlos.phone, isLead: true },
    });

    await prisma.tripPassenger.upsert({
      where: { id: 'demo-tp-ny-rebeca' },
      update: { tripId: nyTrip.id, passengerId: rebeca.id, name: rebeca.name, isLead: true },
      create: { id: 'demo-tp-ny-rebeca', tripId: nyTrip.id, passengerId: rebeca.id, name: rebeca.name, email: rebeca.email, phone: rebeca.phone, isLead: true },
    });

    await prisma.tripPassenger.upsert({
      where: { id: 'demo-tp-lisbon-sulivan' },
      update: { tripId: lisbonTrip.id, passengerId: sulivan.id, name: sulivan.name, isLead: true },
      create: { id: 'demo-tp-lisbon-sulivan', tripId: lisbonTrip.id, passengerId: sulivan.id, name: sulivan.name, email: sulivan.email, phone: sulivan.phone, isLead: true },
    });

    // ── TripItems: Paris ──────────────────────────────────────────────────────
    await prisma.tripItem.createMany({
      data: [
        {
          id: 'demo-item-paris-flight-out',
          agencyId: agency.id,
          tripId: parisTrip.id,
          type: 'FLIGHT',
          title: 'GRU → CDG - Air France AF447',
          providerName: 'Air France',
          startAt: addDays(parisStart, 0, 22, 30),
          confirmationCode: 'XABCP1',
          location: 'São Paulo/Guarulhos (GRU)',
          description: 'Embarque terminal 3. Check-in online recomendado.',
          sortOrder: 1,
        },
        {
          id: 'demo-item-paris-hotel',
          agencyId: agency.id,
          tripId: parisTrip.id,
          type: 'HOTEL',
          title: 'Hotel Le Marais',
          providerName: 'Booking.com',
          startAt: addDays(parisStart, 1, 15, 0),
          endAt: addDays(parisEnd, -2, 11, 0),
          location: '15 Rue de Bretagne, Paris 75003',
          confirmationCode: 'BKG123456',
          description: 'Café da manhã incluído. WiFi gratuito.',
          sortOrder: 2,
        },
        {
          id: 'demo-item-paris-transfer',
          agencyId: agency.id,
          tripId: parisTrip.id,
          type: 'TRANSPORT',
          title: 'Transfer CDG → Hotel',
          providerName: 'Paris Transfer',
          startAt: addDays(parisStart, 1, 7, 0),
          location: 'CDG Terminal 2E',
          confirmationCode: 'PTR7788',
          sortOrder: 3,
        },
        {
          id: 'demo-item-paris-tour1',
          agencyId: agency.id,
          tripId: parisTrip.id,
          type: 'TOUR',
          title: 'City tour Paris + Torre Eiffel',
          providerName: 'Paris City Tours',
          startAt: addDays(parisStart, 3, 9, 0),
          location: 'Trocadéro, Paris',
          confirmationCode: 'PCT2024',
          sortOrder: 4,
        },
        {
          id: 'demo-item-paris-tour2',
          agencyId: agency.id,
          tripId: parisTrip.id,
          type: 'TOUR',
          title: 'Excursão Versalhes',
          providerName: 'Versailles Tours',
          startAt: addDays(parisStart, 5, 8, 30),
          location: 'Palácio de Versalhes',
          description: 'Entrada e guia incluídos.',
          sortOrder: 5,
        },
        {
          id: 'demo-item-paris-insurance',
          agencyId: agency.id,
          tripId: parisTrip.id,
          type: 'INSURANCE',
          title: 'Seguro Viagem Europa',
          providerName: 'Assist Card',
          startAt: parisStart,
          endAt: parisEnd,
          confirmationCode: 'AC-987654',
          description: 'Cobertura médica €100.000. Emergências: +55 0800-xxx-xxxx',
          sortOrder: 6,
        },
        {
          id: 'demo-item-paris-flight-ret',
          agencyId: agency.id,
          tripId: parisTrip.id,
          type: 'FLIGHT',
          title: 'CDG → GRU - Air France AF448',
          providerName: 'Air France',
          startAt: addDays(parisEnd, -1, 11, 0),
          confirmationCode: 'XABCP2',
          location: 'Paris/Charles de Gaulle (CDG)',
          sortOrder: 7,
        },
      ],
    });

    // ── TripItems: NY ─────────────────────────────────────────────────────────
    await prisma.tripItem.createMany({
      data: [
        {
          id: 'demo-item-ny-flight-out',
          agencyId: agency.id,
          tripId: nyTrip.id,
          type: 'FLIGHT',
          title: 'GRU → JFK - LATAM LA8094',
          providerName: 'LATAM Airlines',
          startAt: addDays(nyStart, 0, 21, 45),
          confirmationCode: 'NYLATAM',
          location: 'São Paulo/Guarulhos',
          sortOrder: 1,
        },
        {
          id: 'demo-item-ny-hotel',
          agencyId: agency.id,
          tripId: nyTrip.id,
          type: 'HOTEL',
          title: 'The Westin New York Times Square',
          providerName: 'Marriott',
          startAt: addDays(nyStart, 1, 15, 0),
          endAt: addDays(nyEnd, -1, 12, 0),
          location: '270 W 43rd St, New York, NY 10036',
          confirmationCode: 'WES99887',
          sortOrder: 2,
        },
        {
          id: 'demo-item-ny-transfer',
          agencyId: agency.id,
          tripId: nyTrip.id,
          type: 'TRANSPORT',
          title: 'NYC Airporter - JFK → Hotel',
          providerName: 'NYC Airporter',
          startAt: addDays(nyStart, 1, 6, 30),
          confirmationCode: 'AIR5566',
          sortOrder: 3,
        },
        {
          id: 'demo-item-ny-insurance',
          agencyId: agency.id,
          tripId: nyTrip.id,
          type: 'INSURANCE',
          title: 'Seguro Viagem América do Norte',
          providerName: 'SulAmérica',
          confirmationCode: 'SA-456123',
          sortOrder: 4,
        },
      ],
    });

    // ── Simulated WhatsApp Conversations for Paris trip ───────────────────────
    await prisma.document.createMany({
      data: [
        {
          id: 'demo-doc-paris-flight-out',
          agencyId: agency.id,
          tripId: parisTrip.id,
          passengerId: carlos.id,
          tripItemId: 'demo-item-paris-flight-out',
          uploadedById: owner.id,
          name: 'Boarding pass ida Paris',
          category: 'FLIGHT',
          storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'passenger-documents',
          storagePath: storagePath(agency.id, parisTrip.id, 'demo-doc-paris-flight-out', 'boarding-pass-ida-paris.pdf'),
          mimeType: 'application/pdf',
          fileSizeBytes: 184210,
          processingStatus: 'DONE',
          structuredMetadata: {
            categoryKey: 'boarding_pass',
            originalFilename: 'boarding-pass-ida-paris.pdf',
            linkedEntityType: 'trip_item',
            linkedEntityId: 'demo-item-paris-flight-out',
            linkedEntityLabel: 'GRU -> CDG - Air France AF447',
          },
        },
        {
          id: 'demo-doc-paris-hotel',
          agencyId: agency.id,
          tripId: parisTrip.id,
          passengerId: carlos.id,
          tripItemId: 'demo-item-paris-hotel',
          uploadedById: owner.id,
          name: 'Voucher Hotel Le Marais',
          category: 'HOTEL',
          storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'passenger-documents',
          storagePath: storagePath(agency.id, parisTrip.id, 'demo-doc-paris-hotel', 'voucher-hotel-le-marais.pdf'),
          mimeType: 'application/pdf',
          fileSizeBytes: 152900,
          processingStatus: 'DONE',
          structuredMetadata: {
            categoryKey: 'hotel_voucher',
            originalFilename: 'voucher-hotel-le-marais.pdf',
            linkedEntityType: 'trip_item',
            linkedEntityId: 'demo-item-paris-hotel',
            linkedEntityLabel: 'Hotel Le Marais',
          },
        },
        {
          id: 'demo-doc-paris-transfer',
          agencyId: agency.id,
          tripId: parisTrip.id,
          passengerId: carlos.id,
          tripItemId: 'demo-item-paris-transfer',
          uploadedById: owner.id,
          name: 'Voucher transfer CDG',
          category: 'TRANSFER',
          storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'passenger-documents',
          storagePath: storagePath(agency.id, parisTrip.id, 'demo-doc-paris-transfer', 'voucher-transfer-cdg.pdf'),
          mimeType: 'application/pdf',
          fileSizeBytes: 96320,
          processingStatus: 'DONE',
          structuredMetadata: {
            categoryKey: 'transport_voucher',
            originalFilename: 'voucher-transfer-cdg.pdf',
            linkedEntityType: 'trip_item',
            linkedEntityId: 'demo-item-paris-transfer',
            linkedEntityLabel: 'Transfer CDG -> Hotel',
          },
        },
        {
          id: 'demo-doc-paris-tour',
          agencyId: agency.id,
          tripId: parisTrip.id,
          passengerId: carlos.id,
          tripItemId: 'demo-item-paris-tour1',
          uploadedById: owner.id,
          name: 'Ingresso City Tour Paris',
          category: 'TOUR',
          storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'passenger-documents',
          storagePath: storagePath(agency.id, parisTrip.id, 'demo-doc-paris-tour', 'ingresso-city-tour-paris.pdf'),
          mimeType: 'application/pdf',
          fileSizeBytes: 120480,
          processingStatus: 'DONE',
          structuredMetadata: {
            categoryKey: 'tour_voucher',
            originalFilename: 'ingresso-city-tour-paris.pdf',
            linkedEntityType: 'trip_item',
            linkedEntityId: 'demo-item-paris-tour1',
            linkedEntityLabel: 'City tour Paris + Torre Eiffel',
          },
        },
        {
          id: 'demo-doc-ny-hotel',
          agencyId: agency.id,
          tripId: nyTrip.id,
          passengerId: rebeca.id,
          tripItemId: 'demo-item-ny-hotel',
          uploadedById: agent.id,
          name: 'Voucher Westin Times Square',
          category: 'HOTEL',
          storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'passenger-documents',
          storagePath: storagePath(agency.id, nyTrip.id, 'demo-doc-ny-hotel', 'voucher-westin-times-square.pdf'),
          mimeType: 'application/pdf',
          fileSizeBytes: 149620,
          processingStatus: 'DONE',
          structuredMetadata: {
            categoryKey: 'hotel_voucher',
            originalFilename: 'voucher-westin-times-square.pdf',
            linkedEntityType: 'trip_item',
            linkedEntityId: 'demo-item-ny-hotel',
            linkedEntityLabel: 'The Westin New York Times Square',
          },
        },
      ],
    });

    let parisConv = await prisma.conversation.findFirst({
      where: { phone: carlos.phone ?? '', agencyId: agency.id, tripId: parisTrip.id },
    });

    if (!parisConv) {
      parisConv = await prisma.conversation.create({
        data: {
          id: 'demo-conv-paris-carlos',
          agencyId: agency.id,
          tripId: parisTrip.id,
          passengerId: carlos.id,
          phone: carlos.phone ?? '+5511999990001',
          status: 'OPEN',
          lastMessageAt: addDays(today, -1, 10, 0),
        },
      });
    }

    await prisma.message.createMany({
      data: [
        {
          id: 'demo-msg-paris-01-in',
          conversationId: parisConv.id,
          role: 'USER',
          direction: 'INBOUND',
          body: 'Olá, qual é meu voo?',
          waStatus: 'READ',
        },
        {
          id: 'demo-msg-paris-01-out',
          conversationId: parisConv.id,
          role: 'ASSISTANT',
          direction: 'OUTBOUND',
          body: 'Oi, Carlos! Seu voo é o GRU → CDG - Air France AF447 pela Air France, saindo em ' + addDays(parisStart, 0, 22, 30).toLocaleDateString('pt-BR') + ' às 22:30 de São Paulo/Guarulhos (GRU). Localizador: XABCP1.',
          waStatus: 'DELIVERED',
        },
        {
          id: 'demo-msg-paris-02-in',
          conversationId: parisConv.id,
          role: 'USER',
          direction: 'INBOUND',
          body: 'Qual é meu hotel?',
          waStatus: 'READ',
        },
        {
          id: 'demo-msg-paris-02-out',
          conversationId: parisConv.id,
          role: 'ASSISTANT',
          direction: 'OUTBOUND',
          body: 'Carlos, seu hotel é Hotel Le Marais (Booking.com), localizado em 15 Rue de Bretagne, Paris 75003. Reserva: BKG123456.',
          waStatus: 'DELIVERED',
        },
        {
          id: 'demo-msg-paris-03-in',
          conversationId: parisConv.id,
          role: 'USER',
          direction: 'INBOUND',
          body: 'Tem passeio amanhã?',
          waStatus: 'READ',
        },
        {
          id: 'demo-msg-paris-03-out',
          conversationId: parisConv.id,
          role: 'ASSISTANT',
          direction: 'OUTBOUND',
          body: 'Carlos, seus passeios: City tour Paris + Torre Eiffel em Trocadéro, Paris | Excursão Versalhes no Palácio de Versalhes.',
          waStatus: 'DELIVERED',
        },
      ],
    });

    console.log('WhatsApp demo data seeded successfully.');
    console.log('Demo passengers: carlos@email.com (+5511999990001), rebeca@email.com (+5521999990002), sulivan@email.com (+5548999990003)');
  } else {
    console.log('WhatsApp demo data already seeded, skipping.');
  }

  console.log('Seed concluido.');
  console.log('Agencia:', agency.name);
  console.log('Admins: admin@atlasconcierge.com / AtlasAdmin123!');
  console.log('Operacao: operacao@atlasconcierge.com / AtlasAdmin123!');
  if (supabase) {
    console.log('Passageiros com auth Supabase: ana.bezerra@demo.com e bruno.carvalho@demo.com / Passageiro123!');
  } else {
    console.log('Supabase Auth nao configurado no ambiente. Seed criou dados operacionais e deixou auth pendente.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
