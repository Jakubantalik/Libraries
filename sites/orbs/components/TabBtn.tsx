import React from 'react';
import { cn } from '../lib/utils';

// Lifted out of Playground so the Installation section's platform tabs are
// literally the same control, not a second one styled to look similar.
const tabBtnBase =
  'flex items-center justify-center h-9 px-3 border-none rounded-lg font-[Inter,sans-serif] text-[13px] font-normal leading-[14px] cursor-pointer transition-[background-color,color] duration-150 whitespace-nowrap [-webkit-tap-highlight-color:transparent] hover:bg-(--tab-hover-bg) hover:text-(--tab-hover-color) focus-visible:outline-2 focus-visible:outline-[rgba(255,255,255,0.5)] focus-visible:outline-offset-2';

export function TabBtn({
  active,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      {...props}
      className={cn(
        tabBtnBase,
        active
          ? 'bg-(--tab-active-bg) text-(--tab-active-color) shadow-(--tab-active-shadow)'
          : 'bg-(--tab-bg) text-(--tab-color)',
      )}
      type="button"
    />
  );
}
