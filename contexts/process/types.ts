import type * as Monaco from "monaco-editor/esm/vs/editor/editor.api";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import {
  type Operation,
  type FileReaders,
  type ObjectReaders,
} from "components/system/Dialogs/Transfer/useTransferDialog";
import { type Size } from "components/system/Window/RndWindow/useResizable";

type BrowserProcessArguments = {
  initialTitle?: string;
};

type DialogProcessArguments = {
  fileReaders?: FileReaders | ObjectReaders;
  operation?: Operation;
  progress?: number;
  shortcutPath?: string;
};

type MediaPlayerProcessArguments = {
  mute?: () => void;
  muted?: boolean;
  pause?: () => void;
  paused?: boolean;
  play?: () => void;
  unmute?: () => void;
};

type MonacoProcessArguments = {
  editor?: Monaco.editor.IStandaloneCodeEditor;
};

type PdfProcessArguments = {
  count?: number;
  page?: number;
  rendering?: boolean;
  scale?: number;
  subTitle?: string;
};

/**
 * Per-window view state for the command-center applications.
 *
 * These live on the process, not in `SessionData`: they die with the window,
 * and no service ever reads them, so operational authority cannot leak through
 * view state. The selected object also travels in `url`, because that is the
 * only field `openProcess` re-targets when a singleton is re-opened.
 */
type OwlAgentsProcessArguments = {
  owlDeepLinkError?: string;
  owlFilter?: string;
  owlSelectedId?: string;
  owlTab?: string;
};

export type RelativePosition = {
  bottom?: number;
  left?: number;
  right?: number;
  top?: number;
};

type BaseProcessArguments = {
  allowResizing?: boolean;
  autoSizing?: boolean;
  backgroundBlur?: string;
  backgroundColor?: string;
  dependantLibs?: string[];
  hideMaximizeButton?: boolean;
  hideMinimizeButton?: boolean;
  hidePeek?: boolean;
  hideTaskbarEntry?: boolean;
  hideTitlebar?: boolean;
  hideTitlebarIcon?: boolean;
  initialRelativePosition?: RelativePosition;
  libs?: string[];
  lockAspectRatio?: boolean;
  peekImage?: string;
  url?: string;
};

export type ProcessArguments = BaseProcessArguments &
  BrowserProcessArguments &
  DialogProcessArguments &
  MediaPlayerProcessArguments &
  MonacoProcessArguments &
  OwlAgentsProcessArguments &
  PdfProcessArguments;

type ProcessCategory = "advanced" | "diagnostic" | "primary";

/**
 * Registry metadata added by Phase B2. Every field is optional, so the 33
 * existing entries are untouched, and it is a separate literal so
 * `typescript-sort-keys` sorts it independently of the `Process` block.
 */
type RegistryProcessMetadata = {
  category?: ProcessCategory;
  deepLinkPatterns?: readonly string[];
  /** Layer badge beside the window caption: OWLAGENTS, OLYMPUS RUNTIME, … */
  laneBadge?: string;
  minSize?: Size;
  requiredCapabilities?: readonly string[];
};

export type ProcessElements = {
  componentWindow?: HTMLElement;
  peekElement?: HTMLElement;
  taskbarEntry?: HTMLElement;
};

export type Process = ProcessArguments &
  ProcessElements &
  RegistryProcessMetadata & {
    Component: React.ComponentType<ComponentProcessProps>;
    closing?: boolean;
    defaultSize?: Size;
    dialogProcess?: boolean;
    hasWindow?: boolean;
    icon: string;
    maximized?: boolean;
    minimized?: boolean;
    preferProcessIcon?: boolean;
    singleton?: boolean;
    title: string;
  };

export type Processes = Record<string, Process>;
