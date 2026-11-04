import { t, useLanguage } from "../i18n";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
export default function RouteEffects() {
  const { pathname } = useLocation();
  const language = useLanguage();
  useEffect(() => {
    const page =
      pathname === "/"
        ? "Football Analytics"
        : pathname === "/players"
          ? t("선수 검색")
          : pathname.startsWith("/players/")
            ? t("선수 상세")
            : pathname === "/compare"
              ? t("선수 비교")
              : t("페이지를 찾을 수 없습니다");
    document.title = `BALLER — ${page}`;
  }, [pathname, language]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
