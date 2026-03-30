export function isPrismaConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('authentication failed against database server') ||
    message.includes('error opening a tls connection') ||
    message.includes('can\'t reach database server') ||
    message.includes("can't reach database server") ||
    message.includes('provided database credentials') ||
    message.includes('invalid `prisma.')
  );
}
