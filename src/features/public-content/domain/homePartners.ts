type Partner = {
  src: string;
  label: string;
  size: readonly [number, number];
  bounds: readonly [number, number, number, number];
  opticalScale: number;
  variant?: "medsenior" | "notredame";
};

// Optical bounds preserve original artwork. MedSênior is measured by the letters,
// while the leaves remain visible. Official sources: public/images/operators/sources.json.
export const homePartners: readonly Partner[] = [
  {
    src: "/amil-logo-1-2.png",
    label: "Amil",
    size: [4094, 1458],
    bounds: [0, 0, 4094, 1458],
    opticalScale: 1,
  },
  {
    src: "/bradesco-saude-logo-1-1.png",
    label: "Bradesco Saúde",
    size: [4096, 1461],
    bounds: [0, 0, 4096, 1461],
    opticalScale: 1.08,
  },
  {
    src: "/sulamerica-saude-logo.png",
    label: "SulAmérica Saúde",
    size: [4096, 1535],
    bounds: [0, 0, 4096, 1535],
    opticalScale: 1.06,
  },
  {
    src: "/porto-logo.png",
    label: "Porto Saúde",
    size: [4096, 956],
    bounds: [0, 0, 4096, 956],
    opticalScale: 0.92,
  },
  {
    src: "/assim-saude-logo.png",
    label: "Assim Saúde",
    size: [4096, 1283],
    bounds: [0, 0, 4096, 1283],
    opticalScale: 1,
  },
  {
    src: "/images/operators/unimed-brasil.png",
    label: "Unimed do Brasil",
    size: [164, 59],
    bounds: [0, 18, 164, 42],
    opticalScale: 1,
  },
  {
    src: "/images/operators/medsenior.png",
    label: "MedSênior",
    size: [2560, 885],
    bounds: [0, 480, 2160, 885],
    opticalScale: 1,
    variant: "medsenior",
  },
  {
    src: "/images/operators/hapvida.png",
    label: "Hapvida",
    size: [243, 46],
    bounds: [36, 4, 206, 42],
    opticalScale: 1.04,
  },
  {
    src: "/images/operators/notredame-saude.svg",
    label: "NotreDame Saúde",
    size: [1366.05, 309.23],
    bounds: [0, 0, 1366.05, 309.23],
    opticalScale: 1.06,
    variant: "notredame",
  },
  {
    src: "/images/operators/leve.svg",
    label: "Leve Saúde",
    size: [92, 37],
    bounds: [0, 0, 92, 37],
    opticalScale: 1.03,
  },
  {
    src: "/images/operators/klini.webp",
    label: "Klini Saúde",
    size: [214, 117],
    bounds: [0, 0, 214, 117],
    opticalScale: 1.27,
  },
];

export function getPartnerLogoLayout(partner: Partner) {
  const [x, y, right, bottom] = partner.bounds;
  const width = right - x,
    height = bottom - y;
  const scale = Math.min(132 / width, 38 / height) * partner.opticalScale;
  return {
    width: width * scale,
    height: height * scale,
    imageWidth: partner.size[0] * scale,
    imageHeight: partner.size[1] * scale,
    left: -x * scale,
    top: -y * scale,
  };
}
