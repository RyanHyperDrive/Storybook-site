// Inline-SVG illustrated previews for each MVP art style.
// IMPORTANT: no readable text inside any SVG. All titles/captions are
// rendered as HTML by the consumer.
import type { ArtStyleKey } from "@/lib/art-styles";

type Variant = "cover" | "page-a" | "page-b";

export function StyleArtwork({
  styleKey,
  variant = "cover",
  className,
}: {
  styleKey: ArtStyleKey;
  variant?: Variant;
  className?: string;
}) {
  const Scene = SCENES[styleKey][variant];
  return (
    <div className={className}>
      <Scene />
    </div>
  );
}

/* ---------- shared bits ---------- */
const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 400 500"
    preserveAspectRatio="xMidYMid slice"
    className="block h-full w-full"
    role="img"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/* ---------- Classic Storybook — cozy forest / garden ---------- */
function ClassicCover() {
  return (
    <Svg>
      <defs>
        <linearGradient id="cs-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fbe7c6" />
          <stop offset="1" stopColor="#f4c98a" />
        </linearGradient>
        <radialGradient id="cs-sun" cx="0.7" cy="0.25" r="0.4">
          <stop offset="0" stopColor="#fff3d0" />
          <stop offset="1" stopColor="#fbe7c6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="500" fill="url(#cs-sky)" />
      <rect width="400" height="500" fill="url(#cs-sun)" />
      {/* hills */}
      <path d="M0 360 Q120 280 240 340 T400 320 V500 H0 Z" fill="#a7c79a" />
      <path d="M0 400 Q140 340 280 380 T400 370 V500 H0 Z" fill="#7da66e" />
      {/* trees */}
      <g>
        <ellipse cx="80" cy="320" rx="48" ry="56" fill="#3f6b48" />
        <rect x="74" y="350" width="12" height="40" fill="#6b4a2b" />
        <ellipse cx="320" cy="300" rx="56" ry="64" fill="#3f6b48" />
        <rect x="314" y="335" width="12" height="50" fill="#6b4a2b" />
        <ellipse cx="200" cy="290" rx="40" ry="48" fill="#4d7a55" />
        <rect x="195" y="320" width="10" height="36" fill="#6b4a2b" />
      </g>
      {/* path */}
      <path d="M180 500 Q200 420 220 360 Q230 320 200 290" stroke="#e7c98a" strokeWidth="22" fill="none" strokeLinecap="round" />
      {/* child silhouette */}
      <g transform="translate(186 380)">
        <circle cx="14" cy="0" r="14" fill="#f1c8a0" />
        <rect x="2" y="14" width="24" height="32" rx="6" fill="#c8553d" />
        <rect x="6" y="46" width="6" height="18" fill="#3a2a1a" />
        <rect x="16" y="46" width="6" height="18" fill="#3a2a1a" />
      </g>
      {/* fireflies */}
      <g fill="#fff7d0">
        <circle cx="120" cy="200" r="3" />
        <circle cx="280" cy="180" r="2.5" />
        <circle cx="240" cy="240" r="2" />
        <circle cx="100" cy="260" r="2" />
      </g>
    </Svg>
  );
}
function ClassicPageA() {
  return (
    <Svg>
      <rect width="400" height="500" fill="#fbe7c6" />
      <path d="M0 380 Q200 330 400 380 V500 H0 Z" fill="#7da66e" />
      <ellipse cx="100" cy="340" rx="60" ry="68" fill="#3f6b48" />
      <rect x="92" y="380" width="16" height="50" fill="#6b4a2b" />
      <g transform="translate(220 360)">
        <circle cx="14" cy="0" r="14" fill="#f1c8a0" />
        <rect x="2" y="14" width="24" height="32" rx="6" fill="#c8553d" />
      </g>
      <circle cx="320" cy="120" r="40" fill="#fff3d0" />
    </Svg>
  );
}
function ClassicPageB() {
  return (
    <Svg>
      <rect width="400" height="500" fill="#f4d8a8" />
      <path d="M0 420 H400 V500 H0 Z" fill="#7da66e" />
      <g>
        <ellipse cx="200" cy="260" rx="120" ry="80" fill="#fff3d0" opacity="0.7" />
        <circle cx="200" cy="260" r="40" fill="#c8553d" />
        <circle cx="200" cy="240" r="22" fill="#f1c8a0" />
      </g>
    </Svg>
  );
}

/* ---------- Soft Cartoon — bright space / rocket ---------- */
function SoftCover() {
  return (
    <Svg>
      <defs>
        <linearGradient id="sc-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1b1f4a" />
          <stop offset="1" stopColor="#3b3f8c" />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill="url(#sc-sky)" />
      {/* stars */}
      <g fill="#fff">
        {Array.from({ length: 30 }).map((_, i) => (
          <circle key={i} cx={(i * 53) % 400} cy={(i * 31) % 480} r={(i % 3) + 1} opacity="0.85" />
        ))}
      </g>
      {/* planet */}
      <circle cx="80" cy="120" r="38" fill="#f5a25d" />
      <ellipse cx="80" cy="125" rx="60" ry="10" fill="#f5a25d" opacity="0.5" />
      {/* rocket */}
      <g transform="translate(180 180)">
        <path d="M20 0 Q40 60 40 130 H0 Q0 60 20 0 Z" fill="#f4f6fb" />
        <circle cx="20" cy="60" r="10" fill="#5dc1f0" />
        <path d="M0 130 L-20 170 L0 160 Z" fill="#e85d5d" />
        <path d="M40 130 L60 170 L40 160 Z" fill="#e85d5d" />
        <path d="M10 160 Q20 200 30 160 Q25 190 20 200 Q15 190 10 160 Z" fill="#fbb040" />
      </g>
      {/* moon */}
      <circle cx="320" cy="380" r="56" fill="#e8e8f5" />
      <circle cx="305" cy="365" r="6" fill="#c9c9dc" />
      <circle cx="335" cy="395" r="9" fill="#c9c9dc" />
    </Svg>
  );
}
function SoftPageA() {
  return (
    <Svg>
      <rect width="400" height="500" fill="#1b1f4a" />
      <g fill="#fff">
        {Array.from({ length: 24 }).map((_, i) => (
          <circle key={i} cx={(i * 71) % 400} cy={(i * 43) % 480} r={(i % 3) + 1} />
        ))}
      </g>
      <circle cx="200" cy="260" r="80" fill="#5dc1f0" />
      <circle cx="180" cy="240" r="14" fill="#1b1f4a" />
      <circle cx="230" cy="240" r="14" fill="#1b1f4a" />
      <path d="M170 290 Q200 310 230 290" stroke="#1b1f4a" strokeWidth="6" fill="none" strokeLinecap="round" />
    </Svg>
  );
}
function SoftPageB() {
  return (
    <Svg>
      <rect width="400" height="500" fill="#2b2f6c" />
      <circle cx="120" cy="380" r="60" fill="#e8e8f5" />
      <g transform="translate(220 200)">
        <path d="M20 0 Q40 60 40 130 H0 Q0 60 20 0 Z" fill="#f4f6fb" />
        <circle cx="20" cy="60" r="10" fill="#5dc1f0" />
      </g>
    </Svg>
  );
}

/* ---------- Watercolor Adventure — tea party / garden ---------- */
function WaterCover() {
  return (
    <Svg>
      <defs>
        <radialGradient id="wc-bg" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#fdf6ee" />
          <stop offset="1" stopColor="#f3d9d9" />
        </radialGradient>
      </defs>
      <rect width="400" height="500" fill="url(#wc-bg)" />
      {/* watercolor washes */}
      <g opacity="0.55">
        <ellipse cx="90" cy="120" rx="120" ry="80" fill="#f7c1c1" />
        <ellipse cx="320" cy="160" rx="140" ry="90" fill="#cfe3c7" />
        <ellipse cx="200" cy="430" rx="220" ry="110" fill="#e7d6f0" />
      </g>
      {/* table */}
      <ellipse cx="200" cy="370" rx="160" ry="30" fill="#d8a98a" />
      <rect x="120" y="370" width="160" height="80" fill="#c2916f" />
      {/* teapot */}
      <g>
        <ellipse cx="170" cy="330" rx="40" ry="28" fill="#f4f0e6" stroke="#a06a5a" strokeWidth="2" />
        <path d="M210 330 Q230 320 234 308" stroke="#a06a5a" strokeWidth="3" fill="none" />
        <rect x="160" y="298" width="20" height="10" fill="#f4f0e6" stroke="#a06a5a" strokeWidth="2" />
        <circle cx="170" cy="295" r="4" fill="#a06a5a" />
      </g>
      {/* cups */}
      <g>
        <ellipse cx="100" cy="358" rx="14" ry="6" fill="#f4f0e6" stroke="#a06a5a" strokeWidth="2" />
        <rect x="86" y="345" width="28" height="14" fill="#f4f0e6" stroke="#a06a5a" strokeWidth="2" />
        <ellipse cx="280" cy="358" rx="14" ry="6" fill="#f4f0e6" stroke="#a06a5a" strokeWidth="2" />
        <rect x="266" y="345" width="28" height="14" fill="#f4f0e6" stroke="#a06a5a" strokeWidth="2" />
      </g>
      {/* flowers */}
      <g>
        <circle cx="60" cy="90" r="10" fill="#e96b8a" />
        <circle cx="340" cy="80" r="12" fill="#f4a261" />
        <circle cx="370" cy="120" r="8" fill="#e96b8a" />
        <circle cx="40" cy="160" r="9" fill="#a06a5a" />
      </g>
    </Svg>
  );
}
function WaterPageA() {
  return (
    <Svg>
      <rect width="400" height="500" fill="#fdf6ee" />
      <ellipse cx="200" cy="250" rx="180" ry="120" fill="#cfe3c7" opacity="0.6" />
      <ellipse cx="200" cy="320" rx="80" ry="50" fill="#f4f0e6" stroke="#a06a5a" strokeWidth="3" />
      <rect x="180" y="280" width="40" height="14" fill="#f4f0e6" stroke="#a06a5a" strokeWidth="3" />
    </Svg>
  );
}
function WaterPageB() {
  return (
    <Svg>
      <rect width="400" height="500" fill="#f3d9d9" />
      <g opacity="0.7">
        <circle cx="100" cy="150" r="40" fill="#e96b8a" />
        <circle cx="300" cy="200" r="50" fill="#f4a261" />
        <circle cx="200" cy="350" r="60" fill="#cfe3c7" />
      </g>
    </Svg>
  );
}

/* ---------- Manga-Inspired — paper dragon adventure ---------- */
function MangaCover() {
  return (
    <Svg>
      <defs>
        <linearGradient id="mg-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f4eee0" />
          <stop offset="1" stopColor="#e9d8b8" />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill="url(#mg-sky)" />
      {/* speed lines */}
      <g stroke="#3a2a1a" strokeWidth="1" opacity="0.25">
        {Array.from({ length: 18 }).map((_, i) => (
          <line key={i} x1="0" y1={i * 28} x2="400" y2={i * 28 + 8} />
        ))}
      </g>
      {/* mountain */}
      <path d="M0 380 L120 220 L200 320 L300 180 L400 360 V500 H0 Z" fill="#6f7c8b" />
      <path d="M0 420 L400 420 V500 H0 Z" fill="#3f4a5a" />
      {/* dragon */}
      <g transform="translate(60 120)" fill="#c83a3a" stroke="#3a1a1a" strokeWidth="3">
        <path d="M0 80 Q60 0 160 40 Q240 70 280 30 Q260 90 200 100 Q140 110 80 130 Q40 140 0 80 Z" />
        <circle cx="260" cy="40" r="6" fill="#fff" stroke="none" />
        <circle cx="260" cy="40" r="3" fill="#3a1a1a" stroke="none" />
      </g>
      {/* fold lines */}
      <g stroke="#3a1a1a" strokeWidth="1.5" opacity="0.6" fill="none">
        <path d="M120 160 L200 200" />
        <path d="M200 200 L280 170" />
      </g>
      {/* child silhouette */}
      <g transform="translate(180 380)">
        <circle cx="14" cy="0" r="14" fill="#f1c8a0" stroke="#3a1a1a" strokeWidth="2" />
        <rect x="2" y="14" width="24" height="32" rx="4" fill="#3a5aa0" stroke="#3a1a1a" strokeWidth="2" />
      </g>
    </Svg>
  );
}
function MangaPageA() {
  return (
    <Svg>
      <rect width="400" height="500" fill="#f4eee0" />
      <g stroke="#3a2a1a" strokeWidth="1" opacity="0.3">
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={i} x1="0" y1={i * 36} x2="400" y2={i * 36 + 12} />
        ))}
      </g>
      <g transform="translate(120 160)" fill="#c83a3a" stroke="#3a1a1a" strokeWidth="3">
        <path d="M0 80 Q60 0 160 40 Q220 70 240 30 Q220 100 160 110 Q90 120 0 80 Z" />
      </g>
    </Svg>
  );
}
function MangaPageB() {
  return (
    <Svg>
      <rect width="400" height="500" fill="#e9d8b8" />
      <path d="M0 360 L160 200 L260 320 L400 220 V500 H0 Z" fill="#6f7c8b" />
      <g transform="translate(180 350)">
        <circle cx="14" cy="0" r="16" fill="#f1c8a0" stroke="#3a1a1a" strokeWidth="2" />
        <rect x="0" y="16" width="28" height="36" rx="4" fill="#3a5aa0" stroke="#3a1a1a" strokeWidth="2" />
      </g>
    </Svg>
  );
}

const SCENES: Record<ArtStyleKey, Record<Variant, () => JSX.Element>> = {
  classic_storybook: { cover: ClassicCover, "page-a": ClassicPageA, "page-b": ClassicPageB },
  soft_cartoon: { cover: SoftCover, "page-a": SoftPageA, "page-b": SoftPageB },
  watercolor_adventure: { cover: WaterCover, "page-a": WaterPageA, "page-b": WaterPageB },
  manga_inspired: { cover: MangaCover, "page-a": MangaPageA, "page-b": MangaPageB },
};
