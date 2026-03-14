/**
 * Exibe conteúdo com efeito de digitação (palavras aparecendo progressivamente).
 * Enquanto aguarda conteúdo: mostra "..." animado.
 * Quando conteúdo chega: anima palavra por palavra.
 */
import React, { useState, useEffect, useRef } from 'react';

interface TypingSectionContentProps {
  content: string;
  isGenerating: boolean;
  /** Conteúdo exibido durante animação (Textarea ou div) */
  children?: (displayValue: string, isAnimating: boolean) => React.ReactNode;
  /** Se true, usa textarea; senão usa div com dangerouslySetInnerHTML para HTML */
  asHtml?: boolean;
  className?: string;
  placeholder?: string;
}

const WORD_DELAY_MS = 30;
const DOTS_CYCLE_MS = 500;

export function TypingSectionContent({
  content,
  isGenerating,
  children,
  asHtml = false,
  className = '',
  placeholder = 'Digite aqui...',
}: TypingSectionContentProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [dotsPhase, setDotsPhase] = useState(0);
  const prevContentRef = useRef('');
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Enquanto gera e não tem conteúdo: ciclo "..." , ".." , "."
  useEffect(() => {
    if (!isGenerating || content.trim()) return;
    const t = setInterval(() => {
      setDotsPhase((p) => (p + 1) % 4);
    }, DOTS_CYCLE_MS);
    return () => clearInterval(t);
  }, [isGenerating, content]);

  // Quando conteúdo chega: animação palavra por palavra
  useEffect(() => {
    if (!content.trim()) {
      setDisplayedText('');
      setIsAnimating(false);
      return;
    }
    if (content === prevContentRef.current) return;
    prevContentRef.current = content;

    const words = content.split(/(\s+)/);
    let i = 0;
    setDisplayedText('');
    setIsAnimating(true);

    const scheduleNext = () => {
      if (i >= words.length) {
        setIsAnimating(false);
        return;
      }
      setDisplayedText((prev) => prev + words[i]);
      i++;
      animationRef.current = setTimeout(scheduleNext, WORD_DELAY_MS);
    };
    scheduleNext();
    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, [content]);

  const loadingPlaceholder = '.'.repeat((dotsPhase % 3) + 1);

  if (isGenerating && !content.trim()) {
    return children ? (
      children(loadingPlaceholder, true)
    ) : (
      <div className={className}>
        <span className="animate-pulse">{loadingPlaceholder}</span>
      </div>
    );
  }

  if (isAnimating && displayedText) {
    if (children) {
      return children(displayedText, true);
    }
    if (asHtml) {
      return (
        <div
          className={className}
          dangerouslySetInnerHTML={{ __html: displayedText }}
        />
      );
    }
    return <div className={className}>{displayedText}</div>;
  }

  return children ? children(content, false) : <div className={className}>{content}</div>;
}
