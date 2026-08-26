/** DTCG 2025.10 token names may not contain path or reference delimiters. */
export type TokenName = string;

export type ColorValue = {
  colorSpace: string;
  components: Array<number | 'none'>;
  alpha?: number | 'none';
  hex?: string;
};

export type DimensionValue = { value: number; unit: 'px' | 'rem' };
export type DurationValue = { value: number; unit: 'ms' | 's' };
export type StrokeStyleValue =
  | string
  | { dashArray: DimensionValue[]; lineCap: 'round' | 'butt' | 'square' };
export type BorderValue = {
  color: ColorValue | string;
  width: DimensionValue | string;
  style: StrokeStyleValue | string;
};
export type TransitionValue = {
  duration: DurationValue | string;
  delay: DurationValue | string;
  timingFunction: [number, number, number, number] | string;
};
export type ShadowValue = {
  color: ColorValue | string;
  offsetX: DimensionValue | string;
  offsetY: DimensionValue | string;
  blur: DimensionValue | string;
  spread: DimensionValue | string;
  inset?: boolean;
};
export type GradientStop = { color: ColorValue | string; position: number | string };
export type TypographyValue = {
  fontFamily: string[] | string;
  fontSize: DimensionValue | string;
  fontWeight: number | string;
  letterSpacing: DimensionValue | string;
  lineHeight: number | DimensionValue | string;
};

export type TokenValue =
  | ColorValue
  | DimensionValue
  | DurationValue
  | StrokeStyleValue
  | BorderValue
  | TransitionValue
  | ShadowValue
  | GradientStop[]
  | TypographyValue
  | string
  | string[]
  | number
  | [number, number, number, number];

export type TokenType =
  | 'color'
  | 'dimension'
  | 'fontFamily'
  | 'fontWeight'
  | 'duration'
  | 'cubicBezier'
  | 'number'
  | 'strokeStyle'
  | 'border'
  | 'transition'
  | 'shadow'
  | 'gradient'
  | 'typography';

export type TokenExtensions = Record<string, unknown>;

export type DesignToken = {
  /** Parsed JSON remains unknown until it is validated for the token's $type. */
  $value: unknown;
  $type?: TokenType;
  $description?: string;
  $deprecated?: boolean | string;
  $extensions?: TokenExtensions;
};

export type TokenGroup = {
  $type?: TokenType;
  $description?: string;
  $deprecated?: boolean | string;
  $extensions?: TokenExtensions;
  $root?: DesignToken;
  $extends?: string;
  [name: TokenName]: DesignToken | TokenGroup | string | boolean | TokenExtensions | undefined;
};

export type TokenDocument = TokenGroup & {
  $schema?: string;
};

/**
 * DTCG 2025.10 resolver reference object. Cinder only authors $ref entries
 * (relative file paths for sources, #/sets/<name> or #/modifiers/<name> for
 * resolutionOrder) -- the spec also allows inline set/modifier/token
 * documents in these positions, which Cinder does not use.
 */
export type ResolverReference = { $ref: string };
export type ResolverSet = { sources: ResolverReference[] };
export type ResolverModifier = {
  contexts: Record<string, ResolverReference[]>;
  default?: string;
};
export type ResolverDocument = {
  version: '2025.10';
  sets: Record<string, ResolverSet>;
  modifiers: Record<string, ResolverModifier>;
  resolutionOrder: ResolverReference[];
};

export type ValidationIssue = { path: string; reason: string };

export class TokenValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.reason}`).join('\n'));
    this.name = 'TokenValidationError';
  }
}
