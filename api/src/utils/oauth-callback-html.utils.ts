/**
 * Escapes text for safe insertion into HTML body text nodes.
 */
export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type OAuthSuccessPageParams = {
  dashboardUrl: string;
};

/**
 * HTML shown in the browser after OAuth `redirect_uri` completes token exchange.
 * Attempts to close SSO popup windows; otherwise redirects to the Migration Tool dashboard.
 */
export function buildOAuthSuccessPage(params: OAuthSuccessPageParams): string {
  const { dashboardUrl } = params;
  const dashHref = escapeHtml(dashboardUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Successfully Authorized</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #fff;
      color: #374151;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .panel {
      max-width: 28rem;
      text-align: center;
    }
    h1 {
      margin: 0 0 16px;
      font-size: 1.5rem;
      font-weight: 700;
      color: #5b21b6;
    }
    p {
      margin: 0 0 12px;
      font-size: 0.95rem;
      line-height: 1.5;
      color: #4b5563;
    }
    p.sub {
      margin-top: 20px;
      font-size: 0.875rem;
    }
    a {
      color: #4f46e5;
      text-decoration: none;
      font-weight: 500;
    }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="panel">
    <h1>Successfully Authorized!</h1>
    <p>You can close this window now.</p>
    <p class="sub"><a href="${dashHref}" id="continue-link">Open Migration Tool</a></p>
  </div>
  <script>
    (function () {
      var dashboard = ${JSON.stringify(dashboardUrl)};
      var delayMs = 2000;
      setTimeout(function () {
        try {
          if (window.opener && !window.opener.closed) {
            window.close();
            return;
          }
        } catch (e) {}
        window.location.replace(dashboard);
      }, delayMs);
    })();
  </script>
</body>
</html>`;
}

/** Must match `SSO_OAUTH_POSTMESSAGE_SOURCE` in ui `Login/index.tsx` (OAuth callback notify opener). */
const OAUTH_CALLBACK_POSTMESSAGE_SOURCE = 'cs-migration-oauth-callback';

export function buildOAuthErrorPage(message: string, dashboardUrl: string): string {
  const safe = escapeHtml(message);
  const dashHref = escapeHtml(dashboardUrl);
  const messageJs = JSON.stringify(message);
  const sourceJs = JSON.stringify(OAUTH_CALLBACK_POSTMESSAGE_SOURCE);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authorization Failed</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #fff;
      color: #374151;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .panel { max-width: 28rem; text-align: center; }
    h1 { font-size: 1.25rem; color: #b91c1c; margin: 0 0 12px; }
    p { line-height: 1.5; color: #4b5563; }
    a { color: #4f46e5; }
  </style>
</head>
<body>
  <div class="panel">
    <h1>Something Went Wrong</h1>
    <p>${safe}</p>
    <p><a href="${dashHref}">Back to Migration Tool</a></p>
  </div>
  <script>
    (function () {
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { source: ${sourceJs}, ok: false, message: ${messageJs} },
            '*'
          );
        }
      } catch (e) {}
    })();
  </script>
</body>
</html>`;
}
