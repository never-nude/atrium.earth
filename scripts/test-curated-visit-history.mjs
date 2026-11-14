import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const exhibitionSlug = 'the-work-of-the-surface';
const edition = JSON.parse(readFileSync(new URL('../src/data/curated-visits.json', import.meta.url))).visits[exhibitionSlug];
const base = `https://atrium.earth/exhibitions/${exhibitionSlug}/`;

class Element extends EventTarget {
  constructor(selectors = [], children = []) {
    super();
    this.selectors = selectors;
    this.children = children;
    this.dataset = {};
    this.attributes = new Map();
    this.firstChild = { textContent: '' };
    this.scrolls = 0;
  }
  querySelectorAll(selector) {
    const selectors = selector.split(', ');
    return this.children.flatMap(child => [
      ...(selectors.some(key => child.selectors.includes(key)) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  append(fragment) { this.children.push(...fragment.children); }
  replaceChildren() { this.children = []; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name) || this.selectors.includes(`[${name}]`); }
  focus() { document.activeElement = this; }
  scrollIntoView() { this.scrolls += 1; }
}

const element = (name, children) => new Element([`[${name}]`], children);
let fixtureNumber = 0;
async function fixture(start = base) {
  const data = element('data-visit-data');
  data.textContent = JSON.stringify({ ...edition, exhibitionSlug });
  const markers = edition.stops.map((_, index) => {
    const button = element('data-visit-step');
    button.dataset.visitStep = String(index);
    return button;
  });
  const templates = edition.stops.map(() => {
    const template = element('data-visit-template');
    template.content = { cloneNode() {
      const viewer = element('data-viewer'), region = new Element([], [viewer]);
      viewer.closest = () => region;
      const heading = element('data-visit-stop-heading');
      return new Element([], [element('data-visit-panel', [heading, region])]);
    } };
    return template;
  });
  const startButton = element('data-visit-start');
  const next = element('data-visit-next'), previous = element('data-visit-back');
  const restart = element('data-visit-restart'), complete = element('data-visit-complete-heading');
  const fullLink = element('data-visit-all'), launch = element('data-curated-launch');
  const host = element('data-visit-active');
  const root = element('data-curated-visit', [data, startButton, next, previous, restart, complete, fullLink, host,
    ...['data-visit-entrance', 'data-visit-session', 'data-visit-navigation', 'data-visit-completion', 'data-visit-status'].map(name => element(name)),
    ...markers, ...templates]);
  const fullHeading = element('data-exhibition-full-title');
  const full = element('data-exhibition-full', [fullHeading]);
  const doc = new Element([], [root, full, launch]);
  doc.readyState = 'complete';
  const win = new EventTarget();
  const stack = [start], frames = [];
  let cursor = 0, pushes = 0, replacements = 0, mounts = 0, disposals = 0;
  const move = offset => {
    cursor += offset;
    globalThis.location = new URL(stack[cursor]);
    win.dispatchEvent(new Event('popstate'));
  };
  Object.assign(globalThis, {
    document: doc, window: win, location: new URL(start), matchMedia: () => ({ matches: true }),
    requestAnimationFrame: run => frames.push(run),
    history: {
      state: null,
      replaceState(_state, _title, url) { replacements += 1; stack[cursor] = url.href; globalThis.location = new URL(url); },
      pushState(_state, _title, url) { pushes += 1; stack.splice(cursor + 1); stack.push(url.href); moveWithoutEvent(); },
    },
  });
  function moveWithoutEvent() { cursor += 1; globalThis.location = new URL(stack[cursor]); }
  doc.addEventListener('atrium:viewer-mount', event => { mounts += 1; assert.equal(event.detail.root, host.querySelector('[data-viewer]')); });
  doc.addEventListener('atrium:viewer-dispose', event => { disposals += 1; assert.equal(event.detail.root, host.querySelector('[data-viewer]')); });
  await import(`../src/scripts/curated-visit.js?fixture=${fixtureNumber++}`);
  return {
    startButton, next, previous, restart, root, host, full, fullLink, launch, complete, fullHeading, markers,
    back: () => move(-1), forward: () => move(1),
    flush: () => { while (frames.length) frames.shift()(); },
    stats: () => ({ pushes, replacements, mounts, disposals }),
  };
}

function click(element, options = {}) {
  const event = Object.assign(new Event('click', { cancelable: true }), { button: 0, ...options });
  element.dispatchEvent(event);
  return event;
}

const run = await fixture();
assert.equal(click(run.launch, { ctrlKey: true }).defaultPrevented, false);
click(run.startButton);
assert.equal(run.root.dataset.activeStep, '1');
click(run.next);
assert.equal(run.root.dataset.activeStep, '2');
click(run.markers[1]);
assert.deepEqual(run.stats(), { pushes: 2, replacements: 0, mounts: 2, disposals: 1 });
run.back();
run.flush();
assert.equal(run.root.dataset.activeStep, '1');
assert.equal(document.activeElement, run.host.querySelector('[data-visit-stop-heading]'));
run.forward();
assert.equal(run.root.dataset.activeStep, '2');
click(run.previous);
assert.equal(run.root.dataset.activeStep, '1');
run.back();
assert.equal(run.root.dataset.activeStep, '2');
click(run.markers[5]);
click(run.next);
assert.equal(run.root.dataset.visitState, 'complete');
assert.equal(run.host.querySelector('[data-viewer]'), null);
assert.equal(location.hash, '#curated-visit-complete');
run.back();
assert.equal(run.root.dataset.activeStep, '6');
run.forward();
assert.equal(document.activeElement, run.complete);
click(run.fullLink);
assert.equal(run.full.hidden, false);
assert.equal(location.hash, '#all-exhibition-works');
assert.equal(location.searchParams.has('visit'), false);
run.back();
assert.equal(run.root.dataset.visitState, 'complete');
assert.equal(run.full.hidden, true);
run.forward();
assert.equal(document.activeElement, run.fullHeading);
assert.equal(run.root.dataset.visitState, 'idle');
assert.equal(run.root.querySelector('[data-visit-status]').textContent, '');
assert.equal(run.stats().pushes, 6);
assert.equal(run.stats().replacements, 0, 'Back and Forward must leave the stack untouched');

const direct = await fixture(`${base}#curated-visit`);
direct.flush();
assert.equal(direct.root.dataset.activeStep, '1');
assert.deepEqual(direct.stats(), { pushes: 0, replacements: 1, mounts: 1, disposals: 0 });
assert.equal(document.activeElement, undefined, 'Initial navigation must not steal focus');
assert.equal(direct.root.scrolls, 1);
const returning = await fixture(`${base}?exhibition=${exhibitionSlug}&visit=${edition.id}&stop=4#curated-visit`);
assert.equal(returning.root.dataset.activeStep, '4');
assert.equal(returning.stats().pushes, 0);
const completed = await fixture(`${base}?visit=${edition.id}&stop=6#curated-visit-complete`);
assert.equal(completed.root.dataset.visitState, 'complete');
assert.equal(completed.stats().mounts, 0);
click(completed.restart);
assert.equal(completed.root.dataset.activeStep, '1');
completed.back();
assert.equal(completed.root.dataset.visitState, 'complete');
const invalid = await fixture(`${base}?visit=${edition.id}&stop=7#curated-visit`);
assert.equal(invalid.root.dataset.visitState, 'idle');
assert.equal(invalid.stats().mounts, 0);
console.log('Guided visit history passed for step changes, Back/Forward, completion, full exhibition, deep links and object return.');
