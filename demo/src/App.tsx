import { useState, useCallback, useId, useRef, useLayoutEffect, useEffect } from 'react';
import { highlightCode } from './utils';
import { BorderBeam, type BorderBeamSize, type BorderBeamColorVariant } from 'border-beam';
import {
  MockChatInput,
  MockWorkingCard,
  MockSubscribeButton,
  MockIconButton,
  MockSearchBar,
} from './mocks';

function CopyIcon() {
  return (
    <svg className="icon-copy" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="icon-check" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M4.5 2.5v11l9-5.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <rect x="4" y="3" width="3" height="10" rx="1" />
      <rect x="9" y="3" width="3" height="10" rx="1" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" width="15" height="16" viewBox="0 0 1200 1227">
      <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill="currentColor" d="M6.04458 1.60806C6.1589 1.35528 6.10472 1.05812 5.90855 0.861947C5.71237 0.665775 5.41522 0.611597 5.16244 0.725914C2.51258 1.92428 0.666626 4.59176 0.666626 7.69181C0.666626 11.9121 4.08786 15.3334 8.30817 15.3334C11.4082 15.3334 14.0757 13.4874 15.2741 10.8375C15.3884 10.5848 15.3342 10.2876 15.138 10.0914C14.9419 9.89526 14.6447 9.84108 14.3919 9.9554C13.6009 10.3131 12.7225 10.5126 11.7956 10.5126C8.31168 10.5126 5.4874 7.6883 5.4874 4.20438C5.4874 3.27752 5.68686 2.39905 6.04458 1.60806Z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill="currentColor" d="M8.66663 1.33333C8.66663 0.965143 8.36815 0.666666 7.99996 0.666666C7.63177 0.666666 7.33329 0.965143 7.33329 1.33333V2.66667C7.33329 3.03486 7.63177 3.33333 7.99996 3.33333C8.36815 3.33333 8.66663 3.03486 8.66663 2.66667V1.33333Z" />
      <path fill="currentColor" d="M8.66663 13.3333C8.66663 12.9651 8.36815 12.6667 7.99996 12.6667C7.63177 12.6667 7.33329 12.9651 7.33329 13.3333V14.6667C7.33329 15.0349 7.63177 15.3333 7.99996 15.3333C8.36815 15.3333 8.66663 15.0349 8.66663 14.6667V13.3333Z" />
      <path fill="currentColor" d="M0.666626 8C0.666626 7.63181 0.965103 7.33333 1.33329 7.33333H2.66663C3.03482 7.33333 3.33329 7.63181 3.33329 8C3.33329 8.36819 3.03482 8.66667 2.66663 8.66667H1.33329C0.965103 8.66667 0.666626 8.36819 0.666626 8Z" />
      <path fill="currentColor" d="M3.73797 2.7952C3.47762 2.53485 3.05551 2.53485 2.79516 2.7952C2.53481 3.05555 2.53481 3.47766 2.79516 3.73801L3.73797 4.68081C3.99831 4.94116 4.42042 4.94116 4.68077 4.68081C4.94112 4.42046 4.94112 3.99836 4.68077 3.73801L3.73797 2.7952Z" />
      <path fill="currentColor" d="M13.2048 2.7952C13.4651 3.05555 13.4651 3.47766 13.2048 3.73801L12.262 4.68081C12.0016 4.94116 11.5795 4.94116 11.3192 4.68081C11.0588 4.42046 11.0588 3.99836 11.3192 3.73801L12.262 2.7952C12.5223 2.53485 12.9444 2.53485 13.2048 2.7952Z" />
      <path fill="currentColor" d="M4.68077 12.2647C4.94112 12.0043 4.94112 11.5822 4.68077 11.3219C4.42042 11.0615 3.99831 11.0615 3.73797 11.3219L2.79516 12.2647C2.53481 12.525 2.53481 12.9472 2.79516 13.2075C3.05551 13.4679 3.47762 13.4679 3.73797 13.2075L4.68077 12.2647Z" />
      <path fill="currentColor" d="M11.3192 11.3219C11.5795 11.0615 12.0016 11.0615 12.262 11.3219L13.2048 12.2647C13.4651 12.525 13.4651 12.9472 13.2048 13.2075C12.9444 13.4679 12.5223 13.4679 12.262 13.2075L11.3192 12.2647C11.0588 12.0043 11.0588 11.5822 11.3192 11.3219Z" />
      <path fill="currentColor" d="M13.3333 7.33333C12.9651 7.33333 12.6666 7.63181 12.6666 8C12.6666 8.36819 12.9651 8.66667 13.3333 8.66667H14.6666C15.0348 8.66667 15.3333 8.36819 15.3333 8C15.3333 7.63181 15.0348 7.33333 14.6666 7.33333H13.3333Z" />
      <path fill="currentColor" d="M7.99996 4C5.79082 4 3.99996 5.79086 3.99996 8C3.99996 10.2091 5.79082 12 7.99996 12C10.2091 12 12 10.2091 12 8C12 5.79086 10.2091 4 7.99996 4Z" />
    </svg>
  );
}

function HeaderIcon() {
  return (
    <div className="header-icon" aria-hidden="true">
      <img
        className="header-icon-img header-icon-img--dark"
        src={`${import.meta.env.BASE_URL}icon-web.png`}
        alt=""
        width={207}
        height={138}
      />
      <img
        className="header-icon-img header-icon-img--light"
        src={`${import.meta.env.BASE_URL}icon-web-light.png`}
        alt=""
        width={207}
        height={138}
      />
    </div>
  );
}

// Copy button with a dual-icon (copy ⇄ check) crossfade and a "Copy code"
// ⇄ "Copied" tooltip pill whose width tweens between the two labels. The
// label widths are measured once after mount and exposed as --tt-w-a /
function ReactIcon() {
  return (
    <svg viewBox="0 0 122.88 109.43" style={{ width: '14px', height: '14px', fill: '#00D8FF', display: 'inline-block' }} aria-hidden="true">
      <g>
        <path fillRule="evenodd" clipRule="evenodd" d="M122.88,54.73c0-8.14-10.19-15.85-25.82-20.64c3.61-15.93,2-28.6-5.06-32.66c-1.63-0.95-3.53-1.4-5.61-1.4 v5.59c1.15,0,2.08,0.23,2.86,0.65c3.41,1.95,4.88,9.39,3.73,18.96c-0.28,2.35-0.73,4.83-1.28,7.36c-4.91-1.2-10.27-2.13-15.9-2.73 c-3.38-4.63-6.89-8.84-10.42-12.52C73.54,9.74,81.2,5.59,86.41,5.59V0l0,0c-6.89,0-15.9,4.91-25.02,13.43 C52.27,4.96,43.26,0.1,36.37,0.1v5.59c5.18,0,12.87,4.13,21.04,11.67c-3.51,3.68-7.01,7.86-10.34,12.5 c-5.66,0.6-11.02,1.53-15.93,2.75c-0.58-2.5-1-4.93-1.3-7.26c-1.18-9.57,0.28-17.01,3.66-18.99c0.75-0.45,1.73-0.65,2.88-0.65V0.13 l0,0c-2.1,0-4.01,0.45-5.66,1.4c-7.04,4.06-8.62,16.71-4.98,32.59C10.14,38.92,0,46.61,0,54.73c0,8.14,10.19,15.85,25.82,20.64c-3.61,15.93-2,28.6,5.06,32.66c1.63,0.95,3.53,1.4,5.64,1.4c6.89,0,15.9-4.91,25.02-13.43c9.12,8.47,18.13,13.33,25.02,13.33 c2.1,0,4.01-0.45,5.66-1.4c7.04-4.06,8.62-16.71,4.98-32.59C112.74,70.56,122.88,62.84,122.88,54.73L122.88,54.73z M72.86,54.73 c0-6.32-5.12-11.45-11.45-11.45c-6.32,0-11.45,5.12-11.45,11.45s5.12,11.45,11.45,11.45C67.74,66.17,72.86,61.05,72.86,54.73 L72.86,54.73z M36.34,0.1L36.34,0.1L36.34,0.1L36.34,0.1z M90.27,38.02c-0.93,3.23-2.08,6.56-3.38,9.89c-1.03-2-2.1-4.01-3.28-6.01 c-1.15-2-2.38-3.96-3.61-5.86C83.56,36.57,86.99,37.22,90.27,38.02L90.27,38.02z M78.8,64.7c-1.95,3.38-3.96,6.59-6.04,9.57 c-3.73,0.33-7.51,0.5-11.32,0.5c-3.78,0-7.56-0.18-11.27-0.48c-2.08-2.98-4.11-6.16-6.06-9.52c-1.9-3.28-3.63-6.61-5.21-9.97 c1.55-3.36,3.31-6.71,5.18-9.99c1.95-3.38,3.96-6.59,6.04-9.57c3.73-0.33,7.51-0.5,11.32-0.5c3.78,0,7.56,0.18,11.27,0.48 c2.08,2.98,4.11,6.16,6.06,9.52c1.9,3.28,3.63,6.61,5.21,9.97C82.4,58.06,80.68,61.41,78.8,64.7L78.8,64.7z M86.89,61.44 c1.35,3.36,2.5,6.71,3.46,9.97c-3.28,0.8-6.74,1.48-10.32,2c1.23-1.93,2.45-3.91,3.61-5.94C84.78,65.47,85.86,63.44,86.89,61.44 L86.89,61.44z M61.49,88.16c-2.33-2.4-4.66-5.08-6.96-8.01c2.25,0.1,4.56,0.18,6.89,0.18c2.35,0,4.68-0.05,6.96-0.18 C66.12,83.08,63.79,85.76,61.49,88.16L61.49,88.16z M42.86,73.41c-3.56-0.53-6.99-1.18-10.27-1.98c0.93-3.23,2.08-6.56,3.38-9.89 c1.03,2,2.1,4.01,3.28,6.01C40.43,69.56,41.63,71.51,42.86,73.41L42.86,73.41z M61.36,21.29c2.33,2.4,4.66,5.08,6.96,8.01 c-2.25-0.1-4.56-0.18-6.89-0.18c-2.35,0-4.68,0.05-6.96,0.18C56.73,26.37,59.06,23.69,61.36,21.29L61.36,21.29z M42.83,36.04 c-1.23,1.93-2.45,3.91-3.61,5.94c-1.15,2-2.23,4.01-3.26,6.01c-1.35-3.36-2.5-6.71-3.46-9.97C35.79,37.24,39.25,36.57,42.83,36.04 L42.83,36.04z M20.16,67.4c-8.87-3.78-14.6-8.74-14.6-12.67c0-3.93,5.74-8.92,14.6-12.67c2.15-0.93,4.51-1.75,6.94-2.53 c1.43,4.91,3.31,10.02,5.64,15.25c-2.3,5.21-4.16,10.29-5.56,15.18C24.7,69.18,22.34,68.33,20.16,67.4L20.16,67.4z M33.64,103.19 c-3.41-1.95-4.88-9.39-3.73-18.96c0.28-2.35,0.73-4.83,1.28-7.36c4.91,1.2,10.27,2.13,15.9,2.73c3.38,4.63,6.89,8.84,10.42,12.52 c-8.17,7.59-15.83,11.75-21.04,11.75C35.34,103.84,34.39,103.62,33.64,103.19L33.64,103.19z M93.05,84.11 c1.18,9.57-0.28,17.01-3.66,18.99c-0.75,0.45-1.73,0.65-2.88,0.65c-5.18,0-12.87-4.13-21.04-11.67c3.51-3.68,7.01-7.86,10.34-12.5 c5.66-0.6,11.02-1.53,15.93-2.76C92.32,79.35,92.77,81.78,93.05,84.11L93.05,84.11z M102.69,67.4c-2.15,0.93-4.51,1.75-6.94,2.53 c-1.43-4.91-3.31-10.02-5.64-15.25c2.3-5.21,4.16-10.29,5.56-15.18c2.48,0.78,4.83,1.63,7.04,2.55c8.87,3.78,14.6,8.74,14.6,12.67 C117.29,58.66,111.56,63.64,102.69,67.4L102.69,67.4z"/>
      </g>
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" style={{ width: '14px', height: '14px', display: 'inline-block' }} aria-hidden="true">
      <path d="M6.96967 7.46967C7.26256 7.17678 7.73744 7.17678 8.03033 7.46967L12.0303 11.4697C12.3232 11.7626 12.3232 12.2374 12.0303 12.5303L8.03033 16.5303C7.73744 16.8232 7.26256 16.8232 6.96967 16.5303C6.67678 16.2374 6.67678 15.7626 6.96967 15.4697L10.4393 12L6.96967 8.53033C6.67678 8.23744 6.67678 7.76256 6.96967 7.46967Z" fill="currentColor" />
      <path d="M11.5 15.25C11.0858 15.25 10.75 15.5858 10.75 16C10.75 16.4142 11.0858 16.75 11.5 16.75H16.5C16.9142 16.75 17.25 16.4142 17.25 16C17.25 15.5858 16.9142 15.25 16.5 15.25H11.5Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M8.367 1.25H15.633C16.7251 1.24999 17.5906 1.24999 18.2883 1.30699C19.0017 1.36527 19.6053 1.48688 20.1565 1.76772C21.0502 2.22312 21.7769 2.94978 22.2323 3.84355C22.5131 4.39472 22.6347 4.99834 22.693 5.71173C22.75 6.40935 22.75 7.27484 22.75 8.36698V15.633C22.75 16.7252 22.75 17.5906 22.693 18.2883C22.6347 19.0017 22.5131 19.6053 22.2323 20.1565C21.7769 21.0502 21.0502 21.7769 20.1565 22.2323C19.6053 22.5131 19.0017 22.6347 18.2883 22.693C17.5906 22.75 16.7252 22.75 15.633 22.75H8.36698C7.27484 22.75 6.40935 22.75 5.71173 22.693C4.99834 22.6347 4.39472 22.5131 3.84355 22.2323C2.94978 21.7769 2.22312 21.0502 1.76772 20.1565C1.48688 19.6053 1.36527 19.0017 1.30699 18.2883C1.24999 17.5906 1.24999 16.7252 1.25 15.633V8.367C1.24999 7.27486 1.24999 6.40935 1.30699 5.71173C1.36527 4.99834 1.48688 4.39472 1.76772 3.84355C2.22312 2.94978 2.94978 2.22312 3.84355 1.76772C4.39472 1.48688 4.99834 1.36527 5.71173 1.30699C6.40935 1.24999 7.27486 1.24999 8.367 1.25ZM5.83388 2.80201C5.21325 2.85271 4.829 2.94909 4.52453 3.10423C3.913 3.41582 3.41582 3.913 3.10423 4.52453C2.94909 4.829 2.85271 5.21325 2.80201 5.83388C2.75058 6.46327 2.75 7.26752 2.75 8.4V15.6C2.75 16.7325 2.75058 17.5367 2.80201 18.1661C2.85271 18.7867 2.85271 19.171 3.10423 19.4755C3.41582 20.087 3.913 20.5842 4.52453 20.8958C4.829 21.0509 5.21325 21.1473 5.83388 21.198C6.46327 21.2494 7.26752 21.25 8.4 21.25H15.6C16.7325 21.25 17.5367 21.2494 18.1661 21.198C18.7867 21.1473 19.171 21.0509 19.4755 20.8958C20.087 20.5842 20.5842 20.087 20.8958 19.4755C21.0509 19.171 21.1473 18.7867 21.198 18.1661C21.2494 17.5367 21.25 16.7325 21.25 15.6V8.4C21.25 7.26752 21.2494 6.46327 21.198 5.83388C21.1473 5.21325 21.0509 4.829 20.8958 4.52453C20.5842 3.913 20.087 3.41582 19.4755 3.10423C19.171 2.94909 18.7867 2.85271 18.1661 2.80201C17.5367 2.75058 16.7325 2.75 15.6 2.75H8.4C7.26752 2.75 6.46327 2.75058 5.83388 2.80201Z" fill="currentColor"/>
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const writeText = async (value: string): Promise<boolean> => {
      if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(value);
          return true;
        } catch {
          // fall through
        }
      }
      if (typeof document === 'undefined') return false;
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.width = '1px';
      ta.style.height = '1px';
      ta.style.padding = '0';
      ta.style.border = 'none';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, value.length);
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
      return ok;
    };

    const ok = await writeText(text);
    if (!ok) return;
    setCopied(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  }, [text]);

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy code'}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span>{copied ? 'Copied' : 'Copy code'}</span>
    </button>
  );
}

type BeamFamily = 'rotate' | 'pulse';

const FAMILY_OPTIONS: { value: BeamFamily; label: string }[] = [
  { value: 'rotate', label: 'Rotate' },
  { value: 'pulse', label: 'Pulse' },
];

const ROTATE_SIZE_OPTIONS: { value: BorderBeamSize; label: string }[] = [
  { value: 'md', label: 'Large' },
  { value: 'sm', label: 'Small' },
  { value: 'line', label: 'Line' },
];

const PULSE_SIZE_OPTIONS: { value: BorderBeamSize; label: string }[] = [
  { value: 'pulse-inner', label: 'Pulse Inner' },
  { value: 'pulse-outside', label: 'Pulse Outside' },
];

const SIZE_OPTIONS_BY_FAMILY: Record<BeamFamily, { value: BorderBeamSize; label: string }[]> = {
  rotate: ROTATE_SIZE_OPTIONS,
  pulse: PULSE_SIZE_OPTIONS,
};

const DEFAULT_SIZE_BY_FAMILY: Record<BeamFamily, BorderBeamSize> = {
  rotate: 'md',
  pulse: 'pulse-inner',
};

// URL <-> tab mapping. `/pulse` deep-links to the Pulse tab; everything else
// (including `/`) is Rotate. GitHub Pages serves the SPA fallback (404.html)
// so a direct visit to /pulse resolves before React mounts.
function familyFromPath(pathname: string): BeamFamily {
  return /\/pulse\/?$/i.test(pathname) ? 'pulse' : 'rotate';
}

function pathForFamily(family: BeamFamily): string {
  return family === 'pulse' ? '/pulse' : '/';
}

type ThemeMode = 'dark' | 'light';

// Light mode is a dev-only affordance: the live site ships dark-only, so the
// toggle is hidden and the theme is forced to dark in production builds.
const LIGHT_MODE_ENABLED = !import.meta.env.PROD;

// Initial theme: respect the value the inline boot script already wrote to
// <html data-theme> (avoids a flash), then localStorage, defaulting to dark.
function getInitialTheme(): ThemeMode {
  if (!LIGHT_MODE_ENABLED) return 'dark';
  const fromAttr = document.documentElement.dataset.theme;
  if (fromAttr === 'light' || fromAttr === 'dark') return fromAttr;
  const stored = localStorage.getItem('theme');
  return stored === 'light' ? 'light' : 'dark';
}

const COLOR_OPTIONS: { value: BorderBeamColorVariant; label: string }[] = [
  { value: 'colorful', label: 'Colorful' },
  { value: 'mono', label: 'Mono' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'sunset', label: 'Sunset' },
];

export default function App() {
  const [family, setFamily] = useState<BeamFamily>(() => familyFromPath(window.location.pathname));
  const [playgroundActive, setPlaygroundActive] = useState(true);
  const [playgroundSize, setPlaygroundSize] = useState<BorderBeamSize>(
    () => DEFAULT_SIZE_BY_FAMILY[familyFromPath(window.location.pathname)]
  );
  const [playgroundColorVariant, setPlaygroundColorVariant] = useState<BorderBeamColorVariant>('colorful');
  const [playgroundStrength, setPlaygroundStrength] = useState(70);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const strengthId = useId();

  // Reflect the active theme on <html> and persist the choice.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const sizeOptions = SIZE_OPTIONS_BY_FAMILY[family];
  const isPulse = family === 'pulse';
  const rotateTabActive = family === 'rotate';
  const pulseTabActive = family === 'pulse';

  const handleFamilyChange = useCallback((next: BeamFamily) => {
    setFamily(next);
    setPlaygroundSize(DEFAULT_SIZE_BY_FAMILY[next]);
    const path = pathForFamily(next);
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, []);

  // Keep the tab in sync with browser back/forward navigation.
  useEffect(() => {
    const onPopState = () => {
      const next = familyFromPath(window.location.pathname);
      setFamily(next);
      setPlaygroundSize(DEFAULT_SIZE_BY_FAMILY[next]);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Sliding tab pill (transitions.dev — tabs sliding). animate=false snaps
  // without a transition (first paint / resize); animate=true tweens.
  const tabListRef = useRef<HTMLElement>(null);
  const tabPillRef = useRef<HTMLSpanElement>(null);
  const tabPillReady = useRef(false);

  const moveTabPill = useCallback((animate: boolean) => {
    const pill = tabPillRef.current;
    const list = tabListRef.current;
    if (!pill || !list) return;
    const activeTab = list.querySelector<HTMLButtonElement>('.tab-btn[data-active="true"]');
    if (!activeTab) return;
    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = 'none';
      pill.style.transform = `translateX(${activeTab.offsetLeft}px)`;
      pill.style.width = `${activeTab.offsetWidth}px`;
      void pill.offsetWidth; // force reflow before restoring
      pill.style.transition = prev;
    } else {
      pill.style.transform = `translateX(${activeTab.offsetLeft}px)`;
      pill.style.width = `${activeTab.offsetWidth}px`;
    }
  }, []);

  useLayoutEffect(() => {
    moveTabPill(tabPillReady.current);
    tabPillReady.current = true;
  }, [family, moveTabPill]);

  useEffect(() => {
    const onResize = () => moveTabPill(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [moveTabPill]);

  const installCmd = 'npm install border-beam';
  const usageCode = `import { BorderBeam } from 'border-beam';

<BorderBeam>
  <YourCard>Content</YourCard>
</BorderBeam>`;
  const playgroundCode = `<BorderBeam size="${playgroundSize}" colorVariant="${playgroundColorVariant}"${playgroundStrength < 100 ? ` strength={${playgroundStrength / 100}}` : ''}>
  <Card>Content</Card>
</BorderBeam>`;

  const rotateExamples = (
    <>
      <div className="example-row-full">
        <BorderBeam className="beam-host" size="md" colorVariant="colorful" theme={theme} active={rotateTabActive}>
          <MockChatInput />
        </BorderBeam>
      </div>
      <div className="example-row-split">
        <div className="example-cell">
          <BorderBeam className="beam-host" size="sm" colorVariant="colorful" theme={theme} active={rotateTabActive}>
            <MockIconButton />
          </BorderBeam>
        </div>
        <div className="example-cell">
          <BorderBeam
            className="beam-host"
            size="line"
            colorVariant="colorful"
            theme={theme}
            active={rotateTabActive}
            duration={3.1}
            borderRadius={20}
          >
            <MockSearchBar />
          </BorderBeam>
        </div>
      </div>
    </>
  );

  const pulseExamples = (
    <>
      <div className="example-row-full">
        <BorderBeam className="beam-host beam-host--soft" size="pulse-inner" colorVariant="colorful" theme={theme} active={pulseTabActive}>
          <MockWorkingCard />
        </BorderBeam>
      </div>
      <div className="example-row-split">
        <div className="example-cell">
          <BorderBeam className="beam-host beam-host--pill" size="pulse-inner" colorVariant="colorful" theme={theme} active={pulseTabActive}>
            <MockSubscribeButton />
          </BorderBeam>
        </div>
        <div className="example-cell">
          <BorderBeam className="beam-host" size="pulse-outside" colorVariant="colorful" theme={theme} active={pulseTabActive}>
            <MockChatInput />
          </BorderBeam>
        </div>
      </div>
    </>
  );

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <main id="main-content" className="app">
        <header className="header">
          <nav aria-label="External links" className="top-bar-links">
            {LIGHT_MODE_ENABLED && (
              <button
                type="button"
                className="icon-btn theme-toggle"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <span
                  className="theme-icon-stack"
                  data-active={theme === 'dark' ? 'sun' : 'moon'}
                  aria-hidden="true"
                >
                  <MoonIcon className="theme-icon theme-icon-moon" />
                  <SunIcon className="theme-icon theme-icon-sun" />
                </span>
              </button>
            )}
            <a className="icon-btn" href="https://github.com/Jakubantalik/border-beam" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository">
              <GitHubIcon />
            </a>
            <a className="icon-btn" href="https://x.com/jakubantalik" target="_blank" rel="noopener noreferrer" aria-label="Follow on X (Twitter)">
              <XIcon />
            </a>
          </nav>
          <HeaderIcon />
          <h1 className="title">Border beam</h1>
          <p className="subtitle-sm">Animated border beam component</p>
        </header>

        <nav className="tab-nav" role="tablist" aria-label="Effect family" ref={tabListRef}>
          <span className="tab-nav-pill" aria-hidden="true" ref={tabPillRef} />
          {FAMILY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              className="tab-btn"
              role="tab"
              aria-selected={family === value}
              data-active={family === value}
              onClick={() => handleFamilyChange(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        <section
          className="examples-section t-page-slide"
          data-page={family === 'rotate' ? '1' : '2'}
          aria-label="Effect demonstrations"
        >
          <div
            className="t-page examples-page examples-page--rotate"
            data-page-id="1"
            aria-hidden={family !== 'rotate'}
          >
            {rotateExamples}
          </div>
          <div
            className="t-page examples-page examples-page--pulse"
            data-page-id="2"
            aria-hidden={family !== 'pulse'}
          >
            {pulseExamples}
          </div>
        </section>

        <section className="section" aria-label="Installation">
          <h2 className="section-title">Installation</h2>
          <div className="code-explorer">
            <div className="code-header">
              <div className="code-tabs">
                <TerminalIcon />
                <span>Terminal</span>
              </div>
              <CopyButton text={installCmd} />
            </div>
            <div className="code-content">
              <code dangerouslySetInnerHTML={{ __html: highlightCode(installCmd, 'bash') }} />
            </div>
          </div>
        </section>

        <section className="section" aria-label="Usage">
          <h2 className="section-title section-title--muted">Usage</h2>
          <div className="code-explorer">
            <div className="code-header">
              <div className="code-tabs">
                <ReactIcon />
                <span>React</span>
              </div>
              <CopyButton text={usageCode} />
            </div>
            <div className="code-content">
              <code dangerouslySetInnerHTML={{ __html: highlightCode(usageCode, 'tsx') }} />
            </div>
          </div>
        </section>

        <section className="playground-section" aria-label="Interactive playground">
          <h2 className="section-title">Playground</h2>

          <div className="playground-controls">
            <div className="control-group" role="radiogroup" aria-label="Effect type">
              <span className="control-label">Type</span>
              <div className="control-options">
                {sizeOptions.map(({ value, label }) => (
                  <button
                    key={value}
                    className="tab-btn"
                    role="radio"
                    aria-checked={playgroundSize === value}
                    data-active={playgroundSize === value}
                    onClick={() => setPlaygroundSize(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group" role="radiogroup" aria-label="Color variant">
              <span className="control-label">Color</span>
              <div className="control-options">
                {COLOR_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    className="tab-btn"
                    role="radio"
                    aria-checked={playgroundColorVariant === value}
                    data-active={playgroundColorVariant === value}
                    onClick={() => setPlaygroundColorVariant(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group control-group--strength">
              <span className="control-label">Strength</span>
              <div className="strength-track">
                {playgroundStrength > 0 && (
                  <div
                    className="strength-fill"
                    style={{ width: `${playgroundStrength}%` }}
                  />
                )}
                <span className="strength-value">{playgroundStrength}%</span>
                <input
                  id={strengthId}
                  type="range"
                  className="strength-input"
                  value={playgroundStrength}
                  onChange={(e) => setPlaygroundStrength(parseInt(e.target.value, 10))}
                  min={0}
                  max={100}
                  step={1}
                  aria-label="Effect strength"
                />
              </div>
            </div>
          </div>

          <div className={`playground-preview${isPulse ? ' playground-preview--pulse' : ''}`}>
            <BorderBeam
              size={playgroundSize}
              colorVariant={playgroundColorVariant}
              theme={theme}
              active={playgroundActive}
              strength={playgroundStrength / 100}
            >
              <div className={`card ${playgroundSize === 'sm' ? 'card-sm' : 'card-md'}`}>
                <p className="card-text">
                  {playgroundSize === 'sm' ? '' : 'Build anything...'}
                </p>
              </div>
            </BorderBeam>

            <div className="playground-toolbar">
              <button
                type="button"
                className="playground-toggle"
                onClick={() => setPlaygroundActive((p) => !p)}
                aria-pressed={playgroundActive}
                aria-label={playgroundActive ? 'Pause animation' : 'Play animation'}
                title={playgroundActive ? 'Pause' : 'Play'}
              >
                {playgroundActive ? <PauseIcon /> : <PlayIcon />}
              </button>
            </div>
          </div>

          <div className="code-explorer">
            <div className="code-header">
              <div className="code-tabs">
                <ReactIcon />
                <span>React</span>
              </div>
              <CopyButton text={playgroundCode} />
            </div>
            <div className="code-content">
              <code dangerouslySetInnerHTML={{ __html: highlightCode(playgroundCode, 'tsx') }} />
            </div>
          </div>
        </section>

        <footer className="footer">
          <span className="footer-muted">Made by</span>{' '}
          <a className="footer-name" href="https://x.com/jakubantalik" target="_blank" rel="noopener noreferrer">Jakub Antalik</a>
        </footer>
      </main>
    </>
  );
}
