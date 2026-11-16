/**
 * `VITE_CLARITY_ID` as a project id, or '' when unset. It is written into an inline
 * script, so anything but letters and digits fails the build.
 */
export function normalizeClarityId(raw: string | undefined): string {
  const value = (raw ?? '').trim();

  if (value === '') return '';

  if (!/^[a-z0-9]{6,32}$/i.test(value)) {
    throw new Error(
      `VITE_CLARITY_ID must be the Clarity project id, letters and digits, got "${raw}"`,
    );
  }

  return value;
}

/** The Clarity tag: the queue at once, the library at idle, the page language as a tag. */
export function clarityScript(id: string): string {
  return [
    '<script>',
    '      (function (w, d, id) {',
    '        w.clarity =',
    '          w.clarity ||',
    '          function () {',
    '            (w.clarity.q = w.clarity.q || []).push(arguments);',
    '          };',
    "        w.clarity('set', 'page_language', d.documentElement.lang || 'unknown');",
    '',
    '        var go = function () {',
    "          var s = d.createElement('script');",
    '          s.async = true;',
    "          s.src = 'https://www.clarity.ms/tag/' + id;",
    '          d.head.appendChild(s);',
    '        };',
    '',
    "        if ('requestIdleCallback' in w) requestIdleCallback(go, { timeout: 4000 });",
    '        else setTimeout(go, 2000);',
    `      })(window, document, '${id}');`,
    '    </script>',
  ].join('\n');
}
