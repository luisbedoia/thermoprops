import { FormEvent, RefObject, useEffect } from "react";
import { ArrowUpDown, X } from "lucide-react";
import { coolprop } from "../coolprop";
import type { InputInfo, InputName } from "@luisbedoia/coolprop-rs-wasm";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { quantityInfo, quantityValue } from "../lib/quantities";
import { fromSI, getDisplayUnit, resolveUnitSystem } from "../lib/units";
import type { UnitSystem } from "../lib/units";
import { unitToPlain } from "../lib/unitsFormat";
import type { ComputedState } from "./types";
import type { Replacement } from "./pairs";
import { tr } from "../i18n";

const PROPERTY_A = tr("Property A", "Propiedad A");
const PROPERTY_B = tr("Property B", "Propiedad B");
const VALUE = tr("Value", "Valor");
const TOGGLE_SIGN = tr("Toggle sign", "Cambiar el signo");
const SWAP = tr(
  "Swap properties A and B",
  "Intercambiar las propiedades A y B",
);

const PICKER_NUMBER_FORMAT = new Intl.NumberFormat(undefined, {
  maximumSignificantDigits: 6,
});

// Mobile numeric keyboards (inputMode="decimal") don't expose a minus key, so
// we surface a ± button. Toggles the sign of whatever the user has typed.
function toggleSign(value: string): string {
  if (!value || value === "-") return value === "-" ? "" : "-";
  return value.startsWith("-") ? value.slice(1) : "-" + value;
}

type StateModalFormState = {
  property1: InputName;
  property2: InputName;
  value1: string;
  value2: string;
};

type StateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  formState: StateModalFormState;
  onFormChange: (field: keyof StateModalFormState, value: string) => void;
  /** Swaps properties A and B, values included. */
  onSwap: () => void;
  /** The property the form last changed on its own, if any. */
  replacement: Replacement | null;
  formError: string | null;
  /** The worker is checking the state: the submit button waits. */
  solving: boolean;
  firstValueRef: RefObject<HTMLInputElement | null>;
  units: string;
  existingStates: ComputedState[];
};

export function StateModal({
  isOpen,
  onClose,
  onSubmit,
  formState,
  onFormChange,
  onSwap,
  replacement,
  formError,
  solving,
  firstValueRef,
  units,
  existingStates,
}: StateModalProps) {
  const system: UnitSystem = resolveUnitSystem(units);
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      firstValueRef.current?.focus();
    }, 50);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [isOpen, firstValueRef]);

  if (!isOpen) {
    return null;
  }

  // Every input in both selectors: picking one never needs a detour. A pair
  // CoolProp cannot solve is fixed by changing the other input (see pairs.ts).
  const inputs = coolprop().inputs();
  const info = (name: InputName) => inputs.find((i) => i.name === name)!;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledby="state-modal-title"
      className="state-modal"
      contentClassName="state-modal__dialog"
    >
      <header className="state-modal__header">
        <div>
          <h2 id="state-modal-title" className="state-modal__title">
            {tr("Add thermodynamic state", "Agregar estado termodinámico")}
          </h2>
          <p className="state-modal__subtitle">
            {tr(
              "Choose two independent properties to evaluate a new point on the diagram.",
              "Elige dos propiedades independientes para evaluar un nuevo punto en el diagrama.",
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="state-modal__close"
          onClick={onClose}
          aria-label={tr(
            "Close add state dialog",
            "Cerrar el cuadro para agregar estado",
          )}
        >
          <X />
          <span className="state-modal__close-text">
            {tr("Close", "Cerrar")}
          </span>
        </Button>
      </header>

      <form className="state-modal__form" onSubmit={onSubmit}>
        <div className="state-modal__row">
          <div className="field">
            <label htmlFor="property1">{PROPERTY_A}</label>
            <select
              id="property1"
              value={formState.property1}
              onChange={(event) =>
                onFormChange("property1", event.target.value)
              }
            >
              {inputs.map((property) => (
                <PropertyOption
                  key={property.name}
                  property={property}
                  units={system}
                />
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="value1">{VALUE}</label>
            <div className="field__input-wrap">
              <button
                type="button"
                className="field__sign"
                aria-label={TOGGLE_SIGN}
                onClick={() =>
                  onFormChange("value1", toggleSign(formState.value1))
                }
              >
                ±
              </button>
              <input
                id="value1"
                ref={firstValueRef}
                type="text"
                inputMode="decimal"
                value={formState.value1}
                onChange={(event) => onFormChange("value1", event.target.value)}
                placeholder={valueHint(info(formState.property1), system)}
                required
              />
            </div>
            <FromStatePicker
              propertyName={formState.property1}
              states={existingStates}
              units={system}
              onPick={(value) => onFormChange("value1", value)}
            />
          </div>
        </div>

        <div className="state-modal__swap">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSwap}
            aria-label={SWAP}
            title={SWAP}
          >
            <ArrowUpDown />
            {tr("Swap", "Intercambiar")}
          </Button>
        </div>

        <div className="state-modal__row">
          <div className="field">
            <label htmlFor="property2">{PROPERTY_B}</label>
            <select
              id="property2"
              value={formState.property2}
              onChange={(event) =>
                onFormChange("property2", event.target.value)
              }
            >
              {inputs.map((property) => (
                <PropertyOption
                  key={property.name}
                  property={property}
                  units={system}
                />
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="value2">{VALUE}</label>
            <div className="field__input-wrap">
              <button
                type="button"
                className="field__sign"
                aria-label={TOGGLE_SIGN}
                onClick={() =>
                  onFormChange("value2", toggleSign(formState.value2))
                }
              >
                ±
              </button>
              <input
                id="value2"
                type="text"
                inputMode="decimal"
                value={formState.value2}
                onChange={(event) => onFormChange("value2", event.target.value)}
                placeholder={valueHint(info(formState.property2), system)}
                required
              />
            </div>
            <FromStatePicker
              propertyName={formState.property2}
              states={existingStates}
              units={system}
              onPick={(value) => onFormChange("value2", value)}
            />
          </div>
        </div>

        {replacement ? (
          <p className="state-modal__notice" role="status">
            {replacementNotice(replacement, formState, info)}
          </p>
        ) : null}

        {formError ? <p className="state-modal__error">{formError}</p> : null}

        <div className="state-modal__actions">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tr("Cancel", "Cancelar")}
          </Button>
          <Button type="submit" disabled={solving}>
            {solving
              ? tr("Solving…", "Resolviendo…")
              : tr("Add to workspace", "Agregar al espacio de trabajo")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** What a value field expects: its bounds ("0 – 1") or its unit ("kPa"). */
function valueHint(input: InputInfo, units: UnitSystem): string {
  if (input.min !== null && input.max !== null)
    return `${input.min} – ${input.max}`;
  const unit = unitToPlain(getDisplayUnit(input.name, units));
  return unit ? tr(`in ${unit}`, `en ${unit}`) : "";
}

/** "Property B changed from h to p: T and h do not fix a state together." */
function replacementNotice(
  { slot, from, to }: Replacement,
  form: StateModalFormState,
  info: (name: InputName) => InputInfo,
): string {
  const picked = slot === "property1" ? form.property2 : form.property1;
  const label = slot === "property1" ? PROPERTY_A : PROPERTY_B;
  const [p, f, n] = [info(picked).symbol, info(from).symbol, info(to).symbol];
  return tr(
    `${label} changed from ${f} to ${n}: ${p} and ${f} do not fix a state together.`,
    `${label} cambió de ${f} a ${n}: ${p} y ${f} no fijan juntos un estado.`,
  );
}

type PropertyOptionProps = {
  property: InputInfo;
  units: UnitSystem;
};

function PropertyOption({ property, units }: PropertyOptionProps) {
  const unit = unitToPlain(getDisplayUnit(property.name, units));
  return (
    <option value={property.name} title={property.description}>
      {property.symbol}
      {unit ? ` · ${unit}` : ""}
      {` — ${property.description}`}
    </option>
  );
}

type FromStatePickerProps = {
  propertyName: InputName;
  states: ComputedState[];
  units: UnitSystem;
  onPick: (value: string) => void;
};

function FromStatePicker({
  propertyName,
  states,
  units,
  onPick,
}: FromStatePickerProps) {
  const candidates = states.flatMap((state) => {
    const si = state.state ? quantityValue(state.state, propertyName) : null;
    return si != null && Number.isFinite(si) ? [{ state, si }] : [];
  });

  if (candidates.length === 0) return null;

  const { symbol } = quantityInfo(propertyName);
  const unitLabel = unitToPlain(getDisplayUnit(propertyName, units));

  return (
    <select
      className="field__from-state"
      value=""
      aria-label={tr(
        `Use ${symbol} from existing state`,
        `Usar ${symbol} de un estado existente`,
      )}
      onChange={(event) => {
        const id = event.target.value;
        if (!id) return;
        const match = candidates.find((c) => c.state.definition.id === id);
        if (!match) return;
        const display = fromSI(propertyName, match.si, units);
        onPick(String(display));
      }}
    >
      <option value="" disabled>
        {tr(
          `Use ${symbol} from existing state…`,
          `Usar ${symbol} de un estado existente…`,
        )}
      </option>
      {candidates.map(({ state, si }) => {
        const display = PICKER_NUMBER_FORMAT.format(
          fromSI(propertyName, si, units),
        );
        return (
          <option key={state.definition.id} value={state.definition.id}>
            {state.definition.label}: {symbol} = {display}
            {unitLabel ? ` ${unitLabel}` : ""}
          </option>
        );
      })}
    </select>
  );
}
