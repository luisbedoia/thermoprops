import { FormEvent, RefObject, useEffect } from "react";
import type { InputInfo, InputName } from "@luisbedoia/coolprop-rs-wasm";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import {
  fromSI,
  getDisplayUnit,
  propertyLabel,
  propertyToPlain,
  quantityValue,
  resolveUnitSystem,
  unitToPlain,
} from "../lib";
import type { UnitSystem } from "../lib";
import type { ComputedState } from "./types";

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
  propertyOptions1: readonly InputInfo[];
  propertyOptions2: readonly InputInfo[];
  formError: string | null;
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
  propertyOptions1,
  propertyOptions2,
  formError,
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
            Add thermodynamic state
          </h2>
          <p className="state-modal__subtitle">
            Choose two independent properties to evaluate a new point on the
            diagram.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="state-modal__close"
          onClick={onClose}
          aria-label="Close add state dialog"
        >
          Close
        </Button>
      </header>

      <form className="state-modal__form" onSubmit={onSubmit}>
        <div className="state-modal__row">
          <div className="field">
            <label htmlFor="property1">Property A</label>
            <select
              id="property1"
              value={formState.property1}
              onChange={(event) =>
                onFormChange("property1", event.target.value)
              }
            >
              {propertyOptions1.map((property) => (
                <PropertyOption
                  key={property.name}
                  property={property}
                  units={system}
                />
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="value1">Value</label>
            <div className="field__input-wrap">
              <button
                type="button"
                className="field__sign"
                aria-label="Toggle sign"
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
                placeholder="e.g. 300"
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

        <div className="state-modal__row">
          <div className="field">
            <label htmlFor="property2">Property B</label>
            <select
              id="property2"
              value={formState.property2}
              onChange={(event) =>
                onFormChange("property2", event.target.value)
              }
            >
              {propertyOptions2.map((property) => (
                <PropertyOption
                  key={property.name}
                  property={property}
                  units={system}
                />
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="value2">Value</label>
            <div className="field__input-wrap">
              <button
                type="button"
                className="field__sign"
                aria-label="Toggle sign"
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
                placeholder="e.g. 101325"
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

        {formError ? <p className="state-modal__error">{formError}</p> : null}

        <div className="state-modal__actions">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add to workspace</Button>
        </div>
      </form>
    </Modal>
  );
}

type PropertyOptionProps = {
  property: InputInfo;
  units: UnitSystem;
};

function PropertyOption({ property, units }: PropertyOptionProps) {
  const symbol = propertyToPlain(property.name);
  const unit = unitToPlain(getDisplayUnit(property.name, units));
  const label = propertyLabel(property.name);
  return (
    <option value={property.name} title={label}>
      {symbol}
      {unit ? ` · ${unit}` : ""}
      {label ? ` — ${label}` : ""}
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

  const symbol = propertyToPlain(propertyName);
  const unitLabel = unitToPlain(getDisplayUnit(propertyName, units));

  return (
    <select
      className="field__from-state"
      value=""
      aria-label={`Use ${symbol} from existing state`}
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
        Use {symbol} from existing state…
      </option>
      {candidates.map(({ state, si }) => {
        const display = PICKER_NUMBER_FORMAT.format(
          fromSI(propertyName, si, units),
        );
        return (
          <option
            key={state.definition.id}
            value={state.definition.id}
          >
            {state.definition.label}: {symbol} = {display}
            {unitLabel ? ` ${unitLabel}` : ""}
          </option>
        );
      })}
    </select>
  );
}
