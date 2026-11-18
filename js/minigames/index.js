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
import seesaw from './seesaw.js';
import coins from './coins.js';
import laser from './laser.js';
import paint from './paint.js';
import kart from './kart.js';
import flight from './flight.js';
import finder from './finder.js';
import numbers from './numbers.js';
import redlight from './redlight.js';
import beat from './beat.js';
import stack from './stack.js';
import simon from './simon.js';
import cups from './cups.js';
import tug from './tug.js';
import curling from './curling.js';

// order = practice list order (grouped by control type)
export const MINIGAMES = [
  tiles, coins, laser, paint,          // 캐릭터 조작
  bumper, kart, flight,                // 탈것
  popper, finder, numbers,             // 마우스 / 터치
  stopwatch, redlight, beat, stack,    // 타이밍
  parade, simon, cups,                 // 기억 / 관찰
  seesaw, tug, curling,                // 물리
];
export const byId = (id) => MINIGAMES.find(m => m.id === id);
