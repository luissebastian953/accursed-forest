/** The AI assistants a visitor can arrive from, each with the hosts its links come from. */
export const AI_SOURCES: Readonly<Record<string, readonly string[]>> = {
  chatgpt: ['chatgpt.com', 'chat.openai.com', 'openai.com'],
  perplexity: ['perplexity.ai'],
  gemini: ['gemini.google.com', 'bard.google.com'],
  claude: ['claude.ai'],
  copilot: ['copilot.microsoft.com', 'copilot.com', 'copilot.cloud.microsoft'],
  deepseek: ['chat.deepseek.com', 'deepseek.com'],
  grok: ['grok.com', 'x.ai'],
  meta_ai: ['meta.ai'],
  mistral: ['chat.mistral.ai'],
  kimi: ['kimi.com', 'kimi.moonshot.cn'],
  qwen: ['chat.qwen.ai', 'tongyi.aliyun.com'],
  doubao: ['doubao.com'],
  you: ['you.com'],
  phind: ['phind.com'],
};

/** Where the landing page keeps the assistant for the rest of the visit, the game included. */
export const AI_SOURCE_KEY = 'sawit:ai-source';

/**
 * The tag every page carries: it names the assistant from the referrer or `utm_source`,
 * keeps it for the session, and hands it to GA4 (`ai_referral`) and Clarity (`ai_source`).
 */
export function aiReferralScript(sources = AI_SOURCES): string {
  return `<script>
      (function (w, d, sources, key) {
        var found = '';
        var stored = '';

        try {
          var ref = d.referrer ? new URL(d.referrer).hostname.replace(/^www\\./, '') : '';
          var utm = (new URLSearchParams(w.location.search).get('utm_source') || '')
            .toLowerCase()
            .replace(/^www\\./, '');

          for (var name in sources) {
            if (utm === name) found = name;

            for (var i = 0; i < sources[name].length; i++) {
              var host = sources[name][i];

              if (ref === host || ref.slice(-host.length - 1) === '.' + host || utm === host) {
                found = name;
              }
            }
          }
        } catch (e) {
          /* no URL support: no source */
        }

        try {
          stored = w.sessionStorage.getItem(key) || '';
          if (found) w.sessionStorage.setItem(key, found);
        } catch (e) {
          /* storage off: the landing page still reports */
        }

        if (found && found !== stored && typeof w.gtag === 'function') {
          w.gtag('event', 'ai_referral', { ai_source: found });
        }

        if ((found || stored) && typeof w.clarity === 'function') {
          w.clarity('set', 'ai_source', found || stored);
        }
      })(window, document, ${JSON.stringify(sources)}, '${AI_SOURCE_KEY}');
    </script>`;
}
