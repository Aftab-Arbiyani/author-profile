type BrandMarkProps = {
  size?: number;
  className?: string;
};

/**
 * Brand mark: an amber italic serif "A" on a rounded night tile, using the
 * site's --night (#161616) and --amber (#d4a84b) tokens. Kept solid (no split)
 * so it reads cleanly at nav (26px) and favicon (16px) sizes. The same mark is
 * served as the favicon via app/icon.svg.
 */
export function BrandMark({ size = 26, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="100" height="100" rx="20" fill="#161616" />
      <text
        x="50"
        y="76"
        textAnchor="middle"
        fontFamily="Georgia, 'Palatino Linotype', 'Times New Roman', serif"
        fontSize="86"
        fontStyle="italic"
        fontWeight="600"
        fill="#d4a84b"
      >
        A
      </text>
    </svg>
  );
}
