export type OpaqueObjectValue = {
  label: string;
};

export type OpaqueObjectProps = {
  /** Untagged object should not be widened to a permissive object schema. */
  value: OpaqueObjectValue;
  /** Untagged object arrays should stay unsupported unless their item type is explicit. */
  values: OpaqueObjectValue[];
};
