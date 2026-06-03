import { createContext } from 'svelte';

import type { DropdownContext } from './dropdown.types.ts';

export type { DropdownContext };

const [getDropdownContextStrict, setDropdownContext] = createContext<DropdownContext>();
export { setDropdownContext };
export const getDropdownContext = getDropdownContextStrict;

const [getDropdownRegisterStrict, setDropdownRegister] =
  createContext<(element: HTMLElement | null) => void>();
export { setDropdownRegister };
export const getDropdownRegister = getDropdownRegisterStrict;

const [getDropdownRegisterTriggerStrict, setDropdownRegisterTrigger] =
  createContext<(element: HTMLElement | null) => void>();
export { setDropdownRegisterTrigger };
export const getDropdownRegisterTrigger = getDropdownRegisterTriggerStrict;

const [getDropdownSetOpenStrict, setDropdownSetOpen] = createContext<(nextOpen: boolean) => void>();
export { setDropdownSetOpen };
export const getDropdownSetOpen = getDropdownSetOpenStrict;
