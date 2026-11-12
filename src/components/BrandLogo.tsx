export type BrandLogoVariant =
  | "full-dark"
  | "full-light"
  | "mark-dark"
  | "mark-light"
  | "wordmark"
  | "mono-white"
  | "mono-black"
  | "persian-teal"
  | "en-orange";

const LOGO_SRC: Record<BrandLogoVariant, string> = {
  "full-dark": "/brand/hoomaan-logo-dark.png",
  "full-light": "/brand/hoomaan-logo-light.png",
  "mark-dark": "/brand/hoomaan-mark-dark.png",
  "mark-light": "/brand/hoomaan-mark-light.png",
  wordmark: "/brand/hoomaan-wordmark.png",
  "mono-white": "/brand/hoomaan-mono-white.png",
  "mono-black": "/brand/hoomaan-mono-black.png",
  "persian-teal": "/brand/hoomaan-persian-teal.png",
  "en-orange": "/brand/hoomaan-en-orange.png",
};

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  alt?: string;
  decorative?: boolean;
}

/** Official HOOMAAN brand mark and wordmark rendered from crisp local assets. */
export function BrandLogo({
  variant = "full-dark",
  className = "h-10 w-auto",
  alt = "HOOMAAN — هومان",
  decorative = false,
}: BrandLogoProps) {
  return (
    <img
      src={LOGO_SRC[variant]}
      alt={decorative ? "" : alt}
      aria-hidden={decorative || undefined}
      draggable={false}
      className={`select-none object-contain ${className}`}
    />
  );
}
