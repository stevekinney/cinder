export type ThresholdKind = 'timeout' | 'timeout-minutes' | 'retries' | 'slow';

export type ThresholdCandidate = {
  baselineRenderedValue?: string;
  baselineValue?: number;
  kind: ThresholdKind;
  identity: string;
  label: string;
  effectiveValue: number;
  value: number;
  renderedValue: string;
  occurrenceIndex?: number;
  lineNumber: number;
  line: string;
};

export type TimeoutIncreaseViolation = {
  filePath: string;
  hunkHeader: string;
  old: ThresholdCandidate;
  new: ThresholdCandidate;
};

export type DiffHunk = {
  filePath: string;
  fileDeleted: boolean;
  oldFilePath: string;
  hunkHeader: string;
  removed: ThresholdCandidate[];
  added: ThresholdCandidate[];
  oldSource: Array<{ changed: boolean; line: string; lineNumber: number }>;
  newSource: Array<{ changed: boolean; line: string; lineNumber: number }>;
};
