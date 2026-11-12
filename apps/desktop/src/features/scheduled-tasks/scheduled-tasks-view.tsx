import { useMemo, useState } from "react";
import type {
  DesktopAppState,
  ScheduledTaskFilter,
  ScheduledTaskRecord,
} from "../../../contracts/desktop-state";
import {
  filterScheduledTasks,
  formatScheduledTaskRowMeta,
} from "../../../contracts/scheduled-tasks";
import type { PiDesktopApi } from "../../../contracts/ipc";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation, type MessageKey } from "../../i18n";
import type { ScheduledEditorState } from "./scheduled-task-editor";

interface ScheduledTasksViewProps {
  readonly tasks: readonly ScheduledTaskRecord[];
  readonly lastError?: string;
  readonly api: PiDesktopApi;
  readonly setSnapshot: Dispatch<SetStateAction<DesktopAppState | null>>;
  readonly updateSnapshot: (
    setSnapshot: Dispatch<SetStateAction<DesktopAppState | null>>,
    action: () => Promise<DesktopAppState>,
  ) => Promise<DesktopAppState>;
  readonly onCreateWithPi: () => void;
  readonly onOpenEditor: (editor: ScheduledEditorState) => void;
}

const FILTERS: readonly { readonly id: ScheduledTaskFilter; readonly label: MessageKey }[] = [
  { id: "all", label: "tasks.view.filter.all" },
  { id: "active", label: "tasks.view.filter.active" },
  { id: "paused", label: "tasks.view.filter.paused" },
  { id: "completed", label: "tasks.view.filter.completed" },
];

export function ScheduledTasksView({
  tasks,
  lastError,
  api,
  setSnapshot,
  updateSnapshot,
  onCreateWithPi,
  onOpenEditor,
}: ScheduledTasksViewProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ScheduledTaskFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [menuTaskId, setMenuTaskId] = useState<string | undefined>();
  const visible = useMemo(() => filterScheduledTasks(tasks, filter, query), [tasks, filter, query]);

  return (
    <section className="canvas scheduled-tasks-view" data-testid="scheduled-tasks-view">
      <header className="view-header">
        <div>
          <h1 className="view-header__title">{t("tasks.view.title")}</h1>
          <p className="view-header__body">{t("tasks.view.subtitle")}</p>
        </div>
        <div className="view-header__actions">
          <div className="scheduled-create">
            <button
              className="button button--primary"
              data-testid="scheduled-task-create"
              type="button"
              aria-haspopup="menu"
              aria-expanded={createOpen}
              onClick={() => setCreateOpen((open) => !open)}
            >
              {t("tasks.view.create")}
            </button>
            {createOpen ? (
              <div className="workspace-menu scheduled-create__menu" role="menu">
                <button
                  className="workspace-menu__item"
                  data-testid="scheduled-task-create-with-pi"
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    onCreateWithPi();
                  }}
                >
                  {t("tasks.view.createWithPi")}
                </button>
                <button
                  className="workspace-menu__item"
                  data-testid="scheduled-task-setup-manually"
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    onOpenEditor({ mode: "create" });
                  }}
                >
                  {t("tasks.view.setupManually")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="scheduled-toolbar">
        <input
          aria-label={t("tasks.view.searchLabel")}
          className="skills-search"
          data-testid="scheduled-task-search"
          placeholder={t("tasks.view.searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="scheduled-tabs" role="tablist">
          {FILTERS.map((entry) => (
            <button
              className={`scheduled-tabs__item${filter === entry.id ? " scheduled-tabs__item--active" : ""}`}
              data-testid={`scheduled-task-filter-${entry.id}`}
              key={entry.id}
              role="tab"
              type="button"
              aria-selected={filter === entry.id}
              onClick={() => setFilter(entry.id)}
            >
              {t(entry.label)}
            </button>
          ))}
        </div>
      </div>

      {lastError ? <p className="error-banner">{lastError}</p> : null}

      {visible.length === 0 ? (
        <div className="empty-panel" data-testid="scheduled-tasks-empty">
          <h2>
            {filter === "active" ? t("tasks.view.emptyActiveTitle") : t("tasks.view.emptyTitle")}
          </h2>
          <p>{filter === "active" ? t("tasks.view.emptyActiveBody") : t("tasks.view.emptyBody")}</p>
        </div>
      ) : (
        <div className="scheduled-task-list">
          {visible.map((task) => (
            <article
              className="scheduled-task-row"
              data-testid="scheduled-task-row"
              data-task-id={task.id}
              key={task.id}
            >
              <button
                className="scheduled-task-row__body"
                type="button"
                onClick={() => onOpenEditor({ mode: "edit", taskId: task.id })}
              >
                <strong className="scheduled-task-row__title">{task.title}</strong>
                <span className="scheduled-task-row__meta">{formatScheduledTaskRowMeta(task)}</span>
              </button>
              <span className="scheduled-task-row__menu-wrap">
                <button
                  className="icon-button"
                  type="button"
                  aria-label={t("tasks.view.actions", { name: task.title })}
                  aria-haspopup="menu"
                  aria-expanded={menuTaskId === task.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenuTaskId((current) => (current === task.id ? undefined : task.id));
                  }}
                >
                  …
                </button>
                {menuTaskId === task.id ? (
                  <div className="workspace-menu scheduled-task-row__menu" role="menu">
                    {task.status === "paused" ? (
                      <button
                        className="workspace-menu__item"
                        type="button"
                        onClick={() => {
                          setMenuTaskId(undefined);
                          void updateSnapshot(setSnapshot, () =>
                            api.updateScheduledTask(task.id, { status: "active" }),
                          ).catch((error: unknown) => {
                            console.error("[renderer] updateScheduledTask failed", error);
                          });
                        }}
                      >
                        {t("tasks.view.resume")}
                      </button>
                    ) : task.status !== "completed" ? (
                      <button
                        className="workspace-menu__item"
                        type="button"
                        onClick={() => {
                          setMenuTaskId(undefined);
                          void updateSnapshot(setSnapshot, () =>
                            api.updateScheduledTask(task.id, { status: "paused" }),
                          ).catch((error: unknown) => {
                            console.error("[renderer] updateScheduledTask failed", error);
                          });
                        }}
                      >
                        {t("tasks.view.pause")}
                      </button>
                    ) : null}
                    <button
                      className="workspace-menu__item"
                      type="button"
                      onClick={() => {
                        setMenuTaskId(undefined);
                        onOpenEditor({ mode: "edit", taskId: task.id });
                      }}
                    >
                      {t("tasks.view.edit")}
                    </button>
                    <button
                      className="workspace-menu__item workspace-menu__item--danger"
                      type="button"
                      onClick={() => {
                        setMenuTaskId(undefined);
                        void updateSnapshot(setSnapshot, () =>
                          api.deleteScheduledTask(task.id),
                        ).catch((error: unknown) => {
                          console.error("[renderer] deleteScheduledTask failed", error);
                        });
                      }}
                    >
                      {t("tasks.view.delete")}
                    </button>
                  </div>
                ) : null}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
