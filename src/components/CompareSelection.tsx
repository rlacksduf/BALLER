import { t, localized } from "../i18n";
import { useState, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  addSelection,
  getSelection,
  setSelection,
  subscribeSelection,
} from "../services/selection";
import type { Selection } from "../services/selection";
export function AddToCompare({ player }: { player: Selection }) {
  const items = useSyncExternalStore(subscribeSelection, getSelection);
  const [full, setFull] = useState(false);
  const selected = items.some((p) => p.id === player.id);
  return (
    <div className="add-compare">
      <button
        type="button"
        className="reset-button"
        aria-pressed={selected}
        onClick={() => {
          if (selected) {
            setSelection(items.filter((p) => p.id !== player.id));
            return;
          }
          setFull(addSelection(player) === "full");
        }}
      >
        {selected ? t("✓ 비교 선택됨") : t("+ 비교 추가")}
      </button>
      {full && (
        <div
          role="group"
          aria-label={t("비교 선수 교체")}
          className="replace-choice"
        >
          <p>{t("두 명이 선택되어 있습니다. 교체할 선수를 선택하세요.")}</p>
          {items.map((item, index) => (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                const next = [...items];
                next[index] = player;
                setSelection(next);
                setFull(false);
              }}
            >
              {item.name} · {t("교체")}
            </button>
          ))}
          <button type="button" onClick={() => setFull(false)}>
            {t("취소")}
          </button>
        </div>
      )}
    </div>
  );
}
export default function CompareSelection() {
  const { pathname } = useLocation();
  const items = useSyncExternalStore(subscribeSelection, getSelection);
  if (!items.length || pathname === "/compare") return null;
  return (
    <aside className="comparison-tray" aria-label={t("비교 선택 선수")}>
      <div>
        <strong>PLAYER BATTLE</strong>
        <div className="tray-players">
          {items.map((player) => (
            <span key={player.id}>
              {player.name}
              <button
                type="button"
                aria-label={localized(
                  `${player.name} 비교 선택 해제`,
                  `Remove ${player.name} from comparison`,
                )}
                onClick={() =>
                  setSelection(items.filter((p) => p.id !== player.id))
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="tray-actions">
        <button
          className="reset-button"
          type="button"
          onClick={() => setSelection([])}
        >
          {t("초기화")}
        </button>
        <Link
          className="explore-btn"
          to={
            "/compare?a=" + items[0]!.id + (items[1] ? "&b=" + items[1].id : "")
          }
        >
          {items.length === 2 ? t("비교하기 →") : t("상대 선택 →")}
        </Link>
      </div>
    </aside>
  );
}
