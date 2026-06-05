/**
 * The "site" key the on-screen-keyboard position is remembered under: the
 * lowercased `location.hostname` with a single leading `www.` removed. Scheme
 * and port are ignored and subdomains are distinct, so `mail.example.com` and
 * `docs.example.com` differ while `www.example.com` and `example.com` match.
 *
 * Returns `undefined` for an empty hostname (e.g. `file://`, `about:blank`),
 * which has nothing meaningful to key a position on — callers skip persisting a
 * position in that case (the global collapsed state is still remembered).
 */
export function currentOskSite(hostname: string = location.hostname): string | undefined {
    const host = hostname.toLowerCase();
    if (!host) {
        return undefined;
    }
    return host.startsWith("www.") ? host.slice("www.".length) : host;
}
