import type { Node } from 'postcss';

export declare const FORCED_COLORS_FEATURE: RegExp;

export declare function ancestorMediaQueries(node: Node): string[];

export declare function isUnderForcedColors(node: Node): boolean;
