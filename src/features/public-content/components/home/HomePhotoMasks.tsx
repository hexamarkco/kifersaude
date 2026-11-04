/** Section-specific silhouettes, normalized to each composition's box.
 * Only the photograph is clipped; curves and labels remain separate layers.
 */
export default function HomePhotoMasks() {
  return (
    <svg className="home-photo-masks" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="home-photo-hero" clipPathUnits="objectBoundingBox">
          <path d="M.3 0H1V1H0C.04 .82 .21 .65 .2 .43C.19 .23 .22 .1 .3 0Z" />
        </clipPath>
        <clipPath id="home-photo-hero-mobile" clipPathUnits="objectBoundingBox">
          <path d="M.5 0H1V1H0V.64C.025 .39 .16 .06 .5 0Z" />
        </clipPath>
        <clipPath id="home-photo-trust" clipPathUnits="objectBoundingBox">
          <path d="M0 .43C0 .19 .14 0 .34 0H.69C.87 0 1 .17 1 .41V.91Q1 1 .94 1H0Z" />
        </clipPath>
        <clipPath id="home-photo-audience" clipPathUnits="objectBoundingBox">
          <path d="M.455 0H.96Q1 0 1 .04V.69C.84 .81 .64 .965 .455 .95C.195 .93 0 .705 0 .47C0 .255 .22 0 .455 0Z" />
        </clipPath>
        <clipPath id="home-photo-audience-mobile" clipPathUnits="objectBoundingBox">
          <path d="M.58 0H.84C.94 0 1 .1 1 .26V.79C.83 .86 .64 .995 .39 .995C.17 .995 .025 .87 .035 .7C.045 .46 .3 .045 .58 0Z" />
        </clipPath>
        <clipPath id="home-photo-about" clipPathUnits="objectBoundingBox">
          <path d="M0 0H.9V.74C.9 .85 .96 .92 1 1H0Z" />
        </clipPath>
        <clipPath id="home-photo-about-mobile" clipPathUnits="objectBoundingBox">
          <path d="M0 .04C.17 .01 .32 0 .5 0H1V.75C.98 .91 .87 .985 .65 .965C.38 .94 .16 .9 0 .64Z" />
        </clipPath>
      </defs>
    </svg>
  );
}
