import en from "./en";
import hi from "./hi";
import mr from "./mr";
import gu from "./gu";

export const translations = {
  en,
  hi,
  mr,
  gu,
};

export type Language = keyof typeof translations;
