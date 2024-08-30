import React, {useCallback} from 'react';
import styled from 'styled-components';

const InputContainer = styled.div`
  position: relative;
  width: 100%;

  &:last-child {
    margin-bottom: 20px;
  }

  > * {
    vertical-align: middle;
    white-space: nowrap;
  }
  label {
    display: inline-block;
    width: 40%;
    margin-right: 10%;
    margin-top: 2px;
    margin-bottom: 2px;
  }
  input,
  a,
  button {
    background: var(--ifm-color-white);
    font-size: 0.9em;
    text-transform: none;
    text-overflow: ellipsis;
    overflow: hidden;
    display: inline-block;
    padding: 0 4px;
    margin: 0;
    width: 50%;
    height: 20px;
    line-height: 1.833;
    text-align: left;
  }
  button {
    color: initial;
  }
  button:disabled {
    color: var(--ifm-color-gray-500);
    cursor: default;
    background: var(--ifm-color-gray-300);
  }
  input {
    border: solid 1px var(--ifm-color-gray-500);

    &:disabled {
      background: var(--ifm-color-gray-300);
    }
    &[type='checkbox'] {
      height: auto;
    }
  }

  .tooltip {
    left: 50%;
    top: 24px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms;
  }
  &:hover .tooltip {
    opacity: 1;
  }
`;

function noop() {}

type InputProps<ValueT> = {
  type: string;
  name: string;
  value: ValueT;
  displayName: string;
  onChange?: (pname: string, pvalue: ValueT) => void;
  format?: (pvalue: ValueT) => string;
};

type AnyInputProps =
  | RangeInputProps
  | CheckboxInputProps
  | LinkProps
  | SelectProps
  | BlobInputProps;

type RangeInputProps = InputProps<number> & {
  type: 'range';
  min?: number;
  max?: number;
};
/** Renders a stateless slider */
function RangeInput({
  name,
  min,
  max,
  value,
  displayName,
  format = String,
  onChange = noop
}: RangeInputProps) {
  const onInput = useCallback(
    (evt) => {
      let newValue = Number(evt.target.value);
      if (min !== undefined) {
        newValue = Math.max(min, newValue);
      }
      if (max !== undefined) {
        newValue = Math.min(max, newValue);
      }
      onChange(name, newValue);
    },
    [min, max, onChange]
  );

  return (
    <InputContainer>
      <label>{displayName}</label>
      <div className="tooltip">
        {displayName}: {format(value)}
      </div>
      <input type="range" min={min} max={max} value={value} onChange={onInput} />
    </InputContainer>
  );
}

type CheckboxInputProps = InputProps<boolean> & {
  type: 'checkbox';
};
/** Renders a stateless checkbox */
function Checkbox({
  name,
  value,
  displayName,
  format = String,
  onChange = noop
}: CheckboxInputProps) {
  const onInput = useCallback(
    (evt) => {
      const newValue = evt.target.checked;
      onChange(name, newValue);
    },
    [onChange]
  );

  return (
    <InputContainer>
      <label>{displayName}</label>
      <div className="tooltip">
        {displayName}: {format(value)}
      </div>
      <input type="checkbox" checked={value} onChange={onInput} />
    </InputContainer>
  );
}

type LinkProps = {
  type: 'link';
  displayName: string;
  value: string;
  format?: (pvalue: string) => string;
};
/** Renders a hyperlink */
function Link({displayName, value, format = String}: LinkProps) {
  return (
    <div className="input">
      <label>{displayName}</label>
      <a href={value} target="_new">
        {format(value)}
      </a>
    </div>
  );
}

type SelectProps<ValueT = any> = InputProps<ValueT> & {
  type: 'select';
  options: ValueT[];
};
/** Renders a dropdown */
function Select<ValueT extends number | string>({
  name,
  displayName,
  value,
  format = String,
  options,
  onChange = noop
}: SelectProps<ValueT>) {
  const onInput = useCallback(
    (evt) => {
      onChange(name, evt.target.value);
    },
    [onChange]
  );

  return (
    <div className="input">
      <label>{displayName}</label>
      <select onChange={onInput} value={value}>
        {options.map((v, i) => (
          <option key={i} value={v}>
            {format(v)}
          </option>
        ))}
      </select>
    </div>
  );
}

type BlobInputProps = InputProps<object> & {
  type: 'function' | 'json';
  initalValue?: object;
};
/** Render a blob input */
function BlobInput({
  name,
  displayName,
  value,
  initalValue,
  format = String,
  onChange = noop
}: BlobInputProps) {
  const reset = useCallback(() => {
    if (initalValue !== undefined) {
      onChange(name, initalValue);
    }
  }, [initalValue, onChange]);

  const editable = Boolean(initalValue);
  return (
    <div className="input">
      <label>{displayName}</label>
      <button type="reset" disabled={!editable} onClick={reset}>
        {format(value)}
      </button>
    </div>
  );
}

type GenericInputProps = InputProps<number | string> & {
  type: 'color' | 'date' | 'text' | 'number';
  [key: string]: number | string;
};

function GenericInput({
  name,
  value,
  displayName,
  format = String,
  onChange = noop,
  ...inputProps
}: GenericInputProps) {
  const onInput = useCallback(
    (evt) => {
      onChange(name, evt.target.value);
    },
    [onChange]
  );

  return (
    <InputContainer>
      <label>{displayName}</label>
      <div className="tooltip">
        {displayName}: {format(value)}
      </div>
      <input {...inputProps} value={value} onChange={onInput} />
    </InputContainer>
  );
}

export function Input(props: AnyInputProps) {
  switch (props.type) {
    case 'link':
      return Link(props);

    case 'function':
    case 'json':
      return BlobInput(props);

    case 'select':
      return Select(props);

    case 'checkbox':
      return Checkbox(props);

    case 'range':
      return RangeInput(props);

    default:
      return GenericInput(props);
  }
}
