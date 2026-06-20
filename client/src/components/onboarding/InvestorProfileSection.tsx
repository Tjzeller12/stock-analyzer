import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PROFILE_ENDPOINTS } from "../../constants/api";
import { HORIZON_OPTIONS, LOW_BUDGET_THRESHOLD, MAX_SECTORS } from "../../constants/onboarding";
import { SECTORS } from "../../constants/sectors";
import { ONBOARDING_DISMISSED_KEY } from "../../hooks/useOnboardingGate";
import { InvestorProfile } from "../../types";
import { authGet, authPut } from "../../utils/api";
import Card from "../common/Card";
import SectorMatrix from "./SectorMatrix";

const sectorLabel = (key: string): string =>
  SECTORS.find((s) => s.key === key)?.label ?? key;

type EditableField = "horizon" | "budget" | "sectors";

/**
 * Investor-profile panel on the Profile page. Each field can be edited
 * independently and saved on its own — the server merges partial updates, so a
 * user can change just their sectors (or budget, or horizon) without re-taking
 * the questionnaire. Risk requires the scenario questions, so it links back to
 * the full onboarding flow.
 */
const InvestorProfileSection: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft values while editing a single field.
  const [draftYears, setDraftYears] = useState<number | null>(null);
  const [draftBudget, setDraftBudget] = useState<number | null>(null);
  const [draftSectors, setDraftSectors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await authGet<InvestorProfile>(PROFILE_ENDPOINTS.INVESTOR);
        if (!cancelled) setProfile(data);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const startEdit = (field: EditableField) => {
    setError(null);
    if (field === "horizon") setDraftYears(profile?.time_horizon_years ?? null);
    if (field === "budget") setDraftBudget(profile?.budget ?? null);
    if (field === "sectors") setDraftSectors(profile?.preferred_sectors ?? []);
    setEditing(field);
  };

  const cancelEdit = () => {
    setEditing(null);
    setError(null);
  };

  const saveField = async (body: Partial<Record<string, unknown>>) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await authPut<InvestorProfile>(PROFILE_ENDPOINTS.INVESTOR, body);
      setProfile(updated);
      setEditing(null);
    } catch {
      setError("Couldn't save that change. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleDraftSector = (key: string) => {
    setDraftSectors((prev) => {
      if (prev.includes(key)) return prev.filter((s) => s !== key);
      if (prev.length >= MAX_SECTORS) return prev;
      return [...prev, key];
    });
  };

  const goToOnboarding = () => {
    sessionStorage.removeItem(ONBOARDING_DISMISSED_KEY);
    navigate("/onboarding");
  };

  const goToRetakeQuestions = goToOnboarding;

  if (loading) {
    return (
      <Card title="Investor Profile" variant="glass" className="w-full">
        <p className="text-sm text-text-main/60 py-4">Loading profile…</p>
      </Card>
    );
  }

  const completed = profile?.onboarding_completed;

  return (
    <Card title="Investor Profile" variant="glass" className="w-full">
      {!completed && (
        <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-primary/10 text-left">
          <p className="text-sm text-text-main/80 mb-3">
            You haven't completed your investor profile yet. Answer a few quick questions to
            unlock personalized discovery, radar defaults, and portfolio suggestions.
          </p>
          <button
            type="button"
            onClick={goToOnboarding}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-primary to-[#057a37] text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Start questionnaire
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 text-left">
        {/* Risk profile — requires the questionnaire */}
        <div className="rounded-lg border border-border-main/30 bg-input-bg p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-main/50 mb-1">
              Risk profile
            </p>
            <p className="text-lg font-bold text-primary">
              {profile?.risk_tag ?? "Not set"}
              {profile?.risk_tag && (
                <span className="text-sm font-medium text-text-main/50">
                  {" "}
                  ({Math.round(profile?.risk_tolerance_score ?? 0)}/100)
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={goToRetakeQuestions}
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-transparent border border-border-main text-text-main hover:bg-row-hover active:scale-[0.98] transition-all whitespace-nowrap"
          >
            {profile?.risk_tag ? "Retake questions" : "Answer questions"}
          </button>
        </div>

        {/* Time horizon */}
        <div className="rounded-lg border border-border-main/30 bg-input-bg p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-main/50 mb-1">
                Time horizon
              </p>
              <p className="text-lg font-bold text-text-main">
                {profile?.horizon_tag ?? "Not set"}
              </p>
            </div>
            {editing !== "horizon" && (
              <button
                type="button"
                onClick={() => startEdit("horizon")}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-transparent border border-border-main text-text-main hover:bg-row-hover active:scale-[0.98] transition-all"
              >
                Edit
              </button>
            )}
          </div>
          {editing === "horizon" && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {HORIZON_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDraftYears(opt.years)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
                      draftYears === opt.years
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border-main/30 text-text-main/70 hover:border-text-main/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  disabled={saving || draftYears === null}
                  onClick={() => void saveField({ time_horizon_years: draftYears })}
                  className="px-4 py-1.5 rounded-md text-xs font-bold bg-gradient-to-r from-primary to-[#057a37] text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-1.5 rounded-md text-xs font-semibold border border-border-main text-text-main hover:bg-row-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Budget */}
        <div className="rounded-lg border border-border-main/30 bg-input-bg p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-main/50 mb-1">Budget</p>
              <p className="text-lg font-bold text-text-main">
                ${(profile?.budget ?? 0).toLocaleString()}
              </p>
            </div>
            {editing !== "budget" && (
              <button
                type="button"
                onClick={() => startEdit("budget")}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-transparent border border-border-main text-text-main hover:bg-row-hover active:scale-[0.98] transition-all"
              >
                Edit
              </button>
            )}
          </div>
          {editing === "budget" && (
            <div className="mt-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-main/60 font-semibold">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={draftBudget ?? ""}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    setDraftBudget(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
                  }}
                  className="w-full box-border pl-7 pr-3 py-2 text-base border border-border-main rounded-lg bg-input-bg text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              {draftBudget !== null && draftBudget > 0 && draftBudget < LOW_BUDGET_THRESHOLD && (
                <p className="text-xs text-yellow-200/80 mt-2">
                  Under ${LOW_BUDGET_THRESHOLD.toLocaleString()} — a broad index fund is often a
                  smart first move.
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  disabled={saving || draftBudget === null}
                  onClick={() => void saveField({ budget: draftBudget })}
                  className="px-4 py-1.5 rounded-md text-xs font-bold bg-gradient-to-r from-primary to-[#057a37] text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-1.5 rounded-md text-xs font-semibold border border-border-main text-text-main hover:bg-row-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Preferred sectors */}
        <div className="rounded-lg border border-border-main/30 bg-input-bg p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-text-main/50 mb-1">
                Preferred sectors
              </p>
              {profile && profile.preferred_sectors.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {profile.preferred_sectors.map((key) => (
                    <span
                      key={key}
                      className="px-2 py-0.5 rounded-md text-xs font-semibold bg-primary/15 text-primary"
                    >
                      {sectorLabel(key)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-base font-medium text-text-main/60">None</p>
              )}
            </div>
            {editing !== "sectors" && (
              <button
                type="button"
                onClick={() => startEdit("sectors")}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-transparent border border-border-main text-text-main hover:bg-row-hover active:scale-[0.98] transition-all"
              >
                Edit
              </button>
            )}
          </div>
          {editing === "sectors" && (
            <div className="mt-3">
              <SectorMatrix
                sectors={SECTORS}
                selected={draftSectors}
                onToggle={toggleDraftSector}
              />
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveField({ preferred_sectors: draftSectors })}
                  className="px-4 py-1.5 rounded-md text-xs font-bold bg-gradient-to-r from-primary to-[#057a37] text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-1.5 rounded-md text-xs font-semibold border border-border-main text-text-main hover:bg-row-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400 text-left" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
};

export default InvestorProfileSection;
