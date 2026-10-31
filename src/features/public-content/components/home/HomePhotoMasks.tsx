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
          <path d="M.55 0H1V1H0V.62C.07 .45 .08 .07 .55 0Z" />
        </clipPath>
        <clipPath id="home-photo-trust" clipPathUnits="objectBoundingBox">
          <path d="M0 .43C0 .19 .14 0 .34 0H.69C.87 0 1 .17 1 .41V.91Q1 1 .94 1H0Z" />
        </clipPath>
        <clipPath id="home-photo-audience" clipPathUnits="objectBoundingBox">
          <path d="M.49 0H1V.72C.83 .84 .66 .96 .48 .95C.22 .94 .01 .7 0 .48C-.01 .26 .22 .01 .49 0Z" />
        </clipPath>
        <clipPath id="home-photo-audience-mobile" clipPathUnits="objectBoundingBox">
          <path d="M.57 0H.83C.95 0 1 .12 1 .3V.78C.82 .86 .62 1 .37 1C.18 1 .02 .89 .035 .68C.05 .43 .29 .04 .57 0Z" />
        </clipPath>
        <clipPath id="home-photo-about" clipPathUnits="objectBoundingBox">
          <path d="M0 0H.9V.74C.9 .85 .96 .92 1 1H0Z" />
        </clipPath>
        <clipPath id="home-photo-about-mobile" clipPathUnits="objectBoundingBox">
          <path d="M0 0H1V.75C.95 .99 .84 1 .62 .965C.38 .935 .17 .91 0 .62Z" />
        </clipPath>
        <clipPath id="home-photo-quote" clipPathUnits="objectBoundingBox">
          <path d="M.28 0H1V1C.8 .92 .7 .8 .4 .77C.1 .74 .04 .57 .11 .39C-.09 .25 .03 .03 .28 0Z" />
        </clipPath>
        <clipPath id="home-photo-whatsapp" clipPathUnits="objectBoundingBox">
          <path d="M0 .31C.03 .1 .18 0 .43 0C.7 0 .82 .13 1 .03V1H0Z" />
        </clipPath>
      </defs>
    </svg>
  );
}
