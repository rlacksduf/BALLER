import { t } from "../i18n";
import type { Player } from "../types/player";

type PlayerCardProps = { player: Player; season: string };

export default function PlayerCard({ player, season }: PlayerCardProps) {
  const stats = player.seasons[season];
  if (!stats) return null;
  return (
    <article className="player-card" aria-label={`${player.name} 선수 카드`}>
      <div className="card-top">
        <span className={`position-badge position-${player.position}`}>
          {player.position}
        </span>
        <span className="shirt-number">
          #{player.number.toString().padStart(2, "0")}
        </span>
      </div>
      <div className="player-identity">
        <span className="player-monogram" aria-hidden="true">
          {player.englishName
            .split(" ")
            .map((part) => part[0])
            .join("")}
        </span>
        <div>
          <p className="player-team">{player.team}</p>
          <h2>{player.name}</h2>
          <p className="english-name" lang="en">
            {player.englishName}
          </p>
        </div>
      </div>
      <p className="player-meta">
        {player.nationality} <span aria-hidden="true">·</span> {player.league}
      </p>
      <dl className="player-stats">
        <div>
          <dt>{t("득점")}</dt>
          <dd>{stats.goals}</dd>
        </div>
        <div>
          <dt>{t("도움")}</dt>
          <dd>{stats.assists}</dd>
        </div>
        <div>
          <dt>{t("출전")}</dt>
          <dd>
            {stats.appearances}
            <small>{t("경기")}</small>
          </dd>
        </div>
      </dl>
      <div className="card-bottom">
        <span>{season}</span>
        <span>{stats.minutes.toLocaleString("ko-KR")}분 출전</span>
      </div>
    </article>
  );
}
