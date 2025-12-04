import { FormEvent, RefObject, useEffect } from "react";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import type { Property } from "../lib";

type StateModalFormState = {
  property1: string;
  property2: string;
  value1: string;
  value2: string;
};

type StateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  formState: StateModalFormState;
  onFormChange: (field: keyof StateModalFormState, value: string) => void;
  propertyOptions1: Property[];
  propertyOptions2: Property[];
  formError: string | null;
  firstValueRef: RefObject<HTMLInputElement | null>;
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
}: StateModalProps) {
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
                <PropertyOption key={property.name} property={property} />
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="value1">Value</label>
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
                <PropertyOption key={property.name} property={property} />
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="value2">Value</label>
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
  property: Property;
};

function PropertyOption({ property }: PropertyOptionProps) {
  return (
    <option value={property.name}>
      {property.name} · {property.unit}
    </option>
  );
}
