/**
 * Google Material Symbols (Rounded, weight 400), imported as React components.
 * Every icon used by the UI is re-exported here so the bundle only ships what is used.
 * Icons are decorative by default (aria-hidden); give them a label at the call site if needed.
 */
import type { ComponentType, SVGProps } from "react";
import Close from "@material-symbols/svg-400/rounded/close.svg?react";
import Check from "@material-symbols/svg-400/rounded/check.svg?react";
import ExpandMore from "@material-symbols/svg-400/rounded/keyboard_arrow_down.svg?react";
import ExpandLess from "@material-symbols/svg-400/rounded/keyboard_arrow_up.svg?react";
import CircleFill from "@material-symbols/svg-400/rounded/circle-fill.svg?react";
import Settings from "@material-symbols/svg-400/rounded/settings.svg?react";
import Language from "@material-symbols/svg-400/rounded/language.svg?react";
import Shield from "@material-symbols/svg-400/rounded/shield_person.svg?react";
import Contrast from "@material-symbols/svg-400/rounded/contrast.svg?react";
import LightMode from "@material-symbols/svg-400/rounded/light_mode.svg?react";
import DarkMode from "@material-symbols/svg-400/rounded/dark_mode.svg?react";
import OpenInNew from "@material-symbols/svg-400/rounded/open_in_new.svg?react";
import Key from "@material-symbols/svg-400/rounded/key.svg?react";
import Refresh from "@material-symbols/svg-400/rounded/refresh.svg?react";
import CloudOff from "@material-symbols/svg-400/rounded/cloud_off.svg?react";
import CloudDone from "@material-symbols/svg-400/rounded/cloud_done.svg?react";
import Pause from "@material-symbols/svg-400/rounded/pause_circle.svg?react";
import Hourglass from "@material-symbols/svg-400/rounded/hourglass_top.svg?react";
import Visibility from "@material-symbols/svg-400/rounded/visibility.svg?react";
import VisibilityOff from "@material-symbols/svg-400/rounded/visibility_off.svg?react";
import Send from "@material-symbols/svg-400/rounded/send.svg?react";
import Verified from "@material-symbols/svg-400/rounded/verified.svg?react";
import FactCheck from "@material-symbols/svg-400/rounded/fact_check.svg?react";
import Info from "@material-symbols/svg-400/rounded/info.svg?react";
import Block from "@material-symbols/svg-400/rounded/block.svg?react";
import DataObject from "@material-symbols/svg-400/rounded/data_object.svg?react";
import Policy from "@material-symbols/svg-400/rounded/policy.svg?react";

import VerifiedFill from "@material-symbols/svg-400/rounded/verified-fill.svg?react";
import Tune from "@material-symbols/svg-400/rounded/tune.svg?react";
import Lock from "@material-symbols/svg-400/rounded/lock.svg?react";
import BadgeIcon from "@material-symbols/svg-400/rounded/badge.svg?react";
import Flag from "@material-symbols/svg-400/rounded/flag.svg?react";
import CheckCircle from "@material-symbols/svg-400/rounded/check_circle.svg?react";
import Warning from "@material-symbols/svg-400/rounded/warning.svg?react";
import ErrorIcon from "@material-symbols/svg-400/rounded/error.svg?react";

type IconComponent = (props: SVGProps<SVGSVGElement>) => React.ReactElement;
const wrap = (C: ComponentType<SVGProps<SVGSVGElement>>): IconComponent => {
  const Wrapped = ({ className, ...rest }: SVGProps<SVGSVGElement>) => (
    <C aria-hidden="true" focusable="false" fill="currentColor" className={className} {...rest} />
  );
  return Wrapped;
};

export const Icons = {
  close: wrap(Close),
  check: wrap(Check),
  expandMore: wrap(ExpandMore),
  expandLess: wrap(ExpandLess),
  dot: wrap(CircleFill),
  settings: wrap(Settings),
  language: wrap(Language),
  privacy: wrap(Shield),
  contrast: wrap(Contrast),
  lightMode: wrap(LightMode),
  darkMode: wrap(DarkMode),
  openInNew: wrap(OpenInNew),
  key: wrap(Key),
  refresh: wrap(Refresh),
  offline: wrap(CloudOff),
  online: wrap(CloudDone),
  paused: wrap(Pause),
  quota: wrap(Hourglass),
  visible: wrap(Visibility),
  hidden: wrap(VisibilityOff),
  send: wrap(Send),
  verified: wrap(Verified),
  factCheck: wrap(FactCheck),
  info: wrap(Info),
  block: wrap(Block),
  code: wrap(DataObject),
  policy: wrap(Policy),
  verifiedFill: wrap(VerifiedFill),
  tune: wrap(Tune),
  lock: wrap(Lock),
  badge: wrap(BadgeIcon),
  flag: wrap(Flag),
  checkCircle: wrap(CheckCircle),
  warning: wrap(Warning),
  error: wrap(ErrorIcon),
} as const;
export type IconName = keyof typeof Icons;
