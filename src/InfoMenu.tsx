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
      Lambda calculus is built from:
      <br />
      <span style={{ whiteSpace: 'nowrap' }}>λx.M (abstraction)</span>
      , and
      <br />
      <span style={{ whiteSpace: 'nowrap' }}>M N (application)</span>
      .
      <br />
      Reduction follows normal order: always reduce the leftmost outermost reducible expression first.
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
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '6px',
              minWidth: expanded ? '360px' : '220px',
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: expanded ? '10px 0' : '6px 0',
            }}
          >
            {!expanded ? (
              <>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #eee' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px', color: '#000' }}>Lambda Calculus (Info)</div>
                  <div style={{ fontSize: '13px', color: '#000', lineHeight: 1.4 }}>
                    {infoMessage}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#000',
                  }}
                >
                  Expand
                </button>
              </>
            ) : (
              <>
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '10px', color: '#000', fontSize: '16px' }}>Lambda Calculus (Expanded)</div>
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
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#000',
                  }}
                >
                  Show less
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
};

