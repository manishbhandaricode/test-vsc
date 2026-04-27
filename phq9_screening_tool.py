"""Interactive PHQ-9 mental health screening command-line tool.

This program is intended for educational and informational screening only.
It is not a diagnosis and is not a substitute for professional care.
"""

from __future__ import annotations

import sys
import textwrap


DISCLAIMER = (
    "DISCLAIMER: This tool is for educational and informational screening purposes only. "
    "It is not a diagnostic tool and does not replace professional medical advice, "
    "diagnosis, or treatment. If you are in distress, please contact a mental health "
    "professional or an emergency hotline immediately."
)

PHQ9_QUESTIONS = [
    "Little interest or pleasure in doing things",
    "Feeling down, depressed, or hopeless",
    "Trouble falling or staying asleep, or sleeping too much",
    "Feeling tired or having little energy",
    "Poor appetite or overeating",
    "Feeling bad about yourself, or that you are a failure or have let yourself or your family down",
    "Trouble concentrating on things, such as reading the newspaper or watching television",
    "Moving or speaking so slowly that other people could have noticed, or the opposite: being so fidgety or restless that you have been moving around a lot more than usual",
    "Thoughts that you would be better off dead or of hurting yourself in some way",
]

RESPONSE_SCALE = {
    0: "Not at all",
    1: "Several days",
    2: "More than half the days",
    3: "Nearly every day",
}

TERMINAL_WIDTH = 76
BOLD = "\033[1m"
RESET = "\033[0m"


def print_divider(character: str = "=", width: int = TERMINAL_WIDTH) -> None:
    """Print a visual divider for readable terminal output."""
    print(character * width)


def print_wrapped(text: str, width: int = TERMINAL_WIDTH) -> None:
    """Print text wrapped to the configured terminal-friendly width."""
    print(textwrap.fill(text, width=width))


def print_disclaimer() -> None:
    """Print the required medical disclaimer at program start."""
    print_divider("=")
    print_wrapped(DISCLAIMER)
    print_divider("=")
    print()


def print_intro() -> None:
    """Explain the questionnaire instructions and response scale."""
    print("PHQ-9 Mental Health Screening")
    print_divider("-")
    print_wrapped("Over the last 2 weeks, how often have you been bothered by the following problems?")
    print()
    print("Please answer each question using this scale:")
    for score, label in RESPONSE_SCALE.items():
        print(f"  {score}: {label}")
    print()


def get_valid_score(question_number: int, question: str) -> int:
    """Prompt until the user enters a valid PHQ-9 response score from 0 to 3."""
    while True:
        print(f"Question {question_number}/9")
        print_wrapped(question)

        try:
            user_input = input("Your answer (0-3): ").strip()
        except EOFError:
            print()
            print("Input ended before the screening was completed. Exiting safely.")
            raise SystemExit(1) from None

        print()

        if user_input in {"0", "1", "2", "3"}:
            return int(user_input)

        print("Invalid input. Please enter only 0, 1, 2, or 3.")
        print()


def collect_responses() -> list[int]:
    """Ask all PHQ-9 questions and return the validated numeric responses."""
    responses = []

    for index, question in enumerate(PHQ9_QUESTIONS, start=1):
        responses.append(get_valid_score(index, question))

    return responses


def categorize_score(total_score: int) -> str:
    """Return the PHQ-9 depression severity category for a total score."""
    if total_score <= 4:
        return "Minimal depression"
    if total_score <= 9:
        return "Mild depression"
    if total_score <= 14:
        return "Moderate depression"
    if total_score <= 19:
        return "Moderately severe depression"
    return "Severe depression"


def should_show_crisis_message(responses: list[int], severity: str) -> bool:
    """Determine whether crisis resources should be shown.

    Crisis resources are shown when question 9 is greater than 0 or when the
    total score is in the severe range.
    """
    question_9_score = responses[8]
    return question_9_score > 0 or severity == "Severe depression"


def print_results(responses: list[int]) -> None:
    """Calculate and print PHQ-9 total score, severity, and safety resources."""
    # PHQ-9 scoring is the sum of the 9 item scores. Each item is scored 0-3,
    # so the total ranges from 0 to 27.
    total_score = sum(responses)
    severity = categorize_score(total_score)

    print_divider("=")
    print("Screening Result")
    print_divider("-")
    print(f"Total PHQ-9 score: {total_score}/27")
    print(f"Severity level: {severity}")
    print()
    print("This result is a screening indicator, not a diagnosis.")

    if should_show_crisis_message(responses, severity):
        print()
        print_divider("!")
        print(
            f"{BOLD}Please reach out for help. You can call or text 988 in the US/Canada, "
            "or find your local emergency number. If you may be in immediate danger, "
            f"contact emergency services now.{RESET}"
        )
        print_divider("!")

    print()
    print("Consider sharing these results with a qualified mental health professional.")
    print_divider("=")


def main() -> None:
    """Run the interactive PHQ-9 screening workflow."""
    try:
        print_disclaimer()
        print_intro()
        responses = collect_responses()
        print_results(responses)
    except KeyboardInterrupt:
        print()
        print()
        print("Screening interrupted. No result was calculated.")
        sys.exit(130)


if __name__ == "__main__":
    main()
