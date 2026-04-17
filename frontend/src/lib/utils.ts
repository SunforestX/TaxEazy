export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(dateString: string | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function classNames(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const cn = classNames;
