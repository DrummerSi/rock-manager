Each playable mission has one `missionXX-events.ts` module for its events, timers and choices. Mission01 contains the tutorial flow; Mission10 contains the free-play ending. The original catalog skips Mission02.

Shared mission code:

- `missions.ts`: creates a mission from its original starting snapshot.
- `mission-catalog.*`: original definitions, snapshots and event cards.
- `mission-events.ts`: dispatches events, expands dialog text and validates event state.
- `mission-event-types.ts`: event, queued-card, appointment and state types.
- `mission-event-actions.ts`: shared literal event-card actions.
- `mission-spending.ts`: tracks expenses used by mission rules.
- `mission-progress.ts`, `mission-endings.json`: objectives, completion, failure, scoring and endings.
- `career.ts`: campaign unlocks and saved scores.
- `media-reminders.ts`, `musician-quits.ts`: shared media requests and musician departures.

`missionXX-*.json` files contain recovered original data consumed by the corresponding event modules.

The saved field remains `state.scenario` so existing saves keep working; it stores mission event state. Intro presentation lives in `src/ui/mission-intro-sequence.ts`, with playback in `GameScene.playMissionIntro`.
