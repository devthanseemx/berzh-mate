export const CURRENCY = 'LKR';

// Total fare: base fare plus distance in kilometres times the price per kilometre.
export function fareFor(distanceM: number, pricePerKm: number, baseFare: number): number {
  const km = distanceM / 1000;
  return Math.round((baseFare + km * pricePerKm) * 100) / 100;
}

// Formats an amount as "LKR 1,250.00".
export function money(n: number): string {
  const [whole, cents] = n.toFixed(2).split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${CURRENCY} ${withCommas}.${cents}`;
}