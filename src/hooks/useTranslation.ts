import { useContext } from "react";
import { LanguageContext } from "../context/LanguageProvider";

export const useTranslation = () => {
  return useContext(LanguageContext);
};
