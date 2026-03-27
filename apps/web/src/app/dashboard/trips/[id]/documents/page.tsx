import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/page-header';
import { TripDocumentsManager } from '@/components/trips/trip-documents-manager';
import { getDocumentCategoryLabel, readDocumentMetadata } from '@/modules/documents/document-meta';

export default async function TripDocumentsPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const trip = await prisma.trip.findFirst({
    where: {
      id: params.id,
      agencyId: session.user.agencyId,
    },
    include: {
      passengers: { include: { passenger: true } },
      tripItems: {
        orderBy: [{ startAt: 'asc' }, { sortOrder: 'asc' }],
      },
      documents: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!trip) {
    notFound();
  }

  const passengerOptions = trip.passengers
    .filter((passenger) => passenger.passengerId && passenger.passenger)
    .map((passenger) => ({
      value: passenger.passengerId as string,
      label: passenger.passenger?.name ?? passenger.name,
    }));

  const entityOptions = trip.tripItems.map((item) => ({
    type: 'trip_item',
    value: item.id,
    label: item.title,
  }));

  const documents = trip.documents.map((document) => {
    const meta = readDocumentMetadata(document.structuredMetadata);
    return {
      id: document.id,
      passengerId: document.passengerId,
      passengerName: trip.passengers.find((passenger) => passenger.passengerId === document.passengerId)?.passenger?.name ?? null,
      category: meta.categoryKey ?? 'other',
      categoryLabel: getDocumentCategoryLabel(meta.categoryKey),
      title: document.name,
      originalFilename: meta.originalFilename ?? document.name,
      fileUrl: null,
      previewUrl: null,
      downloadUrl: null,
      mimeType: document.mimeType,
      extractedText: document.extractedText,
      structuredMetadata: document.structuredMetadata as Record<string, unknown> | null,
      linkedEntityType: meta.linkedEntityType ?? null,
      linkedEntityId: meta.linkedEntityId ?? null,
      linkedEntityLabel: meta.linkedEntityLabel ?? null,
      processingStatus: document.processingStatus,
      fileSizeBytes: document.fileSizeBytes,
      description: document.description,
      createdAt: document.createdAt.toISOString(),
      uploadedBy: null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/trips/${trip.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#5b665d] transition hover:text-[#142018]">
          <ChevronLeft className="h-4 w-4" />
          Voltar para a viagem
        </Link>
      </div>

      <PageHeader
        eyebrow="Hub documental"
        title={`Documentos · ${trip.title}`}
        description="Biblioteca documental da viagem com upload no Supabase Storage, vinculo por passageiro e contexto operacional."
      />

      <TripDocumentsManager
        tripId={trip.id}
        initialDocuments={documents}
        passengerOptions={passengerOptions}
        entityOptions={entityOptions}
      />
    </div>
  );
}
