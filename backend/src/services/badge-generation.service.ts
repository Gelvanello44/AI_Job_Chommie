import sharp from 'sharp';
import logger from '../config/logger.js';

export type BadgeTheme = 'teal' | 'purple' | 'gold' | 'slate';

export interface BadgeOptions {
  title: string;
  subtitle?: string;
  score?: number;
  strength?: string;
  theme?: BadgeTheme;
  width?: number;
  height?: number;
}

/**
 * BadgeGenerationService
 * Creates shareable badge images (PNG) on-the-fly from SVG templates
 */
export class BadgeGenerationService {
  static async generateBadgePng(options: BadgeOptions): Promise<Buffer> {
    const svg = this.renderBadgeSVG(options);
    try {
      const png = await sharp(Buffer.from(svg))
        .png({ quality: 90 })
        .toBuffer();
      return png;
    } catch (error) {
      logger.error('Failed to generate badge PNG', { error });
      throw error;
    }
  }

  static renderBadgeSVG({
    title,
    subtitle,
    score,
    strength,
    theme = 'teal',
    width = 800,
    height = 400
  }: BadgeOptions): string {
    const themes: Record<BadgeTheme, { gradStart: string; gradEnd: string; accent: string }> = {
      teal: { gradStart: '#0ea5e9', gradEnd: '#14b8a6', accent: '#99f6e4' },
      purple: { gradStart: '#7c3aed', gradEnd: '#a855f7', accent: '#e9d5ff' },
      gold: { gradStart: '#f59e0b', gradEnd: '#f97316', accent: '#fde68a' },
      slate: { gradStart: '#334155', gradEnd: '#0f172a', accent: '#94a3b8' }
    };

    const palette = themes[theme];

    const safe = (s?: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

    // Score ring if provided
    const scoreRing = typeof score === 'number'
      ? `
      <g transform="translate(${width - 140}, 120)">
        <circle cx="0" cy="0" r="60" fill="rgba(255,255,255,0.15)" />
        <circle cx="0" cy="0" r="60" fill="none" stroke="${palette.accent}" stroke-width="10" stroke-linecap="round"
          stroke-dasharray="${Math.max(1, Math.min(100, score)) * 3.77} 999" transform="rotate(-90)" />
        <text x="0" y="10" text-anchor="middle" font-size="28" font-weight="700" fill="#ffffff">${Math.round(score)}%</text>
        <text x="0" y="34" text-anchor="middle" font-size="12" fill="${palette.accent}">SCORE</text>
      </g>`
      : '';

    const strengthTag = strength
      ? `<g transform="translate(40, ${height - 80})">
          <rect x="0" y="-30" rx="14" ry="14" width="auto" height="40" fill="rgba(255,255,255,0.12)" />
          <text x="0" y="0" font-size="18" font-weight="600" fill="#ffffff">Top Strength: <tspan fill="${palette.accent}">${safe(strength)}</tspan></text>
        </g>`
      : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.gradStart}" />
      <stop offset="100%" stop-color="${palette.gradEnd}" />
    </linearGradient>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.25"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#g)"/>

  <g filter="url(#shadow)">
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="20" fill="rgba(0,0,0,0.15)" />
  </g>

  <g transform="translate(40, 80)">
    <text x="0" y="0" font-size="36" font-weight="700" fill="#ffffff">${safe(title)}</text>
    ${subtitle ? `<text x="0" y="40" font-size="18" fill="${palette.accent}">${safe(subtitle)}</text>` : ''}
    <text x="0" y="90" font-size="14" fill="#e5e7eb">AI Job Chommie • Shareable Badge</text>
  </g>

  ${scoreRing}
  ${strengthTag}

  <g transform="translate(${width - 220}, ${height - 70})">
    <rect x="0" y="-30" rx="14" ry="14" width="180" height="40" fill="rgba(255,255,255,0.12)" />
    <text x="90" y="-5" text-anchor="middle" font-size="14" fill="#ffffff">aijobchommie.co.za</text>
  </g>
</svg>`;
  }

  static buildLinkedInText(type: string, score?: number, strength?: string): string {
    const parts: string[] = [];
    if (type) {
      parts.push(`Just completed the ${type.toLowerCase()} skills assessment on AI Job Chommie`);
    } else {
      parts.push('Proud to share my new AI Job Chommie badge');
    }
    if (typeof score === 'number') parts.push(`Scored ${Math.round(score)}%`);
    if (strength) parts.push(`Top strength: ${strength}`);
    parts.push('#AIJobChommie #CareerGrowth');
    return parts.join(' • ');
  }
}

export const badgeGenerationService = BadgeGenerationService;
