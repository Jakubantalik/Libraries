import { useEffect, useRef } from 'react';
import { BorderBeam } from 'border-beam';
import { MockChatInput, MockSubscribeButton, TaskCircleIcon } from './mocks';

// Working card for the showcase — a narrower variant with five shortened tasks
// (Figma working card), so the labels fit without wrapping.
const SHOWCASE_TASKS = [
  'Generate color palettes',
  'Recommend font pairings',
  'Create layout templates',
  'Build section engine',
  'Generate hero variants',
];

function ShowcaseWorkingCard() {
  return (
    <div className="mock-working" role="img" aria-label="Agent task list UI example with border beam effect">
      <div className="mock-working-header t-shimmer" data-text="Working...">Working...</div>
      <div className="mock-working-list">
        {SHOWCASE_TASKS.map((task) => (
          <div className="mock-working-row" key={task}>
            <TaskCircleIcon />
            <span>{task}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Search input — Figma node 524:691: a #1d1d1d pill with a magnifying-glass
// icon and a "Search or ask" placeholder.
function ShowcaseSearch() {
  return (
    <div className="sc-search" role="img" aria-label="Search input UI example with border beam effect">
      <svg className="sc-search-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M15.75 15.75L11.2501 11.25M12.75 7.5C12.75 10.3995 10.3995 12.75 7.5 12.75C4.6005 12.75 2.25 10.3995 2.25 7.5C2.25 4.6005 4.6005 2.25 7.5 2.25C10.3995 2.25 12.75 4.6005 12.75 7.5Z"
          stroke="#8B8B8B"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>Search or ask</span>
    </div>
  );
}

// The showcase reproduces the Figma frame (node 523:575) 1:1 as a fixed
// 926×657 rectangle centered on the page: a solid #121212 backdrop with a
// centered "Border beam / Pulse" title and the demo's UI examples positioned at
// their Figma coordinates, each wrapped with the pulse beam effect. The frame
// clips its content (overflow hidden) so the chat input bleeds off the right
// edge exactly as in the design. The stage scales down to fit small viewports.

const STAGE_W = 926;
const STAGE_H = 657;

export default function Showcase() {
  const stageRef = useRef<HTMLDivElement>(null);

  // Scale the fixed-size frame to fit the viewport (never upscale past 1:1).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      const scale = Math.min(
        1,
        (window.innerWidth - 48) / STAGE_W,
        (window.innerHeight - 48) / STAGE_H
      );
      stage.style.setProperty('--sc-scale', scale.toFixed(4));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <main className="sc-root">
      <div className="sc-stage" ref={stageRef}>
        <header className="sc-title" style={{ left: 356, top: 104, width: 182 }}>
          <span className="sc-title-sub">Border beam</span>
          <span className="sc-title-main">Pulse</span>
        </header>

        {/* Working card — contained pulse */}
        <div className="sc-item sc-item--working" style={{ top: 293 }}>
          <BorderBeam className="sc-beam" size="pulse-inner" colorVariant="colorful" theme="dark">
            <ShowcaseWorkingCard />
          </BorderBeam>
        </div>

        {/* Chat input — pulse-outside (same as demo page) */}
        <div className="sc-item" style={{ left: 676, top: 371 }}>
          <BorderBeam className="sc-beam" size="pulse-outside" colorVariant="colorful" theme="dark">
            <MockChatInput />
          </BorderBeam>
        </div>

        {/* Subscribe button — demo mock component */}
        <div className="sc-item" style={{ left: 93, top: 371 }}>
          <BorderBeam className="sc-beam sc-beam--pill" size="pulse-inner" colorVariant="colorful" theme="dark">
            <MockSubscribeButton />
          </BorderBeam>
        </div>

        {/* Search — contained mono pulse (Figma 524:691) */}
        <div className="sc-item" style={{ left: 28, top: 444 }}>
          <BorderBeam className="sc-beam" size="pulse-inner" colorVariant="mono" theme="dark">
            <ShowcaseSearch />
          </BorderBeam>
        </div>
      </div>
    </main>
  );
}
