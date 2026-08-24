"use client";

import {
  FormEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import {
  api,
  ApiError,
  emptyLocalized,
  isCompleteLocalized,
  tLocal,
  type LocalizedText,
  type MenuItem,
} from "@/lib/api";
import { useAppLocale } from "@/components/locale-provider";

const fieldClass =
  "mt-1 w-full rounded-md border border-[var(--line)] bg-white/85 px-3 py-2 outline-none focus:border-accent";

type DropWhere = "before" | "after" | "into";

function collectDescendantIds(item: MenuItem): Set<string> {
  const ids = new Set<string>();
  const walk = (n: MenuItem) => {
    for (const c of n.children || []) {
      ids.add(c.id);
      walk(c);
    }
  };
  walk(item);
  return ids;
}

function findInTree(
  nodes: MenuItem[],
  id: string,
): MenuItem | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findInTree(n.children || [], id);
    if (found) return found;
  }
  return null;
}

function siblingIds(
  flat: MenuItem[],
  parentId: string | null,
): string[] {
  return flat
    .filter((x) => (x.parentId || null) === parentId)
    .sort((a, b) => a.order - b.order)
    .map((x) => x.id);
}

export default function AdminMenuPage() {
  const t = useTranslations("admin");
  const { locale } = useAppLocale();
  const { token } = useAuth();
  const [tree, setTree] = useState<MenuItem[]>([]);
  const [flat, setFlat] = useState<MenuItem[]>([]);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [label, setLabel] = useState<LocalizedText>(emptyLocalized());
  const [href, setHref] = useState("/");
  const [parentId, setParentId] = useState("");
  const [visible, setVisible] = useState(true);
  const [openInNewTab, setOpenInNewTab] = useState(false);
  const [pending, setPending] = useState(false);
  const [moving, setMoving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{
    id: string;
    where: DropWhere;
  } | null>(null);

  async function load() {
    if (!token) return;
    try {
      const [tData, fData] = await Promise.all([
        api<MenuItem[]>("/menu/admin/tree", { token }),
        api<MenuItem[]>("/menu/admin/flat", { token }),
      ]);
      setTree(tData);
      setFlat(fData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const blockedDropIds = useMemo(() => {
    if (!dragId) return new Set<string>();
    const node = findInTree(tree, dragId);
    if (!node) return new Set<string>([dragId]);
    const ids = collectDescendantIds(node);
    ids.add(dragId);
    return ids;
  }, [dragId, tree]);

  function resetForm() {
    setEditingId(null);
    setLabel(emptyLocalized());
    setHref("/");
    setParentId("");
    setVisible(true);
    setOpenInNewTab(false);
    setFormOpen(false);
  }

  function startAdd() {
    setEditingId(null);
    setLabel(emptyLocalized());
    setHref("/");
    setParentId("");
    setVisible(true);
    setOpenInNewTab(false);
    setFormOpen(true);
  }

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setLabel(
      typeof item.label === "string"
        ? { am: item.label }
        : { am: item.label.am || "" },
    );
    setHref(item.href);
    setParentId(item.parentId || "");
    setVisible(item.visible);
    setOpenInNewTab(item.openInNewTab);
    setFormOpen(true);
  }

  function toggleExpand(id: string) {
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!isCompleteLocalized(label)) {
      setError(t("requiredAllLangs"));
      return;
    }
    setPending(true);
    setError("");
    const body = {
      label: { am: label.am.trim() },
      href,
      visible,
      openInNewTab,
      parentId: parentId || null,
    };
    try {
      if (editingId) {
        await api(`/menu/${editingId}`, { method: "PATCH", token, body });
      } else {
        await api("/menu", { method: "POST", token, body });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!token || !confirm(t("confirmDeleteMenu"))) return;
    await api(`/menu/${id}`, { method: "DELETE", token });
    if (editingId === id) resetForm();
    await load();
  }

  async function persistOrder(
    itemId: string,
    newParentId: string | null,
    orderedSiblingIds: string[],
  ) {
    if (!token) return;
    setMoving(true);
    setError("");
    try {
      const current = flat.find((x) => x.id === itemId);
      const oldParent = current?.parentId || null;
      if (oldParent !== newParentId) {
        await api(`/menu/${itemId}`, {
          method: "PATCH",
          token,
          body: { parentId: newParentId },
        });
      }
      await api("/menu/reorder", {
        method: "PATCH",
        token,
        body: { ids: orderedSiblingIds },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
      await load();
    } finally {
      setMoving(false);
    }
  }

  async function moveBySteps(id: string, dir: -1 | 1) {
    const item = flat.find((x) => x.id === id);
    if (!item) return;
    const parent = item.parentId || null;
    const ids = siblingIds(flat, parent);
    const idx = ids.indexOf(id);
    const next = idx + dir;
    if (next < 0 || next >= ids.length) return;
    const nextIds = [...ids];
    const tmp = nextIds[idx];
    nextIds[idx] = nextIds[next];
    nextIds[next] = tmp;
    await persistOrder(id, parent, nextIds);
  }

  async function moveToEdge(id: string, edge: "start" | "end") {
    const item = flat.find((x) => x.id === id);
    if (!item) return;
    const parent = item.parentId || null;
    const ids = siblingIds(flat, parent).filter((x) => x !== id);
    const nextIds = edge === "start" ? [id, ...ids] : [...ids, id];
    await persistOrder(id, parent, nextIds);
  }

  async function applyDrop(targetId: string, where: DropWhere) {
    if (!dragId || dragId === targetId || blockedDropIds.has(targetId)) return;

    const dragItem = flat.find((x) => x.id === dragId);
    const target = flat.find((x) => x.id === targetId);
    if (!dragItem || !target) return;

    let newParent: string | null;
    let ordered: string[];

    if (where === "into") {
      newParent = targetId;
      ordered = [
        ...siblingIds(flat, targetId).filter((x) => x !== dragId),
        dragId,
      ];
      setExpanded((s) => ({ ...s, [targetId]: true }));
    } else {
      newParent = target.parentId || null;
      const base = siblingIds(flat, newParent).filter((x) => x !== dragId);
      const tIdx = base.indexOf(targetId);
      if (tIdx < 0) return;
      const insertAt = where === "before" ? tIdx : tIdx + 1;
      ordered = [
        ...base.slice(0, insertAt),
        dragId,
        ...base.slice(insertAt),
      ];
    }

    setDragId(null);
    setDropHint(null);
    await persistOrder(dragId, newParent, ordered);
  }

  function onDragStart(id: string, e: DragEvent) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function onDragEnd() {
    setDragId(null);
    setDropHint(null);
  }

  function onDragOverRow(id: string, e: DragEvent) {
    if (!dragId || blockedDropIds.has(id)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / rect.height;
    let where: DropWhere;
    if (ratio < 0.28) where = "before";
    else if (ratio > 0.72) where = "after";
    else where = "into";
    setDropHint({ id, where });
  }

  function onDropRow(id: string, e: DragEvent) {
    e.preventDefault();
    const where = dropHint?.id === id ? dropHint.where : "after";
    void applyDrop(id, where);
  }

  function renderNode(item: MenuItem, depth: number) {
    const kids = item.children || [];
    const hasKids = kids.length > 0;
    const isOpen = !!expanded[item.id];
    const parent = item.parentId || null;
    const sibs = siblingIds(flat, parent);
    const idx = sibs.indexOf(item.id);
    const canUp = idx > 0;
    const canDown = idx >= 0 && idx < sibs.length - 1;
    const isDragging = dragId === item.id;
    const hint = dropHint?.id === item.id ? dropHint.where : null;

    return (
      <div key={item.id}>
        <div
          className={[
            "relative flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-3 py-2.5 transition-colors first:border-t-0",
            isDragging ? "opacity-40" : "",
            hint === "into" ? "bg-accent/10" : "bg-transparent",
            moving ? "pointer-events-none" : "",
          ].join(" ")}
          style={{ paddingLeft: `${12 + depth * 22}px` }}
          onDragOver={(e) => onDragOverRow(item.id, e)}
          onDrop={(e) => onDropRow(item.id, e)}
          onDragLeave={() => {
            if (dropHint?.id === item.id) setDropHint(null);
          }}
        >
          {hint === "before" && (
            <span className="pointer-events-none absolute inset-x-3 top-0 h-0.5 rounded bg-accent" />
          )}
          {hint === "after" && (
            <span className="pointer-events-none absolute inset-x-3 bottom-0 h-0.5 rounded bg-accent" />
          )}

          <button
            type="button"
            draggable
            onDragStart={(e) => onDragStart(item.id, e)}
            onDragEnd={onDragEnd}
            className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded border border-[var(--line)] text-ink-soft hover:bg-mist active:cursor-grabbing"
            title={t("menuDrag")}
            aria-label={t("menuDrag")}
          >
            ⋮⋮
          </button>

          {hasKids ? (
            <button
              type="button"
              aria-expanded={isOpen}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[var(--line)] text-sm text-ink-soft hover:bg-mist"
              onClick={() => toggleExpand(item.id)}
              title={isOpen ? t("menuCollapse") : t("menuExpand")}
            >
              {isOpen ? "−" : "+"}
            </button>
          ) : (
            <span className="inline-block h-8 w-8 shrink-0" />
          )}

          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">
              {tLocal(item.label, locale)}
              {hasKids && (
                <span className="ml-2 text-xs font-normal text-ink-soft">
                  ({kids.length})
                </span>
              )}
              {!item.visible && (
                <span className="ml-2 text-xs text-ink-soft">
                  ({t("hidden")})
                </span>
              )}
            </p>
            <p className="truncate font-mono text-xs text-ink-soft">
              {item.href}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-[var(--line)] p-0.5">
            <button
              type="button"
              disabled={!canUp || moving}
              className="h-7 w-7 rounded text-xs text-ink-soft hover:bg-mist disabled:opacity-30"
              onClick={() => void moveToEdge(item.id, "start")}
              title={t("menuMoveTop")}
            >
              ⇈
            </button>
            <button
              type="button"
              disabled={!canUp || moving}
              className="h-7 w-7 rounded text-xs text-ink-soft hover:bg-mist disabled:opacity-30"
              onClick={() => void moveBySteps(item.id, -1)}
              title={t("menuMoveUp")}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={!canDown || moving}
              className="h-7 w-7 rounded text-xs text-ink-soft hover:bg-mist disabled:opacity-30"
              onClick={() => void moveBySteps(item.id, 1)}
              title={t("menuMoveDown")}
            >
              ↓
            </button>
            <button
              type="button"
              disabled={!canDown || moving}
              className="h-7 w-7 rounded text-xs text-ink-soft hover:bg-mist disabled:opacity-30"
              onClick={() => void moveToEdge(item.id, "end")}
              title={t("menuMoveBottom")}
            >
              ⇊
            </button>
          </div>

          <button
            type="button"
            className="text-sm text-accent-deep hover:underline"
            onClick={() => startEdit(item)}
          >
            {t("edit")}
          </button>
          <button
            type="button"
            className="text-sm text-red-700 hover:underline"
            onClick={() => void remove(item.id)}
          >
            {t("delete")}
          </button>
        </div>
        {hasKids && isOpen && kids.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-section-title text-ink">{t("menu")}</h1>
          <p className="mt-1 text-ink-soft">{t("menuLead")}</p>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={startAdd}
            className="shrink-0 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-deep"
          >
            {t("addMenuItem")}
          </button>
        )}
      </div>

      {formOpen && (
        <form
          onSubmit={onSubmit}
          className="mt-6 w-full max-w-lg space-y-4 rounded-xl border border-[var(--line)] bg-white/80 p-5"
        >
          <h2 className="text-card-title text-ink">
            {editingId ? t("editMenuItem") : t("addMenuItem")}
          </h2>

          <label className="block text-sm">
            {t("label")}
            <input
              className={fieldClass}
              value={label.am}
              onChange={(e) =>
                setLabel((v) => ({ ...v, am: e.target.value }))
              }
              required
            />
          </label>

          <label className="block text-sm">
            {t("href")}
            <input
              className={fieldClass}
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/p/about or https://…"
            />
          </label>

          <label className="block text-sm">
            {t("parent")}
            <select
              className={fieldClass}
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">{t("topLevel")}</option>
              {flat
                .filter((x) => x.id !== editingId)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {tLocal(x.label, locale)}
                  </option>
                ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) => setVisible(e.target.checked)}
              />
              {t("visible")}
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={openInNewTab}
                onChange={(e) => setOpenInNewTab(e.target.checked)}
              />
              {t("openInNewTab")}
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-60"
            >
              {pending ? t("saving") : editingId ? t("save") : t("add")}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-[var(--line)] px-4 py-2 text-sm"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-4 text-red-700">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-xl border border-[var(--line)] bg-white/80">
        {tree.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-soft">{t("menuEmpty")}</p>
        ) : (
          tree.map((item) => renderNode(item, 0))
        )}
      </div>
    </div>
  );
}
