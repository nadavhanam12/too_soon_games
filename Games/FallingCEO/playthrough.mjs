// FallingCEO ("Drop the Chip"): the story arc as it really is, and the bug check's playthrough (RULES 21ב,
// DECISIONS 69). This game is RULES 2א's counter-example: one endless stage, no "and then", so the arc has one beat
// and the run ends by falling to the floor. No bot: the run ends whatever the player does, which is what the check
// needs to see; the report marks the stage as played without input.

export const arc = {
  start: 'The CEO starts falling down the tower of headlines',
  stages: [
    { id: 'play', beat: 'Endless fall with headlines on the platforms; nothing changes but the speed', maxSeconds: 400 },
  ],
  end: 'The floor catches up: the same as the start, with a number',
  endsBy: 'end',
  maxSeconds: 420,
};

export const bot = {};
