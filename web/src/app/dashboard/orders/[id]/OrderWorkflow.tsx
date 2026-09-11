"use client";

import type { OrderStatus } from "@/lib/api/orders";

type StepState = "done" | "current" | "pending" | "cancelled";

type Step = { label: string; state: StepState };

/**
 * How far along an order is, as the stages the shop actually works through.
 *
 * <p>Not the same list as OrderStatus, deliberately. "Assign Employee" is a step a person performs
 * and can see is outstanding, but it is not a status — the order sits at Received either way. Work
 * cannot start until it is done, so leaving it out would show an order stuck between two lit steps
 * with nothing saying why.</p>
 *
 * <p>Cancelling is not a later stage, it is leaving the line. So a cancelled order keeps whatever it
 * genuinely completed, the stages it never reached stay unlit, and Cancelled is shown as its own
 * terminal marker rather than as the last step of a journey it did not make.</p>
 */
export function OrderWorkflow({ status, hasEmployee }: { status: OrderStatus; hasEmployee: boolean }) {
  const steps = buildSteps(status, hasEmployee);

  return (
    <ol className="flex flex-wrap items-center gap-y-3">
      {steps.map((step, index) => (
        <li key={step.label} className="flex items-center">
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${circleClass(step.state)}`}
          >
            {marker(step.state, index)}
          </span>

          <span
            // Marks where the order actually is for a screen reader, which cannot see the fill.
            aria-current={step.state === "current" || step.state === "cancelled" ? "step" : undefined}
            className={`ml-2 whitespace-nowrap text-sm ${labelClass(step.state)}`}
          >
            {step.label}
          </span>

          {index < steps.length - 1 && <span aria-hidden="true" className="mx-3 h-px w-6 bg-border sm:w-10" />}
        </li>
      ))}
    </ol>
  );
}

function buildSteps(status: OrderStatus, hasEmployee: boolean): Step[] {
  const isCancelled = status === "Cancelled";

  // How far the status itself has travelled. Cancelled carries no position of its own — an order
  // cancelled while in progress still genuinely started, and that is read off the steps below.
  const reached = status === "Delivered" ? 3 : status === "ReadyForDelivery" ? 2 : status === "InProgress" ? 1 : 0;

  const done = [
    // The order exists, so this one is complete by definition — it is here to give the line a start
    // the reader recognises rather than beginning mid-flow.
    true,
    hasEmployee,
    reached >= 1,
    reached >= 2,
    reached >= 3,
  ];

  const labels = ["Create Order", "Assign Employee", "In Progress", "Ready For Delivery", "Delivered"];

  // The first outstanding step is where the order is now. Everything after it is still ahead, even
  // where a later one happens to be satisfied — an unassigned order that somehow reached In Progress
  // should read as waiting on the assignment, not as further along than it is.
  const currentIndex = done.indexOf(false);

  const steps: Step[] = labels.map((label, index) => {
    if (done[index] && (currentIndex === -1 || index < currentIndex)) {
      return { label, state: "done" };
    }

    if (isCancelled) {
      return { label, state: "pending" };
    }

    return { label, state: index === currentIndex ? "current" : "pending" };
  });

  return isCancelled ? [...steps, { label: "Cancelled", state: "cancelled" }] : steps;
}

function circleClass(state: StepState): string {
  switch (state) {
    case "done":
      return "bg-primary text-primary-foreground";
    case "current":
      return "border-2 border-primary text-primary";
    case "cancelled":
      return "bg-danger text-white";
    default:
      return "border border-border text-foreground/40";
  }
}

function labelClass(state: StepState): string {
  switch (state) {
    case "done":
      return "text-foreground";
    case "current":
      return "font-medium text-foreground";
    case "cancelled":
      return "font-medium text-danger";
    default:
      return "text-foreground/45";
  }
}

function marker(state: StepState, index: number): string {
  if (state === "done") {
    return "✓";
  }

  if (state === "cancelled") {
    return "✕";
  }

  return String(index + 1);
}
