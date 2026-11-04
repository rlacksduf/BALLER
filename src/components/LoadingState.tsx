import { t } from "../i18n";
export default function LoadingState({
  label = t("데이터 조회 중…"),
}: {
  label?: string;
}) {
  return (
    <div className="skeleton-panel" role="status">
      <span>{typeof label === "string" ? t(label) : label}</span>
      <div aria-hidden="true">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </div>
    </div>
  );
}
