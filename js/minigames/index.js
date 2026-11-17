// Minigame registry. Add a new minigame: create a file exporting the module, then list it here.
//
// Module shape:
//   id, name, typeLabel, color, rule, controls: [[action, keys]], touch: {stick, a, aLabel}
//   init(game, rng) -> state
//   update(state, dt, inputs[4], game, rng, ended)   inputs: {mx,my,a,aP,aR,px,py,pDown,pP,upP,downP,leftP,rightP,num}
//   bot(state, i, game, rng) -> raw input for player i
//   render(ctx, state, game)
//   done(state) -> bool
//   scores(state) -> number[4] (higher is better; equal = tie)
//   detail(state, i) -> short result text
//   timeLeft(state)? hud(ctx, state, game)? preview(state, dt, game)?
import tiles from './tiles.js';
import bumper from './bumper.js';
import popper from './popper.js';
import stopwatch from './stopwatch.js';
import parade from './parade.js';
import cannon from './cannon.js';

export const MINIGAMES = [tiles, bumper, popper, stopwatch, parade, cannon];
export const byId = (id) => MINIGAMES.find(m => m.id === id);
