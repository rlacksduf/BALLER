import ThemeToggle from "./ThemeToggle";
import { t, localized } from "../i18n";
import { Link, NavLink } from "react-router-dom";
import "./Header.css";

type HeaderProps = {
  brand: string;
};

export default function Header({ brand }: HeaderProps) {
  return (
    <header className="header">
      <Link
        className="logo"
        to="/"
        aria-label={localized(`${brand} 홈`, `${brand} home`)}
      >
        {brand}
      </Link>

      <nav className="nav" aria-label={t("메인 메뉴")}>
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/players">Players</NavLink>
        <NavLink to="/compare">Compare</NavLink>
      </nav>
      <ThemeToggle />
    </header>
  );
}
