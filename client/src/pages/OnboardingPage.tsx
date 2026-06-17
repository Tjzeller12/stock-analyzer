/**
 * OnboardingPage
 * Multi-step, scenario-based investor profiling flow. Owns useOnboardingManager
 * and renders the active step plus navigation. Soft-gated: the user can skip and
 * still reach /main (design Property P4).
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/common/Card";
import BudgetStep from "../components/onboarding/BudgetStep";
import OnboardingProgressBar from "../components/onboarding/OnboardingProgressBar";
import ReviewStep from "../components/onboarding/ReviewStep";
import ScenarioQuestionCard from "../components/onboarding/ScenarioQuestionCard";
import SectorMatrix from "../components/onboarding/SectorMatrix";
import { HORIZON_OPTIONS, QUESTIONNAIRE } from "../constants/onboarding";
import { SECTORS } from "../constants/sectors";
import { useOnboardingManager } from "../hooks/useOnboardingManager";
import { ONBOARDING_DISMISSED_KEY } from "../hooks/useOnboardingGate";
import logo from "../resources/alphaBotLogo.png";

const STEP_LABELS_BY_KIND: Record<string, string> = {
  welcome: "Welcome",
  question: "About you",
  horizon: "Time horizon",
  budget: "Budget",
  sectors: "Sectors",
  review: "Review",
};

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const manager = useOnboardingManager();
  const {
    draft,
    steps,
    currentStep,
    stepIndex,
    totalSteps,
    isFirstStep,
    isLastStep,
    answerQuestion,
    setTimeHorizon,
    setBudget,
    toggleSector,
    next,
    back,
    previewProfile,
    canAdvance,
    submit,
    submitting,
    error,
  } = manager;

  const labels = steps.map((s) => STEP_LABELS_BY_KIND[s.kind] ?? "");

  const handleFinish = async () => {
    try {
      await submit();
      sessionStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
      navigate("/main");
    } catch {
      /* error surfaced via manager.error */
    }
  };

  const handleSkip = () => {
    // Remember the dismissal so the soft gate doesn't bounce them back this session.
    sessionStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
    navigate("/main");
  };

  const renderStep = () => {
    switch (currentStep.kind) {
      case "welcome":
        return (
          <div className="text-center py-6">
            <h2 className="text-3xl font-extrabold mb-3 text-text-main">
              Let's tailor AlphaBot to you
            </h2>
            <p className="text-text-main/60 max-w-md mx-auto">
              A few quick, scenario-based questions help us understand how you like to
              invest — no boring bank forms. It takes about a minute, and you can change
              your answers anytime.
            </p>
          </div>
        );

      case "question": {
        const question = QUESTIONNAIRE.find((q) => q.id === currentStep.questionId);
        if (!question) return null;
        return (
          <ScenarioQuestionCard
            question={question}
            selectedOptionId={draft.answers[question.id] ?? null}
            onSelect={(optionId) => answerQuestion(question.id, optionId)}
          />
        );
      }

      case "horizon":
        return (
          <div className="text-left">
            <h2 className="text-2xl font-bold mb-2 text-text-main">
              How long do you plan to invest?
            </h2>
            <p className="text-sm text-text-main/60 mb-5">
              Your time horizon shapes how much short-term volatility makes sense for you.
            </p>
            <div className="flex flex-col gap-3">
              {HORIZON_OPTIONS.map((opt) => {
                const isSelected = draft.timeHorizonYears === opt.years;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTimeHorizon(opt.years)}
                    aria-pressed={isSelected}
                    className={`w-full text-left px-4 py-3.5 rounded-lg border transition-all duration-150 flex items-center gap-3 ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                        : "border-border-main/30 bg-input-bg hover:border-text-main/40 hover:bg-row-hover"
                    }`}
                  >
                    <span
                      className={`flex-none w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? "border-primary" : "border-text-main/40"
                      }`}
                    >
                      {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </span>
                    <span className="text-sm font-medium text-text-main">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case "budget":
        return <BudgetStep value={draft.budget} onChange={setBudget} />;

      case "sectors":
        return (
          <SectorMatrix
            sectors={SECTORS}
            selected={draft.selectedSectors}
            onToggle={toggleSector}
          />
        );

      case "review": {
        const preview = previewProfile();
        return (
          <ReviewStep
            preview={{
              risk_tag: preview.risk_tag,
              horizon_tag: preview.horizon_tag,
              budget: draft.budget,
              preferred_sectors: draft.selectedSectors,
            }}
          />
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col justify-center items-center p-5 font-sans min-h-screen bg-background text-text-main relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/20 blur-[100px] -z-10 animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-400/10 blur-[100px] -z-10 animate-pulse delay-1000"></div>

      <img src={logo} alt="AlphaBot" className="max-h-[70px] w-auto mb-4" />

      <Card
        variant="glass"
        className="w-full max-w-[560px] p-8 shadow-2xl border-white/20 relative z-10"
      >
        <OnboardingProgressBar current={stepIndex} total={totalSteps} labels={labels} />

        <div className="min-h-[300px]">{renderStep()}</div>

        {error && (
          <p className="mt-4 text-sm text-red-400 text-center" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border-main/20 pt-4">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs font-medium text-text-main/50 hover:text-text-main transition-colors"
          >
            Skip for now
          </button>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={back}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-transparent border border-border-main text-text-main hover:bg-row-hover active:scale-[0.98] transition-all disabled:opacity-50"
              >
                Back
              </button>
            )}
            {isLastStep ? (
              <button
                type="button"
                onClick={() => void handleFinish()}
                disabled={submitting}
                className="px-5 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-primary to-[#057a37] text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Finish"}
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                disabled={!canAdvance}
                className="px-5 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-primary to-[#057a37] text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default OnboardingPage;
