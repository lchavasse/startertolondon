/**
 * UTM tagging for outbound links.
 *
 * Every public outbound link on the site is decorated with utm_source +
 * utm_medium so destinations (Luma, Eventbrite, KB sites, etc.) can attribute
 * the click back to londoncalling.guide. Pure + safe: preserves existing query
 * strings, only touches http(s) URLs, and no-ops if the link already carries a
 * utm_source. Admin/internal links are intentionally left untagged.
 */

const UTM_SOURCE = 'londoncalling.guide'
const UTM_MEDIUM = 'referral'

export function withUtm(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return url
    if (u.searchParams.has('utm_source')) return url
    u.searchParams.set('utm_source', UTM_SOURCE)
    u.searchParams.set('utm_medium', UTM_MEDIUM)
    return u.toString()
  } catch {
    // Relative or malformed URL — leave it untouched.
    return url
  }
}
