import type { ReactNode } from "react";

type PageIntroProps = {
  label: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export default function PageIntro({
  label,
  title,
  description,
  children,
}: PageIntroProps) {
  return (
    <main id="main-content" className="hero" tabIndex={-1}>
      <p className="hero-label">{label}</p>
      <h1>{title}</h1>
      <p className="hero-description">{description}</p>
      {children}
    </main>
  );
}
