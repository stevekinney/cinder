export type PortalTargetInput = HTMLElement | string | null | undefined;

export type PortalAttachmentOptions = {
  target?: PortalTargetInput | (() => PortalTargetInput);
  disabled?: boolean | (() => boolean);
  inheritAttributes?: boolean | (() => boolean);
  explicitAttributes?:
    | {
        dir?: string | null | undefined;
        lang?: string | null | undefined;
        dataTheme?: string | null | undefined;
        theme?: string | null | undefined;
      }
    | (() => {
        dir?: string | null | undefined;
        lang?: string | null | undefined;
        dataTheme?: string | null | undefined;
        theme?: string | null | undefined;
      });
  source?: HTMLElement | null | undefined | (() => HTMLElement | null | undefined);
};
