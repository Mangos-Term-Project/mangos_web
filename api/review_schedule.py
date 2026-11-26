"""Review schedule and coin rewards. PROPOSED values: change them here only.

The team's documented schedule was not found in the repository, so this uses a
standard Leitner-style schedule for the team to confirm or replace:

* A new card is due right away (box 0).
* A correct answer on a due card moves it up one box and schedules the next
  review after that box's interval: 1, 2, 4, 7, 14, then 30 days.
* A wrong answer sends the card back to box 0, so it is due again right away.
* Answers on cards that are not due yet are recorded but do not change the
  schedule or pay coins.

Coins are paid once per box a card reaches for the first time (at most six
times per card), so answering wrong and then right again cannot farm coins.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta

INTERVAL_DAYS = (1, 2, 4, 7, 14, 30)  # interval after reaching box 1..6
MAX_BOX = len(INTERVAL_DAYS)

CARD_CREATED_REWARD = 10  # PROPOSED: coins for saving a new card (once per word)
REVIEW_PROGRESS_REWARD = 2  # PROPOSED: coins when a card first reaches a new box


@dataclass(frozen=True)
class ReviewOutcome:
    box: int
    due_at: datetime
    schedule_changed: bool
    reward_key: str | None  # set when this answer may earn a reward


def next_review(box: int, due_at: datetime, correct: bool, now: datetime, flashcard_id: str) -> ReviewOutcome:
    if due_at > now:
        return ReviewOutcome(box=box, due_at=due_at, schedule_changed=False, reward_key=None)
    if not correct:
        return ReviewOutcome(box=0, due_at=now, schedule_changed=True, reward_key=None)
    new_box = min(box + 1, MAX_BOX)
    return ReviewOutcome(
        box=new_box,
        due_at=now + timedelta(days=INTERVAL_DAYS[new_box - 1]),
        schedule_changed=True,
        reward_key=f"review:{flashcard_id}:box{new_box}",
    )
