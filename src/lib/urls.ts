const baseUrl = import.meta.env.BASE_URL || '/';
const basePath = baseUrl === '/' ? '' : baseUrl.replace(/\/$/, '');

export function withoutBase(path: string | undefined): string {
  if (!path) return '/';
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  if (!path.startsWith('/')) return path;
  if (!basePath) return path;
  if (path === basePath || path === `${basePath}/`) return '/';
  if (path.startsWith(`${basePath}/`)) return path.slice(basePath.length) || '/';
  return path;
}

export function withBase(path: string | undefined): string {
  if (!path) return '';
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  if (!path.startsWith('/')) return path;
  return `${basePath}${withoutBase(path)}`;
}

export function absoluteUrl(path: string | undefined, site = 'https://atrium.earth'): string {
  const value = path || '/';
  if (/^https?:/.test(value)) return value;
  const origin = new URL(site).origin;
  return new URL(withBase(withoutBase(value)), `${origin}/`).toString();
}
