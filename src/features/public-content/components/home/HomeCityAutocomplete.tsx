import { useRef, useState, type InputHTMLAttributes } from "react";
import {
  DropdownOption,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Text,
} from "../../../../design-system";
import { useCitySuggestions } from "../../hooks/useCitySuggestions";
import type { Municipality } from "../../domain/municipalities";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "size"
> & { value: string; onChange: (city: string) => void };

export default function HomeCityAutocomplete({
  id = "quote-city",
  value,
  onChange,
  ...props
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const { results, total, status, load } = useCitySuggestions(value);
  const selectedIndex = active < results.length ? active : -1;
  const choose = (city: Municipality) => {
    onChange(`${city.name} — ${city.uf}`);
    setOpen(false);
    setActive(-1);
  };
  const reveal = () => {
    setOpen(true);
    void load();
  };
  const move = (direction: 1 | -1) => {
    reveal();
    if (!results.length) return;
    const next =
      selectedIndex < 0
        ? direction === 1
          ? 0
          : results.length - 1
        : (selectedIndex + direction + results.length) % results.length;
    setActive(next);
    menu.current
      ?.querySelector(`#${id}-option-${next}`)
      ?.scrollIntoView({ block: "nearest" });
  };
  const hint =
    status === "error"
      ? "Não foi possível carregar as sugestões. Você pode informar cidade e UF manualmente."
      : status === "loading"
        ? "Carregando cidades…"
        : !value.trim()
          ? "Digite a cidade, a UF ou o nome do estado."
          : total === 0
            ? "Nenhuma cidade encontrada. Confira o nome ou a UF."
            : total > 50
              ? `${total} cidades encontradas. Continue digitando para refinar.`
              : `${total} ${total === 1 ? "cidade encontrada" : "cidades encontradas"}.`;

  return (
    <Popover open={open && !props.disabled} onOpenChange={setOpen}>
      <PopoverTrigger
        className="landing-city-trigger"
        onClick={(event) => event.preventDefault()}
      >
        <Input
          {...props}
          id={id}
          ref={input}
          size="lg"
          value={value}
          role="combobox"
          aria-label="Em qual cidade?"
          autoComplete="off"
          placeholder="Digite sua cidade ou UF"
          aria-autocomplete="list"
          aria-expanded={open && !props.disabled}
          aria-controls={open ? `${id}-list` : undefined}
          aria-activedescendant={
            open && selectedIndex >= 0
              ? `${id}-option-${selectedIndex}`
              : undefined
          }
          onFocus={reveal}
          onClick={reveal}
          onChange={(event) => {
            onChange(event.target.value);
            setActive(-1);
            reveal();
          }}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              move(event.key === "ArrowDown" ? 1 : -1);
            }
            if (event.key === "Home" && open && results.length) {
              event.preventDefault();
              setActive(0);
              menu.current?.scrollTo({ top: 0 });
            }
            if (event.key === "End" && open && results.length) {
              event.preventDefault();
              setActive(results.length - 1);
              menu.current
                ?.querySelector(`#${id}-option-${results.length - 1}`)
                ?.scrollIntoView({ block: "nearest" });
            }
            if (event.key === "Enter" && open) {
              event.preventDefault();
              if (selectedIndex >= 0) choose(results[selectedIndex]);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              setActive(-1);
            }
          }}
        />
      </PopoverTrigger>
      <PopoverContent
        className="kds-dropdown-menu landing-city-options"
        aria-label="Sugestões de cidade"
      >
        <div
          ref={menu}
          className="landing-city-results"
          id={`${id}-list`}
          role="listbox"
          aria-label="Cidades do Brasil"
        >
          {results.map((city, index) => (
            <DropdownOption
              key={city.id}
              id={`${id}-option-${index}`}
              tabIndex={-1}
              aria-selected={selectedIndex === index}
              className={selectedIndex === index ? "is-highlighted" : undefined}
              onPointerDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(city)}
            >
              {city.name} — {city.uf}
            </DropdownOption>
          ))}
        </div>
        <Text className="landing-city-hint" role="status">
          {hint}
        </Text>
      </PopoverContent>
    </Popover>
  );
}
