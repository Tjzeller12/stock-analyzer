import { useCallback, useEffect, useRef, useState } from "react";
import { RadarTemplate } from "../components/common/AdvancedSettingsPanel";
import { PROFILE_ENDPOINTS, TEMPLATE_ENDPOINTS } from "../constants/api";
import { AnalysisTemplateDTO, InvestorProfile, TemplateLibrary } from "../types";
import { authDelete, authGet, authPost, authPut } from "../utils/api";

export const ACTIVE_TEMPLATE_KEY = "alphabot.activeTemplateId";

export interface UseTemplateManager {
  library: TemplateLibrary;
  loading: boolean;
  error: string | null;
  activeId: number | null;
  profileRiskTag: string | null;
  applyTemplate: (t: AnalysisTemplateDTO) => void;
  persistActive: (id: number) => void;
  clearActive: () => void;
  saveCurrentView: (name: string, description: string, radar: RadarTemplate, visibleColumns: string[]) => Promise<AnalysisTemplateDTO>;
  updateSetup: (id: number, radar: RadarTemplate, visibleColumns: string[], meta: { name: string; description: string }) => Promise<AnalysisTemplateDTO>;
  deleteTemplate: (id: number) => Promise<void>;
  cloneTemplate: (t: AnalysisTemplateDTO) => Promise<AnalysisTemplateDTO>;
  refresh: () => Promise<void>;
}

const EMPTY: TemplateLibrary = { defaults: [], mine: [] };

function readStoredId(): number | null {
  const raw = localStorage.getItem(ACTIVE_TEMPLATE_KEY);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

export function useTemplateManager(applyView: (radar: RadarTemplate, columns: string[]) => void): UseTemplateManager {
  const [library, setLibrary] = useState<TemplateLibrary>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(readStoredId);
  const [profileRiskTag, setProfileRiskTag] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const appliedInitial = useRef(false);
  const applyViewRef = useRef(applyView);
  applyViewRef.current = applyView;

  const persistActive = useCallback((id: number) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_TEMPLATE_KEY, String(id));
  }, []);

  const clearActive = useCallback(() => {
    setActiveId(null);
    localStorage.removeItem(ACTIVE_TEMPLATE_KEY);
  }, []);

  const applyTemplate = useCallback((t: AnalysisTemplateDTO) => {
    const radar = t.config?.radar;
    const columns = t.config?.visible_columns;
    if (!radar?.equations || !columns?.length) return;
    applyViewRef.current(radar as RadarTemplate, columns);
    persistActive(t.id);
  }, [persistActive]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authGet<Partial<TemplateLibrary>>(TEMPLATE_ENDPOINTS.LIST);
      setLibrary({
        defaults: data.defaults ?? [],
        mine: data.mine ?? [],
      });
    } catch {
      setError("Could not load scoring setups");
      setLibrary(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    const loadTag = async () => {
      try {
        const profile = await authGet<InvestorProfile>(PROFILE_ENDPOINTS.INVESTOR);
        if (!cancelled) {
          setProfileRiskTag(profile.risk_tag);
          setProfileReady(true);
        }
      } catch {
        if (!cancelled) {
          setProfileRiskTag(null);
          setProfileReady(true);
        }
      }
    };
    void loadTag();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (appliedInitial.current || loading || !profileReady) return;
    const all = [...library.defaults, ...library.mine];
    if (all.length === 0) return;

    const stored = readStoredId();
    const storedRow = stored != null ? all.find((t) => t.id === stored) : undefined;
    if (storedRow) {
      applyTemplate(storedRow);
      appliedInitial.current = true;
      return;
    }
    if (library.mine.length > 0) {
      applyTemplate(library.mine[0]);
      appliedInitial.current = true;
      return;
    }
    const match = library.defaults.find((t) => t.profile_risk_tag === profileRiskTag)
      ?? library.defaults.find((t) => t.profile_risk_tag === "Balanced")
      ?? library.defaults[0];
    if (match) applyTemplate(match);
    appliedInitial.current = true;
  }, [loading, library, profileRiskTag, profileReady, applyTemplate]);

  const saveCurrentView = useCallback(async (
    name: string,
    description: string,
    radar: RadarTemplate,
    visibleColumns: string[],
  ) => {
    const created = await authPost<AnalysisTemplateDTO>(TEMPLATE_ENDPOINTS.LIST, {
      name,
      description,
      config: { radar, visible_columns: visibleColumns },
    });
    await refresh();
    return created;
  }, [refresh]);

  const updateSetup = useCallback(async (
    id: number,
    radar: RadarTemplate,
    visibleColumns: string[],
    meta: { name: string; description: string },
  ) => {
    const updated = await authPut<AnalysisTemplateDTO>(TEMPLATE_ENDPOINTS.ONE(id), {
      name: meta.name,
      description: meta.description,
      config: { radar, visible_columns: visibleColumns },
    });
    await refresh();
    return updated;
  }, [refresh]);

  const deleteTemplate = useCallback(async (id: number) => {
    await authDelete(TEMPLATE_ENDPOINTS.ONE(id));
    const wasActive = activeId === id;
    const remainingMine = library.mine.filter((t) => t.id !== id);
    if (wasActive) {
      const next = remainingMine[0]
        ?? library.defaults.find((t) => t.profile_risk_tag === profileRiskTag)
        ?? library.defaults.find((t) => t.profile_risk_tag === "Balanced")
        ?? library.defaults[0];
      if (next) {
        applyTemplate(next);
      } else {
        clearActive();
      }
    }
    await refresh();
  }, [activeId, library, profileRiskTag, applyTemplate, clearActive, refresh]);

  const cloneTemplate = useCallback(async (t: AnalysisTemplateDTO) => {
    const created = await authPost<AnalysisTemplateDTO>(TEMPLATE_ENDPOINTS.CLONE(t.id));
    await refresh();
    applyTemplate(created);
    return created;
  }, [refresh, applyTemplate]);

  return {
    library,
    loading,
    error,
    activeId,
    profileRiskTag,
    applyTemplate,
    persistActive,
    clearActive,
    saveCurrentView,
    updateSetup,
    deleteTemplate,
    cloneTemplate,
    refresh,
  };
}
