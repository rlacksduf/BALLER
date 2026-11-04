import { t } from "../i18n";
import { Link } from "react-router-dom";
import PageIntro from "../components/PageIntro";

export default function NotFoundPage() {
  return (
    <PageIntro
      label="404 · OUT OF PLAY"
      title={t("페이지를 찾을 수 없어요.")}
      description={t("주소를 확인하거나 홈으로 돌아가세요.")}
    >
      <Link className="explore-btn" to="/">
        {t("홈으로 이동")}
        <span aria-hidden="true">→</span>
      </Link>
    </PageIntro>
  );
}
