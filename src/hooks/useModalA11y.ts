import { useEffect, useRef } from 'react';

const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useModalA11y(onClose:()=>void,active=true){
  const dialogRef=useRef<HTMLDivElement>(null);
  const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{
    if(!active||!dialogRef.current)return;
    const dialog=dialogRef.current,previous=document.activeElement as HTMLElement|null;
    const focusables=()=>[...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(element=>!element.hidden&&element.getAttribute('aria-hidden')!=='true');
    (focusables()[0]??dialog).focus();
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();closeRef.current();return;}
      if(event.key!=='Tab')return;
      const items=focusables();if(!items.length){event.preventDefault();dialog.focus();return;}
      const first=items[0],last=items.at(-1)!;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    dialog.addEventListener('keydown',onKeyDown);
    return()=>{dialog.removeEventListener('keydown',onKeyDown);previous?.focus();};
  },[active]);
  return dialogRef;
}
