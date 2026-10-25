// One registry for every PTE Core task in the app: label, section, skills it feeds, content.
import WFD from '../content/wfd.js';
import RS from '../content/rs.js';
import RA from '../content/ra.js';
import RWFIB from '../content/rwfib.js';
import RFIB from '../content/rfib.js';
import ASQ from '../content/asq.js';
import RTS from '../content/rts.js';
import SWT from '../content/swt.js';
import SST from '../content/sst.js';
import EMAIL from '../content/email.js';
import DI from '../content/di.js';
import GRAM from '../content/grammar.js';
import { LFIB, HIW, REORDER, plainText } from './derived.js';

// skills: which PTE scores each task feeds (from Pearson's PTE Core task guide)
export const TASKS = {
  ra:    { label: 'Read Aloud', section: 'Speaking', skills: ['S', 'R'], per: 5, kind: 'speak', threshold: 0.8 },
  rs:    { label: 'Repeat Sentence', section: 'Speaking', skills: ['L', 'S'], per: 10, kind: 'speak', threshold: 0.8 },
  di:    { label: 'Describe Image', section: 'Speaking', skills: ['S'], per: 5, kind: 'open', threshold: 0.8 },
  rts:   { label: 'Respond to a Situation', section: 'Speaking', skills: ['S'], per: 5, kind: 'open', threshold: 0.8 },
  asq:   { label: 'Answer Short Question', section: 'Speaking', skills: ['L', 'S'], per: 10, kind: 'open', threshold: 1 },
  swt:   { label: 'Summarize Written Text', section: 'Writing', skills: ['R', 'W'], per: 2, kind: 'write', threshold: 0.8 },
  email: { label: 'Write Email', section: 'Writing', skills: ['W'], per: 1, kind: 'write', threshold: 0.8 },
  rwfib: { label: 'R&W Fill in the Blanks', section: 'Reading', skills: ['R', 'W'], per: 15, kind: 'fib', threshold: 1 },
  rfib:  { label: 'Reading Fill in the Blanks', section: 'Reading', skills: ['R'], per: 10, kind: 'fib', threshold: 1 },
  ro:    { label: 'Reorder Paragraph', section: 'Reading', skills: ['R'], per: 10, kind: 'obj', threshold: 1 },
  sst:   { label: 'Summarize Spoken Text', section: 'Listening', skills: ['L', 'W'], per: 3, kind: 'write', threshold: 0.8 },
  lfib:  { label: 'Listening Fill in the Blanks', section: 'Listening', skills: ['L', 'W'], per: 10, kind: 'obj', threshold: 1 },
  hiw:   { label: 'Highlight Incorrect Words', section: 'Listening', skills: ['L', 'R'], per: 10, kind: 'obj', threshold: 1 },
  wfd:   { label: 'Write From Dictation', section: 'Listening', skills: ['L', 'W'], per: 20, kind: 'dict', threshold: 1 },
  // Not a PTE task: feeds no PTE skill index, but is logged and reported like the others.
  gram:  { label: 'Grammar gym', section: 'Grammar', skills: [], per: 15, kind: 'gram', threshold: 1 },
};
export const TASK_KEYS = Object.keys(TASKS);
export const SECTIONS = ['Speaking', 'Writing', 'Reading', 'Listening', 'Grammar'];

export const ITEMS = {
  wfd: WFD, rs: RS, ra: RA, rwfib: RWFIB, rfib: RFIB, asq: ASQ, rts: RTS, swt: SWT, sst: SST, email: EMAIL, di: DI,
  lfib: LFIB, hiw: HIW, ro: REORDER, gram: GRAM,
};

// id → item, and id → reference text used by the coach report
export const BY_ID = Object.fromEntries(TASK_KEYS.map((k) => [k, Object.fromEntries(ITEMS[k].map((i) => [i.id, i]))]));
export const BANKS = Object.fromEntries(TASK_KEYS.map((k) => [k, Object.fromEntries(ITEMS[k].map((i) => [i.id, k === 'rwfib' || k === 'rfib' ? plainText(i.text) : k === 'hiw' ? i.audio : k === 'gram' ? i.q : i.text]))]));

export const REVIEW_SHARE = 0.4; // up to 40 % of a set can be yesterday's weak items
