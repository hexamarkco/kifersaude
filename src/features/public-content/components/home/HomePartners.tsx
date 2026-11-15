import { useId, useState, type CSSProperties } from "react";
import { Pause, Play } from "lucide-react";
import { IconButton, Image, Text, TextLink } from "../../../../design-system";
import { getPartnerLogoLayout, homePartners } from "../../domain/homePartners";

export default function HomePartners({ onQuote }: { onQuote: () => void }) {
  const [paused, setPaused] = useState(false);
  const id = useId();
  const logos = (duplicate: boolean) =>
    homePartners.map((partner) => {
      const frame = getPartnerLogoLayout(partner);
      const style = {
        "--logo-width": `${frame.width}px`,
        "--logo-height": `${frame.height}px`,
        "--logo-image-width": `${frame.imageWidth}px`,
        "--logo-image-height": `${frame.imageHeight}px`,
        "--logo-left": `${frame.left}px`,
        "--logo-top": `${frame.top}px`,
      } as CSSProperties;
      return (
        <TextLink
          key={partner.label}
          className="logo-item"
          href="#cotacao"
          aria-label={`Cotar ${partner.label}`}
          tabIndex={duplicate ? -1 : undefined}
          onClick={(event) => {
            event.preventDefault();
            onQuote();
          }}
        >
          <span
            className={`logo-crop${partner.variant ? ` logo-${partner.variant}` : ""}`}
            style={style}
          >
            <Image
              src={partner.src}
              alt={partner.label}
              width={partner.size[0]}
              height={partner.size[1]}
            loading="eager"
              draggable={false}
            />
          </span>
        </TextLink>
      );
    });
  return (
    <section
      className="partners"
      id="operadoras"
      aria-label="Operadoras de planos de saúde"
    >
      <div className="wrap partner-line">
        <Text as="div" className="partner-copy">
          <strong>Mais opções. Mais clareza.</strong>Operadoras que comparamos
          para o seu perfil.
        </Text>
        <div className={`partner-carousel${paused ? " is-paused" : ""}`}>
          <div
            className="logos"
            id={id}
            role="region"
            aria-label="Operadoras que comparamos"
          >
            <div className="logo-track">
              <div className="logo-group">{logos(false)}</div>
              <div className="logo-group" aria-hidden="true">
                {logos(true)}
              </div>
            </div>
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            className="logo-motion-toggle"
            aria-label={
              paused
                ? "Retomar rolagem das operadoras"
                : "Pausar rolagem das operadoras"
            }
            aria-controls={id}
            aria-pressed={paused}
            onClick={() => setPaused((current) => !current)}
          >
            {paused ? (
              <Play aria-hidden="true" />
            ) : (
              <Pause aria-hidden="true" />
            )}
          </IconButton>
        </div>
      </div>
    </section>
  );
}
