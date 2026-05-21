export function formatRupiah(amount: number): string {
  return 'Rp' + amount.toLocaleString('id-ID');
}

export function formatDate(date: number | Date): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(date: number | Date): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(date: number | Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function getShiftDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function generateQuickNominals(total: number): number[] {
  const nominals: number[] = [total];
  const round5000 = Math.ceil(total / 5000) * 5000;
  if (round5000 > total) nominals.push(round5000);
  const round10000 = Math.ceil(total / 10000) * 10000;
  if (round10000 > total && !nominals.includes(round10000)) nominals.push(round10000);
  const round20000 = Math.ceil(total / 20000) * 20000;
  if (round20000 > total && !nominals.includes(round20000)) nominals.push(round20000);
  const round50000 = Math.ceil(total / 50000) * 50000;
  if (round50000 > total && !nominals.includes(round50000)) nominals.push(round50000);
  const round100000 = Math.ceil(total / 100000) * 100000;
  if (round100000 > total && !nominals.includes(round100000)) nominals.push(round100000);
  return nominals.sort((a, b) => a - b);
}
