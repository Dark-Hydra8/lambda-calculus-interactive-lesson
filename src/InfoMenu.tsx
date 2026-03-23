import React, { useState, useRef, useEffect } from 'react';

const infoIcon = '?';

export const InfoMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setExpanded(false);
      }
    };
    if (open) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  const infoMessage = (
    <>
      <div style={{ marginBottom: '8px' }}>
        This site teaches lambda calculus using interactive questions. Everything you need is here: definitions, examples, and how the lessons fit together.
      </div>

      <div style={{ marginBottom: '12px' }}>
        <strong>Introductory information</strong>

        <div style={{ marginTop: '10px', marginBottom: '10px' }}>
          <strong>1) The grammar (what lambda expressions are)</strong>
          <div style={{ marginTop: '6px' }}>
            In this website, a “term” just means a <strong>lambda expression</strong>—the exact text you see on the screen.
          </div>
          <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginTop: '6px' }}>
            x                 (variable)
            {'\n'}λx.M              (abstraction: a function)
            {'\n'}M N               (application: apply M to N)
          </div>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <strong>2) Parentheses / reading applications</strong>
          <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginTop: '6px' }}>
            {'M N P'} means {'(M N) P'} (application associates to the left).
          </div>
          <div style={{ marginTop: '6px' }}>
            So x y z is read as <strong>(x y) z</strong>.
          </div>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <strong>3) Bound vs free variables</strong>
          <div style={{ marginTop: '6px' }}>
            A variable occurrence is <strong>bound</strong> if it is inside a <strong>λ</strong> that “introduces” that same name, and you are reading inside that λ’s body.
            If there is no such nearby λ, the variable is <strong>free</strong>.
          </div>
          <div style={{ marginTop: '6px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            λx. (x y)     → x is bound, y is free
            {'\n'}λx. (λx. x)  → the inner λ “takes over” for its own x
          </div>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <strong>4) Substitution (the core of beta reduction)</strong>
          <div style={{ marginTop: '6px' }}>
            Beta reduction is basically substitution: to simplify <strong>(λx.M) N</strong>, replace every <strong>x</strong> inside <strong>M</strong> that belongs to that λ with <strong>N</strong>.
          </div>
          <div style={{ marginTop: '6px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            (λx.M) N  →  M, but every x becomes N
          </div>
          <div style={{ marginTop: '6px' }}>
            If the replacement would cause a <strong>name conflict</strong>, we first do <strong>alpha renaming</strong>.
            (Alpha renaming is explained in section 6.)
          </div>
        </div>

        <div style={{ marginBottom: '6px' }}>
          <strong>5) Redexes</strong>
          <div style={{ marginTop: '6px' }}>
            A <strong>β-redex</strong> is an expression of this shape:
            <span style={{ fontFamily: 'monospace' }}> (λx.t) u </span>
            .
            This is the part of an expression you can simplify next.
          </div>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <strong>6) Alpha renaming</strong>
          <div style={{ marginTop: '6px' }}>
            Alpha renaming means “change the name of a bound variable consistently inside that λ”.
            It does not change the meaning. For example:
          </div>
          <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginTop: '6px' }}>
            λx.M  ≡  λy.(M, with x renamed to y inside that λ)
          </div>
          <div style={{ marginTop: '8px' }}>
            <strong>When do we need it?</strong>
            <div style={{ marginTop: '6px' }}>
              “Name conflict” means: the argument contains a variable name that is also used by a <code>λ</code> inside the part you are replacing.
              If you paste the argument in directly, those variables could start referring to that inner <code>λ</code> instead of the one you intended.
            </div>
            <div style={{ marginTop: '8px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              Example (why renaming can be needed):
              {'\n'}(λx. (λy. x)) y
              {'\n'}→ if we substitute “y for x” directly, the y from the argument ends up under the inner (λy...), so it becomes “the wrong y”.
              {'\n'}→ with alpha renaming first, we can do: (λx. (λy'. x)) y → (λy'. y)
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '14px' }}>
        <strong>Lesson remainders</strong>

        <div style={{ marginTop: '10px', marginBottom: '6px' }}>
          <strong>7) What each lesson practices</strong>
          <div style={{ marginTop: '6px' }}>
            <div>• <strong>Useful Applications</strong>: recognize applications <code>M N</code> (in this lesson: where <code>M</code> isn’t itself an application).</div>
            <div>• <strong>Redex Highlighting</strong>: find every β-redex <code>(λx.t) u</code>.</div>
            <div>• <strong>Variable Binding</strong>: decide which λ binds each variable occurrence (or “free variable”).</div>
            <div>• <strong>Alpha Renaming</strong>: select the λ-parts inside a redex that must be renamed to avoid name clashes.</div>
            <div>• <strong>Beta Reduction</strong>: select where parameter occurrences in <code>t</code> get replaced by the argument <code>u</code>.</div>
          </div>
        </div>

        <div style={{ marginTop: '8px', color: '#555' }}>
          Quick memory: λ creates rules, applications plug in arguments, β-redexes are what you simplify next, and α-renaming is a safety step when names clash.
        </div>
      </div>
    </>
  );

  return (
    <>
      <div ref={menuRef} style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 1000 }}>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setOpen(!open);
          }}
          aria-label="Lambda calculus info"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            padding: 0,
            border: '1px solid #ddd',
            borderRadius: '50%',
            background: '#fff',
            color: '#000',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <span style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1 }}>{infoIcon}</span>
        </button>
        {open && (
          <div
            style={{
              position: expanded ? 'fixed' : 'absolute',
              top: expanded ? 0 : '100%',
              left: expanded ? 0 : undefined,
              right: 0,
              bottom: expanded ? 0 : undefined,
              marginTop: expanded ? 0 : '6px',
              minWidth: expanded ? 'unset' : '280px',
              width: expanded ? '100vw' : undefined,
              height: expanded ? '100vh' : undefined,
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: expanded ? 0 : '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: 0,
              maxWidth: expanded ? '100vw' : '90vw',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid #eee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ fontWeight: 700, color: '#000' }}>
                Lambda Calculus (Info)
              </div>

              <button
                type="button"
                onClick={() => setExpanded(prev => !prev)}
                aria-expanded={expanded}
                style={{
                  flexShrink: 0,
                  border: '1px solid #ddd',
                  background: '#fff',
                  borderRadius: '999px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#000',
                }}
              >
                {expanded ? 'Collapse' : 'Expand'}
              </button>
            </div>

            <div
              style={{
                padding: expanded ? '12px 14px' : '12px 16px',
                // Make the help content scrollable so it doesn't cover the page.
                flex: expanded ? '1 1 auto' : undefined,
                maxHeight: expanded ? undefined : '45vh',
                overflowY: 'auto',
              }}
            >
              {!expanded ? (
                <div style={{ fontSize: '13.5px', color: '#000', lineHeight: 1.45 }}>
                  {infoMessage}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: '16px',
                    color: '#000',
                    lineHeight: 1.8,
                    border: '1px solid #eee',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    background: '#fafafa',
                  }}
                >
                  {infoMessage}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

