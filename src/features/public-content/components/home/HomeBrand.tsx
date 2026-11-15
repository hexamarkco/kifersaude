import PublicBrandMark from "../../../../components/public/PublicBrandMark";

/** Official KS symbol with its approved, compact horizontal signature. */
export default function HomeBrand() {
  return (
    <span className="wordmark brand-ks" role="img" aria-label="Kifer Saúde">
      <PublicBrandMark className="ks-logo" />
      <span className="brand-name" aria-hidden="true">
        <strong>Kifer</strong>
        <small>Saúde</small>
      </span>
    </span>
  );
}
