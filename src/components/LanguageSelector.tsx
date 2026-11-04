import { setLanguage, useLanguage } from "../i18n";
export default function LanguageSelector() {
  const language = useLanguage();
  return (
    <label className="language-selector">
      <span aria-hidden="true">◎</span>
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={language}
        onChange={(event) =>
          setLanguage(event.target.value === "en" ? "en" : "ko")
        }
      >
        <option value="ko">한국어</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
